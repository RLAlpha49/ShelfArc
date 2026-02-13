export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
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

async function tryFetch<T>(url: string, fetchInit: RequestInit): Promise<T> {
  const res = await fetch(url, fetchInit)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiClientError(
      data.error ?? `Request failed with status ${res.status}`,
      res.status,
      data
    )
  }
  return (await res.json()) as T
}

function isNonRetryable(err: unknown): boolean {
  return (
    err instanceof ApiClientError ||
    (err instanceof DOMException && err.name === "AbortError")
  )
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
        await new Promise((r) => setTimeout(r, 2 ** attempt * 500))
      }
    }
  }
  throw lastError ?? new Error("Request failed")
}
