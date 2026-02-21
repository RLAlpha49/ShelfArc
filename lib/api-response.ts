import { NextResponse } from "next/server"

/** Machine-readable error classification codes. @source */
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "EXTERNAL_SERVICE_ERROR"
  | "QUOTA_EXCEEDED"
  | "SCRAPE_BLOCKED"
  | "SERVICE_UNAVAILABLE"

/** Maps an HTTP status to a sensible default error code. @source */
const defaultCodeFromStatus = (status: number): ApiErrorCode => {
  switch (status) {
    case 400:
      return "VALIDATION_ERROR"
    case 401:
      return "AUTHENTICATION_REQUIRED"
    case 403:
      return "FORBIDDEN"
    case 404:
      return "NOT_FOUND"
    case 409:
      return "CONFLICT"
    case 429:
      return "RATE_LIMITED"
    case 502:
    case 504:
      return "EXTERNAL_SERVICE_ERROR"
    case 503:
      return "SERVICE_UNAVAILABLE"
    default:
      return "INTERNAL_ERROR"
  }
}

/** Standardized API error envelope. @source */
export type ApiErrorEnvelope = {
  error: string
  code: ApiErrorCode
  details?: unknown
  correlationId?: string
}

/** Options for building an API error response. @source */
export type ApiErrorOptions = {
  /** Machine-readable error code. Derived from status when omitted. @source */
  code?: ApiErrorCode
  /** Optional structured detail payload. @source */
  details?: unknown
  /** Optional extra top-level fields to preserve existing response shapes. @source */
  extra?: Record<string, unknown>
  /** Optional correlation ID to include in the response body and headers. @source */
  correlationId?: string
}

/**
 * Builds a standardized JSON error response for API routes.
 * @param status - HTTP status code.
 * @param error - Human-readable error message.
 * @param options - Optional error code, details, correlation ID, and extra fields.
 * @returns A `NextResponse` JSON object with a consistent error envelope.
 * @source
 */
export const apiError = (
  status: number,
  error: string,
  options?: ApiErrorOptions
) => {
  const extra = options?.extra ?? {}
  const details = options?.details
  const correlationId = options?.correlationId
  const code = options?.code ?? defaultCodeFromStatus(status)

  const body: ApiErrorEnvelope & Record<string, unknown> = {
    ...extra,
    error,
    code,
    ...(details === undefined ? {} : { details }),
    ...(correlationId ? { correlationId } : {})
  }

  const headers: Record<string, string> = correlationId
    ? { "x-correlation-id": correlationId }
    : {}

  if (status === 429 && typeof extra.retryAfterMs === "number") {
    headers["Retry-After"] = String(Math.ceil(extra.retryAfterMs / 1000))
  }

  return NextResponse.json(body, { status, headers })
}

/** Standardized API success envelope. @source */
export type ApiSuccessEnvelope<T> = T

/** Options for building an API success response. @source */
export type ApiSuccessOptions = {
  /** HTTP status code (defaults to 200). @source */
  status?: number
  /** Optional metadata (pagination, timing, etc.). @source */
  meta?: Record<string, unknown>
  /** Optional correlation ID to include in the response headers. @source */
  correlationId?: string
}

/**
 * Builds a standardized JSON success response for API routes.
 * @param data - The response payload.
 * @param options - Optional status, meta, and correlation ID.
 * @returns A `NextResponse` JSON object with a consistent success envelope.
 * @source
 */
export const apiSuccess = <T>(data: T, options?: ApiSuccessOptions) => {
  const meta = options?.meta
  const correlationId = options?.correlationId
  const status = options?.status ?? 200

  const body: ApiSuccessEnvelope<T> =
    meta && data && typeof data === "object" && !Array.isArray(data)
      ? ({ ...data, meta } as ApiSuccessEnvelope<T>)
      : data

  const headers: HeadersInit = correlationId
    ? { "x-correlation-id": correlationId }
    : {}

  return NextResponse.json(body, { status, headers })
}

/**
 * Extracts a safe message from unknown errors.
 * @param error - Unknown thrown value.
 * @param fallback - Fallback message when error is not an Error.
 * @returns A user-safe error message.
 * @source
 */
export const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return fallback
}

/**
 * Safely parses a JSON request body and validates it is a plain object.
 * @returns The parsed body or a 400 error response.
 * @source
 */
export const parseJsonBody = async (
  request: Request
): Promise<Record<string, unknown> | NextResponse> => {
  const contentType = request.headers.get("content-type")
  if (!contentType?.includes("application/json")) {
    return apiError(415, "Unsupported Media Type: Expected application/json")
  }

  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return apiError(400, "Request body must be a JSON object")
    }
    return parsed as Record<string, unknown>
  } catch {
    return apiError(400, "Invalid JSON in request body")
  }
}
