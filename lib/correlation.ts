/** HTTP header name used to propagate correlation IDs. @source */
export const CORRELATION_HEADER = "x-correlation-id"

/**
 * Extracts or generates a correlation ID from the incoming request.
 * Reads the `x-correlation-id` header when present, sanitizes it to
 * `[a-zA-Z0-9\-_]` characters (max 64 chars, min 8 chars after cleaning),
 * then falls back to a fresh UUID to prevent log injection.
 * @param request - The incoming HTTP request.
 * @returns A sanitized correlation ID string.
 * @source
 */
export const getCorrelationId = (request: Request): string => {
  const reqHeaders = request?.headers
  const existing =
    reqHeaders && typeof reqHeaders.get === "function"
      ? reqHeaders.get(CORRELATION_HEADER)?.trim()
      : undefined
  if (existing) {
    const cleaned = existing.replaceAll(/[^a-zA-Z0-9\-_]/g, "").slice(0, 64)
    if (cleaned.length >= 8) return cleaned
  }
  return crypto.randomUUID()
}

/**
 * Sets the correlation ID header on an outgoing response.
 * @param response - The outgoing HTTP response.
 * @param id - The correlation ID to attach.
 * @source
 */
export const setCorrelationHeader = (response: Response, id: string): void => {
  response.headers.set(CORRELATION_HEADER, id)
}
