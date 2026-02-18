/**
 * Parsed and validated pagination parameters. @source
 */
export interface PaginationParams {
  /** 1-based page number. */
  page: number
  /** Number of records per page. */
  limit: number
  /** Zero-based start offset for range queries. */
  from: number
  /** Inclusive end offset for range queries. */
  to: number
}

/**
 * Defaults and upper bounds for parsePagination.
 */
interface PaginationDefaults {
  /** Default number of items per page (default: 20). */
  defaultLimit?: number
  /** Maximum allowed items per page (default: 100). */
  maxLimit?: number
}

/**
 * Parses and validates `page` and `limit` query parameters from a URLSearchParams object.
 *
 * Returns safe, bounded values with precomputed `from`/`to` offsets suitable for
 * Supabase `.range(from, to)` calls.
 *
 * Centralizes pagination parsing that was previously repeated across multiple API routes.
 *
 * @param searchParams - The request URLSearchParams.
 * @param defaults - Optional defaults and upper bounds.
 * @source
 */
export function parsePagination(
  searchParams: URLSearchParams,
  { defaultLimit = 20, maxLimit = 100 }: PaginationDefaults = {}
): PaginationParams {
  const page = Math.max(1, Number(searchParams.get("page")) || 1)
  const limit = Math.min(
    maxLimit,
    Math.max(1, Number(searchParams.get("limit")) || defaultLimit)
  )
  const from = (page - 1) * limit
  const to = from + limit - 1
  return { page, limit, from, to }
}
