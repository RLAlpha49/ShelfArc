import { NextResponse } from "next/server"

/** Standardized API error envelope. @source */
export type ApiErrorEnvelope = {
  error: string
  details?: unknown
}

/** Options for building an API error response. @source */
export type ApiErrorOptions = {
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
 * @param details - Optional structured detail payload.
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

  const body: ApiErrorEnvelope & Record<string, unknown> = {
    ...extra,
    error,
    ...(details === undefined ? {} : { details }),
    ...(correlationId ? { correlationId } : {})
  }

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
