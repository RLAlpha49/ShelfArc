import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { Readable } from "node:stream"
import { ReadableStream } from "node:stream/web"
import sharp from "sharp"
import { createAdminClient } from "@/lib/supabase/admin"
import { createUserClient } from "@/lib/supabase/server"
import { isSafeStoragePath } from "@/lib/storage/safe-path"
import { apiError } from "@/lib/api-response"
import { enforceSameOrigin } from "@/lib/csrf"
import {
  ConcurrencyLimitError,
  ConcurrencyLimiter
} from "@/lib/concurrency/limiter"
import { getCorrelationId, CORRELATION_HEADER } from "@/lib/correlation"
import { logger, type Logger } from "@/lib/logger"

/** Forces Node.js runtime for sharp image processing. @source */
export const runtime = "nodejs"

/** Supabase Storage bucket for user media. @source */
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "media"

/** MIME types accepted for image uploads. @source */
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif"
])

/** Size and quality constraints for each upload category. @source */
const UPLOAD_SPECS = {
  avatar: {
    folder: "avatars",
    maxBytes: 2 * 1024 * 1024,
    maxDimension: 512,
    quality: 80
  },
  "series-cover": {
    folder: "covers/series",
    maxBytes: 5 * 1024 * 1024,
    maxDimension: 1600,
    quality: 82
  },
  "volume-cover": {
    folder: "covers/volumes",
    maxBytes: 5 * 1024 * 1024,
    maxDimension: 1600,
    quality: 82
  }
} as const

/** Upload category key. @source */
type UploadKind = keyof typeof UPLOAD_SPECS

/** Resolved spec for a given upload kind. @source */
type UploadSpec = (typeof UPLOAD_SPECS)[UploadKind]

const isDev = process.env.NODE_ENV !== "production"

/** Limits concurrent sharp + storage work per instance to prevent overload. @source */
const uploadLimiter = new ConcurrencyLimiter({
  concurrency: 2,
  maxQueue: 12,
  retryAfterMs: 1500
})

/** Extracts a human-readable message from an unknown error. @source */
const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Upload failed"

/** Builds a JSON error response with the given status. @source */
const buildError = (message: string, status: number) =>
  apiError(status, message)

/** Metadata stored when a previous-file deletion fails during replacement. @source */
type FailedDeletionRecord = {
  replacePath: string
  newPath: string
  userId: string
  timestamp: string
  reason: string
  removeError?: string
  rollbackError?: string
}

/** Result of image processing — either a buffer or an error response. @source */
type ProcessImageResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; response: Response }

/**
 * Persists a failed-deletion record to storage for later cleanup.
 * @param supabase - Admin Supabase client.
 * @param record - Metadata about the failed deletion.
 * @returns `true` if the record was successfully stored.
 * @source
 */
const enqueueFailedDeletion = async (
  supabase: ReturnType<typeof createAdminClient>,
  record: FailedDeletionRecord,
  log: Logger
) => {
  try {
    const payload = JSON.stringify(record)
    const cleanupPath = `${record.userId}/cleanup/failed-deletion-${randomUUID()}.json`
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(cleanupPath, Buffer.from(payload), {
        contentType: "application/json",
        cacheControl: "0",
        upsert: false
      })

    if (error) {
      log.error("Failed to enqueue deletion record", {
        error: error instanceof Error ? error.message : String(error),
        cleanupPath,
        record
      })
      return false
    }

    return true
  } catch (error) {
    log.error("Failed to enqueue deletion record", {
      error: error instanceof Error ? error.message : String(error),
      record
    })
    return false
  }
}

/**
 * Resizes, rotates, and converts an image to WebP using sharp.
 * @param inputStream - Readable stream of the raw uploaded image.
 * @param spec - Upload spec controlling max dimensions and quality.
 * @param context - Contextual metadata for error logging.
 * @returns A `ProcessImageResult` with the optimized buffer or an error response.
 * @source
 */
const processImage = async (
  inputStream: Readable,
  spec: UploadSpec,
  context: { userId: string; mimeType: string },
  log: Logger
): Promise<ProcessImageResult> => {
  try {
    const transformer = sharp({ failOnError: true })
      .rotate()
      .resize(spec.maxDimension, spec.maxDimension, {
        fit: "inside",
        withoutEnlargement: true
      })
      .webp({ quality: spec.quality })

    inputStream.pipe(transformer)
    const buffer = await transformer.toBuffer()

    return { ok: true, buffer }
  } catch (error) {
    log.error("Image processing failed", {
      error: error instanceof Error ? error.message : String(error),
      userId: context.userId,
      mimeType: context.mimeType
    })
    return {
      ok: false,
      response: buildError(
        isDev ? getErrorMessage(error) : "Invalid image",
        400
      )
    }
  }
}

/**
 * Removes the previously stored file after a successful replacement upload.
 * @param params - Cleanup parameters including paths and user ID.
 * @source
 */
