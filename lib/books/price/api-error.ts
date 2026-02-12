/** Typed API error carrying an HTTP status and optional detail payload. @source */
export class ApiError extends Error {
  status: number
  details?: Record<string, unknown>

  constructor(
    status: number,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.status = status
    this.details = details
  }
}
