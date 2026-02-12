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

  const body: ApiErrorEnvelope & Record<string, unknown> = {
    ...extra,
    error,
    ...(details === undefined ? {} : { details })
  }
  return NextResponse.json(body, { status })
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