const handleReplaceCleanup = async (params: {
  supabase: ReturnType<typeof createAdminClient>
  shouldReplace: boolean
  replacePathValue: string
  fileName: string
  userId: string
  log: Logger
}) => {
  const { supabase, shouldReplace, replacePathValue, fileName, userId, log } =
    params

  if (!shouldReplace || replacePathValue === fileName) {
    return
  }

  const { error: removeError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([replacePathValue])

  if (!removeError) {
    return
  }

  log.warn("Failed to remove previous image", {
    error:
      removeError instanceof Error ? removeError.message : String(removeError),
    replacePathValue,
    fileName,
    userId
  })

  const removeErrorMessage = getErrorMessage(removeError)
  const enqueued = await enqueueFailedDeletion(
    supabase,
    {
      replacePath: replacePathValue,
      newPath: fileName,
      userId,
      timestamp: new Date().toISOString(),
      reason: "replace_remove_failed",
      removeError: removeErrorMessage
    },
    log
  )

  if (!enqueued) {
    log.error("Failed to enqueue cleanup after replace removal failure", {
      replacePathValue,
      fileName,
      userId,
      removeError: removeErrorMessage
    })
  }
}

/**
 * Parses multipart form data from the upload request.
 * @param request - The incoming HTTP request.
 * @returns Parsed `FormData` or a JSON error response.
 * @source
 */
const getFormData = async (request: Request) => {
  try {
    return await request.formData()
  } catch {
    return buildError("Invalid form data", 400)
  }
}

/**
 * Validates and extracts upload metadata from the parsed form data.
 * @param formData - Parsed form data from the request.
 * @param userId - Authenticated user's ID for path scoping.
 * @returns Validated upload data or a JSON error response.
 * @source
 */
const getUploadData = (formData: FormData, userId: string) => {
  const file = formData.get("file")
  if (!(file instanceof File)) {
    return buildError("Missing file", 400)
  }

  const kind = formData.get("kind")
  if (typeof kind !== "string" || !(kind in UPLOAD_SPECS)) {
    return buildError("Invalid upload kind", 400)
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return buildError("Unsupported file type", 415)
  }

  const spec = UPLOAD_SPECS[kind as UploadKind]
  if (file.size <= 0) {
    return buildError("Empty file", 400)
  }

  if (file.size > spec.maxBytes) {
    return buildError("File size exceeds limit", 413)
  }

  const replacePath = formData.get("replacePath")
  const replacePathValue =
    typeof replacePath === "string" ? replacePath.trim() : ""
  if (
    replacePathValue &&
    (!isSafeStoragePath(replacePathValue) ||
      !replacePathValue.startsWith(`${userId}/`))
  ) {
    return buildError("Invalid replace path", 400)
  }

  const shouldReplace = Boolean(replacePathValue)

  return {
    file,
    spec,
    replacePathValue,
    shouldReplace
  }
}

/**
 * Handles authenticated image uploads: validates, optimizes via sharp, stores in Supabase, and cleans up replaced files.
 * @param request - Incoming multipart POST request with `file`, `kind`, and optional `replacePath` fields.
 * @returns JSON with the stored file path on success, or an error response.
 * @source
 */
export async function POST(request: Request) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  const csrfResult = enforceSameOrigin(request)
  if (csrfResult) return csrfResult

  const userClient = await createUserClient()
  const {
    data: { user }
  } = await userClient.auth.getUser()

  if (!user) {
    return buildError("Unauthorized", 401)
  }

  const formData = await getFormData(request)
  if (formData instanceof Response) return formData

  const uploadData = getUploadData(formData, user.id)
  if (uploadData instanceof Response) return uploadData

  const { file, spec, replacePathValue, shouldReplace } = uploadData

  try {
    return await uploadLimiter.run(async () => {
      try {
        // file.stream() returns a DOM ReadableStream, which doesn't match Node's ReadableStream types.
        // Cast through unknown so Readable.fromWeb accepts it while remaining safe at runtime.
        const inputStream = Readable.fromWeb(
          file.stream() as unknown as ReadableStream<Uint8Array>
        )
        const optimizedResult = await processImage(
          inputStream,
          spec,
          {
            userId: user.id,
            mimeType: file.type
          },
          log
        )

        if (!optimizedResult.ok) {
          return optimizedResult.response
        }

        const optimizedBuffer = optimizedResult.buffer

        const fileName = `${user.id}/${spec.folder}/${randomUUID()}.webp`

        const adminClient = createAdminClient({
          reason: "Upload user-owned media to storage"
        })
        const { error: uploadError } = await adminClient.storage
          .from(STORAGE_BUCKET)
          .upload(fileName, optimizedBuffer, {
            contentType: "image/webp",
            cacheControl: "31536000",
            upsert: false
          })

        if (uploadError) {
          log.error("Storage upload failed", {
            error:
              uploadError instanceof Error
                ? uploadError.message
                : String(uploadError)
          })
          return buildError(isDev ? uploadError.message : "Upload failed", 500)
        }

        await handleReplaceCleanup({
          supabase: adminClient,
          shouldReplace,
          replacePathValue,
          fileName,
          userId: user.id,
          log
        })

        const response = NextResponse.json({ path: fileName })
        response.headers.set(CORRELATION_HEADER, correlationId)
        return response
      } catch (error) {
        const message = getErrorMessage(error)
        log.error("Image upload failed", {
          error: error instanceof Error ? error.message : String(error)
        })
        return buildError(isDev ? message : "Upload failed", 500)
      }
    })
  } catch (error) {
    if (error instanceof ConcurrencyLimitError) {
      return apiError(503, error.message, {
        extra: { retryAfterMs: error.retryAfterMs }
      })
    }

    const message = getErrorMessage(error)
    log.error("Image upload failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return buildError(isDev ? message : "Upload failed", 500)
  }
}
