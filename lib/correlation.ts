/** HTTP header name used to propagate correlation IDs. @source */
export const CORRELATION_HEADER = "x-correlation-id"

/**
 * Extracts or generates a correlation ID from the incoming request.
 * Reads the `x-correlation-id` header when present, otherwise generates a UUID.
 * @param request - The incoming HTTP request.
 * @returns A correlation ID string.
 * @source
 */
export const getCorrelationId = (request: Request): string => {
  const headers = request?.headers
  const existing =
    headers && typeof headers.get === "function"
      ? headers.get(CORRELATION_HEADER)?.trim()
      : undefined
  if (existing) return existing
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
