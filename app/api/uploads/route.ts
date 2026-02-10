import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { Readable } from "node:stream"
import { ReadableStream } from "node:stream/web"
import sharp from "sharp"
import { createAdminClient } from "@/lib/supabase/admin"
import { createUserClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "media"

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif"
])

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

type UploadKind = keyof typeof UPLOAD_SPECS
type UploadSpec = (typeof UPLOAD_SPECS)[UploadKind]
const isDev = process.env.NODE_ENV !== "production"
const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Upload failed"
const isSafePath = (path: string) =>
  !(path.includes("..") || path.includes("\\") || path.startsWith("/"))
const buildError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status })

type FailedDeletionRecord = {
  replacePath: string
  newPath: string
  userId: string
  timestamp: string
  reason: string
  removeError?: string
  rollbackError?: string
}

type ProcessImageResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; response: Response }

const enqueueFailedDeletion = async (
  supabase: ReturnType<typeof createAdminClient>,
  record: FailedDeletionRecord
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
      console.error("Failed to enqueue deletion record", {
        error,
        cleanupPath,
        record
      })
      return false
    }

    return true
  } catch (error) {
    console.error("Failed to enqueue deletion record", {
      error,
      record
    })
    return false
  }
}

const processImage = async (
  inputStream: Readable,
  spec: UploadSpec,
  context: { userId: string; mimeType: string }
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
    console.error("Image processing failed", {
      error,
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

const handleReplaceCleanup = async (params: {
  supabase: ReturnType<typeof createAdminClient>
  shouldReplace: boolean
  replacePathValue: string
  fileName: string
  userId: string
}) => {
  const { supabase, shouldReplace, replacePathValue, fileName, userId } = params

  if (!shouldReplace || replacePathValue === fileName) {
    return
  }

  const { error: removeError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([replacePathValue])

  if (!removeError) {
    return
  }

  console.warn("Failed to remove previous image", {
    error: removeError,
    replacePathValue,
    fileName,
    userId
  })

  const removeErrorMessage = getErrorMessage(removeError)
  const enqueued = await enqueueFailedDeletion(supabase, {
    replacePath: replacePathValue,
    newPath: fileName,
    userId,
    timestamp: new Date().toISOString(),
    reason: "replace_remove_failed",
    removeError: removeErrorMessage
  })

  if (!enqueued) {
    console.error("Failed to enqueue cleanup after replace removal failure", {
      replacePathValue,
      fileName,
      userId,
      removeError: removeErrorMessage
    })
  }
}

const getFormData = async (request: Request) => {
  try {
    return await request.formData()
  } catch {
    return buildError("Invalid form data", 400)
  }
}

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
    (!isSafePath(replacePathValue) ||
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

export async function POST(request: Request) {
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
    // file.stream() returns a DOM ReadableStream, which doesn't match Node's ReadableStream types.
    // Cast through unknown so Readable.fromWeb accepts it while remaining safe at runtime.
    const inputStream = Readable.fromWeb(
      file.stream() as unknown as ReadableStream<Uint8Array>
    )
    const optimizedResult = await processImage(inputStream, spec, {
      userId: user.id,
      mimeType: file.type
    })

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
      console.error("Storage upload failed", uploadError)
      return buildError(isDev ? uploadError.message : "Upload failed", 500)
    }

    await handleReplaceCleanup({
      supabase: adminClient,
      shouldReplace,
      replacePathValue,
      fileName,
      userId: user.id
    })

    return NextResponse.json({ path: fileName })
  } catch (error) {
    const message = getErrorMessage(error)
    console.error("Image upload failed", error)
    return buildError(isDev ? message : "Upload failed", 500)
  }
}
