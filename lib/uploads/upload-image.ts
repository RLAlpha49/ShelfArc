/** Discriminated upload category for storage path organization. @source */
export type UploadKind = "avatar" | "series-cover" | "volume-cover"

/** Options for the image upload function. @source */
export interface UploadOptions {
  replacePath?: string | null
  signal?: AbortSignal
  timeoutMs?: number
}

/** Shape of the upload API JSON response. @source */
export interface UploadResponse {
  path: string
}

/**
 * Wrapper around `fetch` that supports an AbortSignal and a timeout.
 * @param input - The fetch input (URL or Request).
 * @param init - Fetch init options.
 * @param options - Signal and timeout configuration.
 * @returns The fetch Response.
 * @throws On timeout or cancellation.
 * @source
 */
const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit,
  options: { signal?: AbortSignal; timeoutMs?: number }
) => {
  const controller = new AbortController()
  const timeoutReason = new Error("Upload timed out")
  const cancelReason = new Error("Upload cancelled")
  const abortHandler = () =>
    controller.abort(options.signal?.reason ?? cancelReason)

  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort(options.signal.reason ?? cancelReason)
    } else {
      options.signal.addEventListener("abort", abortHandler, { once: true })
    }
  }

  const timeoutMs = options.timeoutMs ?? 30000
  const timeoutId =
    timeoutMs > 0
      ? setTimeout(() => controller.abort(timeoutReason), timeoutMs)
      : undefined

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    })
  } catch (error) {
    if (
      error instanceof DOMException ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      const abortReason = controller.signal.reason
      if (abortReason === timeoutReason) {
        throw new Error("Upload timed out")
      }
      throw new Error("Upload cancelled")
    }
    throw error
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    if (options.signal) {
      options.signal.removeEventListener("abort", abortHandler)
    }
  }
}

/**
 * Uploads an image file to the server and returns a `storage:` prefixed path.
 * @param file - The image file to upload.
 * @param kind - The upload category (avatar, series-cover, volume-cover).
 * @param options - Optional abort signal, timeout, and replacement path.
 * @returns A `storage:`-prefixed path string.
 * @throws If the upload fails or the response has no path.
 * @source
 */
export async function uploadImage(
  file: File,
  kind: UploadKind,
  options: UploadOptions = {}
): Promise<string> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("kind", kind)

  if (options.replacePath != null) {
    formData.append("replacePath", options.replacePath)
  }

  const response = await fetchWithTimeout(
    "/api/uploads",
    {
      method: "POST",
      body: formData
    },
    {
      signal: options.signal,
      timeoutMs: options.timeoutMs
    }
  )

  if (!response.ok) {
    const message = await response
      .json()
      .then((data: { error?: string }) => data.error ?? "Upload failed")
      .catch(() => "Upload failed")
    throw new Error(message)
  }

  const data = (await response.json()) as UploadResponse

  if (!data.path) {
    throw new Error("Upload failed")
  }

  return `storage:${data.path}`
}
