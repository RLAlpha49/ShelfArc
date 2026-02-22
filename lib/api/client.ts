export class ApiClientError extends Error {
  retryAfterMs?: number

  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message)
    this.name = "ApiClientError"
  }
}

interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown
  retries?: number
}

function buildFetchInit(
  init: Omit<ApiFetchOptions, "body" | "retries">,
  body: unknown
): RequestInit {
  const fetchInit: RequestInit = {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers
    }
  }
  if (body !== undefined) {
    fetchInit.body = JSON.stringify(body)
  }
  return fetchInit
}

const MAX_RETRY_AFTER_MS = 30_000

function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined
  const seconds = Number(header)
  if (!Number.isNaN(seconds))
    return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS)
  const date = Date.parse(header)
  if (!Number.isNaN(date))
    return Math.min(Math.max(date - Date.now(), 0), MAX_RETRY_AFTER_MS)
  return undefined
}

async function tryFetch<T>(url: string, fetchInit: RequestInit): Promise<T> {
  const res = await fetch(url, fetchInit)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const err = new ApiClientError(
      data.error ?? `Request failed with status ${res.status}`,
      res.status,
      data.code,
      data
    )
    if (res.status === 429) {
      err.retryAfterMs = parseRetryAfterMs(res.headers.get("Retry-After"))
    }
    throw err
  }
  return (await res.json()) as T
}

function isNonRetryable(err: unknown): boolean {
  if (err instanceof ApiClientError) {
    // 429 errors are retryable — the retry loop handles the Retry-After delay
    return err.status !== 429
  }
  return err instanceof DOMException && err.name === "AbortError"
}

function retryDelay(err: unknown, attempt: number): number {
  if (
    err instanceof ApiClientError &&
    err.status === 429 &&
    err.retryAfterMs !== undefined
  ) {
    return err.retryAfterMs
  }
  return 2 ** attempt * 500
}

export async function apiFetch<T>(
  url: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { body, retries = 0, ...init } = options
  const fetchInit = buildFetchInit(init, body)

  let lastError: Error | null = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await tryFetch<T>(url, fetchInit)
    } catch (err) {
      if (isNonRetryable(err)) throw err
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, retryDelay(err, attempt)))
      }
    }
  }
  throw lastError ?? new Error("Request failed")
}
