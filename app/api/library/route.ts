import type { SupabaseClient } from "@supabase/supabase-js"
import { type NextRequest } from "next/server"

import { protectedRoute } from "@/lib/api/protected-route"
import { RATE_LIMITS } from "@/lib/api/rate-limit-presets"
import type {
  FetchLibrarySeriesResponse,
  FetchLibraryVolumesResponse,
  PaginationMeta
} from "@/lib/api/types"
import { apiError, apiSuccess } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { logger } from "@/lib/logger"
import type {
  Database,
  OwnershipStatus,
  ReadingStatus,
  TitleType
} from "@/lib/types/database"

export const dynamic = "force-dynamic"

/** Default results per page. @source */
const DEFAULT_LIMIT = 50
/** Maximum allowed results per page. @source */
const MAX_LIMIT = 200
/** Maximum allowed search string length. @source */
const MAX_SEARCH_LENGTH = 200

/** Allowed values for each validated parameter. @source */
const ALLOWED = {
  sortFields: new Set([
    "title",
    "created_at",
    "updated_at",
    "author",
    "rating",
    "volume_count",
    "price"
  ]),
  sortOrders: new Set(["asc", "desc"]),
  types: new Set(["light_novel", "manga", "other", "all"]),
  ownership: new Set(["owned", "wishlist", "all"]),
  reading: new Set([
    "unread",
    "reading",
    "completed",
    "on_hold",
    "dropped",
    "all"
  ]),
  views: new Set(["series", "volumes"])
} as const

/** Parsed and validated library query parameters. @source */
interface LibraryQueryParams {
  page: number
  limit: number
  sortField: string
  sortOrder: "asc" | "desc"
  search: string | null
  type: string | null
  ownershipStatus: string | null
  readingStatus: string | null
  tags: string[]
  excludeTags: string[]
  view: "series" | "volumes"
}

/** Parses a comma-separated string into a trimmed, non-empty array. @source */
function parseCommaSeparated(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
}

/** Parses an integer query param with a default, returning NaN on invalid input. @source */
function parseIntParam(raw: string | null, fallback: number): number {
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

/**
 * Validates a value against an allowed set, returning an error string if invalid.
 * @source
 */
function validateEnum(
  value: string | null,
  allowed: Set<string>,
  label: string
): string | null {
  if (value && !allowed.has(value)) {
    return `${label} must be one of: ${[...allowed].join(", ")}`
  }
  return null
}

/**
 * Parses and validates library query parameters from the request URL.
 * @returns Validated params or a string describing the validation error.
 * @source
 */
function parseLibraryParams(
  searchParams: URLSearchParams
): LibraryQueryParams | string {
  const sortField = searchParams.get("sortField") ?? "title"
  const sortOrder = searchParams.get("sortOrder") ?? "asc"
  const search = searchParams.get("search")?.trim() || null
  const type = searchParams.get("type") || null
  const ownershipStatus = searchParams.get("ownershipStatus") || null
  const readingStatus = searchParams.get("readingStatus") || null
  const view = searchParams.get("view") ?? "series"

  const page = parseIntParam(searchParams.get("page"), 1)
  if (Number.isNaN(page) || page < 1) return "page must be a positive integer"

  const limit = parseIntParam(searchParams.get("limit"), DEFAULT_LIMIT)
  if (Number.isNaN(limit) || limit < 1 || limit > MAX_LIMIT)
    return `limit must be between 1 and ${MAX_LIMIT}`

  if (search && search.length > MAX_SEARCH_LENGTH)
    return `search must be at most ${MAX_SEARCH_LENGTH} characters`

  const enumError =
    validateEnum(sortField, ALLOWED.sortFields, "sortField") ??
    validateEnum(sortOrder, ALLOWED.sortOrders, "sortOrder") ??
    validateEnum(type, ALLOWED.types, "type") ??
    validateEnum(ownershipStatus, ALLOWED.ownership, "ownershipStatus") ??
    validateEnum(readingStatus, ALLOWED.reading, "readingStatus") ??
    validateEnum(view, ALLOWED.views, "view")

  if (enumError) return enumError

  return {
    page,
    limit,
    sortField,
    sortOrder: sortOrder as "asc" | "desc",
    search,
    type: type === "all" ? null : type,
    ownershipStatus: ownershipStatus === "all" ? null : ownershipStatus,
    readingStatus: readingStatus === "all" ? null : readingStatus,
    tags: parseCommaSeparated(searchParams.get("tags")),
    excludeTags: parseCommaSeparated(searchParams.get("excludeTags")),
    view: view as "series" | "volumes"
  }
}

/** Builds the ilike OR filter for search across title, author, description. @source */
function buildSearchFilter(search: string): string {
  const pattern = `%${search}%`
  return `title.ilike.${pattern},author.ilike.${pattern},description.ilike.${pattern}`
}

/** Maps a sort field name to the actual column to order by (series view). @source */
function resolveSeriesSortColumn(sortField: string): string {
  if (sortField === "volume_count") return "total_volumes"
  if (sortField === "price") return "created_at"
  return sortField
}

type SeriesWithVolumes = FetchLibrarySeriesResponse["data"][number]

/**
 * Fetches series IDs that have at least one volume matching the given status filters.
 * Used to move ownership/reading filtering to the database level for accurate pagination.
 * @source
 */
async function resolveVolumeStatusFilter(
  supabase: SupabaseClient<Database>,
  userId: string,
  ownershipStatus: string | null,
  readingStatus: string | null
): Promise<string[] | null> {
  if (!ownershipStatus && !readingStatus) return null

  let query = supabase
    .from("volumes")
    .select("series_id")
    .eq("user_id", userId)
    .not("series_id", "is", null)

  if (ownershipStatus) {
    query = query.eq("ownership_status", ownershipStatus as OwnershipStatus)
  }
  if (readingStatus) {
    query = query.eq("reading_status", readingStatus as ReadingStatus)
  }

  const { data, error } = await query
  if (error) throw new Error(`Volume status filter failed: ${error.message}`)

  const ids = new Set<string>()
  for (const row of data ?? []) {
    if (row.series_id) ids.add(row.series_id)
  }
  return [...ids]
}

/**
 * Applies excluded tags post-filter to series results.
 * Tag array exclusion stays as post-filter since PostgREST doesn't support NOT OVERLAPS.
 * @source
 */
function applyExcludeTagsFilter(
  series: SeriesWithVolumes[],
  excludeTags: string[]
): SeriesWithVolumes[] {
  if (excludeTags.length === 0) return series
  return series.filter((s) => !excludeTags.some((tag) => s.tags.includes(tag)))
}

/**
 * Handles the series view: fetches paginated series with embedded volumes.
 * Uses PostgREST embedded join for single round-trip and DB-level volume status filtering.
 * @source
 */
async function handleSeriesView(
  supabase: SupabaseClient<Database>,
  userId: string,
  params: LibraryQueryParams
): Promise<FetchLibrarySeriesResponse> {
  const { page, limit, sortField, sortOrder, search, type, tags } = params

  // Pre-filter series IDs by volume ownership/reading status at DB level
  const statusSeriesIds = await resolveVolumeStatusFilter(
    supabase,
    userId,
    params.ownershipStatus,
    params.readingStatus
  )

  // If status filter is active but no series match, return empty
  if (statusSeriesIds?.length === 0) {
    return { data: [], pagination: { page, limit, total: 0, totalPages: 1 } }
  }

  let countQuery = supabase
    .from("series")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)

  // Use embedded join to fetch volumes in a single round-trip
  let dataQuery = supabase
    .from("series")
    .select("*, volumes(*)")
    .eq("user_id", userId)
    .order("volume_number", {
      ascending: true,
      referencedTable: "volumes"
    })

  // Apply status-based series ID filter to both queries
  if (statusSeriesIds) {
    countQuery = countQuery.in("id", statusSeriesIds)
    dataQuery = dataQuery.in("id", statusSeriesIds)
  }

  if (search) {
    const orFilter = buildSearchFilter(search)
    countQuery = countQuery.or(orFilter)
    dataQuery = dataQuery.or(orFilter)
  }

  if (type) {
    countQuery = countQuery.eq("type", type as TitleType)
    dataQuery = dataQuery.eq("type", type as TitleType)
  }

  if (tags.length > 0) {
    countQuery = countQuery.contains("tags", tags)
    dataQuery = dataQuery.contains("tags", tags)
  }

  const ascending = sortOrder === "asc"
  const sortColumn = resolveSeriesSortColumn(sortField)
  dataQuery = dataQuery.order(sortColumn, { ascending })

  const { count, error: countError } = await countQuery
  if (countError) throw new Error(`Count query failed: ${countError.message}`)

  const total = count ?? 0
  const offset = (page - 1) * limit

  const { data: seriesData, error: dataError } = await dataQuery.range(
    offset,
    offset + limit - 1
  )
  if (dataError) throw new Error(`Data query failed: ${dataError.message}`)

  const seriesList = (seriesData ?? []) as Array<
    Record<string, unknown> & { volumes: Array<Record<string, unknown>> }
  >

  const merged: SeriesWithVolumes[] = seriesList.map((s) => ({
    id: s.id as string,
    title: s.title as string,
    original_title: s.original_title as string | null,
    description: s.description as string | null,
    notes: s.notes as string | null,
    author: s.author as string | null,
    artist: s.artist as string | null,
    publisher: s.publisher as string | null,
    cover_image_url: s.cover_image_url as string | null,
    type: s.type as string,
    total_volumes: s.total_volumes as number | null,
    status: s.status as string | null,
    tags: s.tags as string[],
    created_at: s.created_at as string,
    updated_at: s.updated_at as string,
    user_id: s.user_id as string,
    volumes: s.volumes ?? []
  }))

  // ExcludeTags stays as post-filter (tag array exclusion not supported in PostgREST)
  const filtered = applyExcludeTagsFilter(merged, params.excludeTags)
  const adjustedTotal = params.excludeTags.length > 0 ? filtered.length : total

  const totalPages = Math.max(1, Math.ceil(adjustedTotal / limit))
  const pagination: PaginationMeta = {
    page,
    limit,
    total: adjustedTotal,
    totalPages
  }

  return { data: filtered, pagination }
}

/**
 * Resolves matching series IDs for volume-view filters (type, tags, search).
 * Returns null if no series-level filters are active.
 * @source
 */
async function resolveSeriesIdFilter(
  supabase: SupabaseClient<Database>,
  userId: string,
  params: LibraryQueryParams
): Promise<string[] | null> {
  const { type, tags, excludeTags, search } = params
  const needsSeriesFilter =
    type || tags.length > 0 || excludeTags.length > 0 || search
  if (!needsSeriesFilter) return null

  let query = supabase
    .from("series")
    .select("id, title, author, type, tags")
    .eq("user_id", userId)

  if (search) query = query.or(buildSearchFilter(search))
  if (type) query = query.eq("type", type as TitleType)
  if (tags.length > 0) query = query.contains("tags", tags)

  const { data, error } = await query
  if (error) throw new Error(`Series filter query failed: ${error.message}`)

  let filtered = data ?? []
  if (excludeTags.length > 0) {
    filtered = filtered.filter(
      (s) => !excludeTags.some((tag) => s.tags.includes(tag))
    )
  }
  return filtered.map((s) => s.id)
}

/** Maps a sort field name to the actual column to order by (volumes view). @source */
function resolveVolumeSortColumn(sortField: string): {
  column: string
  nullsFirst?: boolean
} {
  switch (sortField) {
    case "volume_count":
      return { column: "volume_number" }
    case "price":
      return { column: "purchase_price", nullsFirst: false }
    case "rating":
      return { column: "rating", nullsFirst: false }
    default:
      return { column: sortField }
  }
}

/**
 * Fetches a series lookup map for the given volume data.
 * @source
 */
async function fetchSeriesMap(
  supabase: SupabaseClient<Database>,
  seriesIds: string[]
): Promise<
  Record<
    string,
    {
      id: string
      title: string
      author: string | null
      type: string
      tags: string[]
    }
  >
> {
  const map: Record<
    string,
    {
      id: string
      title: string
      author: string | null
      type: string
      tags: string[]
    }
  > = {}
  if (seriesIds.length === 0) return map

  const { data, error } = await supabase
    .from("series")
    .select("id, title, author, type, tags")
    .in("id", seriesIds)

  if (error) throw new Error(`Series lookup failed: ${error.message}`)

  for (const s of data ?? []) {
    map[s.id] = {
      id: s.id,
      title: s.title,
      author: s.author,
      type: s.type,
      tags: s.tags
    }
  }
  return map
}

/**
 * Handles the volumes view: fetches paginated volumes with series context.
 * @source
 */
async function handleVolumesView(
  supabase: SupabaseClient<Database>,
  userId: string,
  params: LibraryQueryParams
): Promise<FetchLibraryVolumesResponse> {
  const { page, limit, sortOrder } = params

  const seriesIdFilter = await resolveSeriesIdFilter(supabase, userId, params)
  if (seriesIdFilter?.length === 0) {
    return { data: [], pagination: { page, limit, total: 0, totalPages: 1 } }
  }

  let countQuery = supabase
    .from("volumes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)

  let dataQuery = supabase.from("volumes").select("*").eq("user_id", userId)

  if (seriesIdFilter) {
    countQuery = countQuery.in("series_id", seriesIdFilter)
    dataQuery = dataQuery.in("series_id", seriesIdFilter)
  }
  if (params.ownershipStatus) {
    countQuery = countQuery.eq(
      "ownership_status",
      params.ownershipStatus as OwnershipStatus
    )
    dataQuery = dataQuery.eq(
      "ownership_status",
      params.ownershipStatus as OwnershipStatus
    )
  }
  if (params.readingStatus) {
    countQuery = countQuery.eq(
      "reading_status",
      params.readingStatus as ReadingStatus
    )
    dataQuery = dataQuery.eq(
      "reading_status",
      params.readingStatus as ReadingStatus
    )
  }

  const ascending = sortOrder === "asc"
  const sort = resolveVolumeSortColumn(params.sortField)
  dataQuery = dataQuery.order(sort.column, {
    ascending,
    ...(sort.nullsFirst === undefined ? {} : { nullsFirst: sort.nullsFirst })
  })

  const { count, error: countError } = await countQuery
  if (countError) throw new Error(`Count query failed: ${countError.message}`)

  const total = count ?? 0
  const offset = (page - 1) * limit

  const { data: volumeData, error: dataError } = await dataQuery.range(
    offset,
    offset + limit - 1
  )
  if (dataError) throw new Error(`Data query failed: ${dataError.message}`)

  const volumes = volumeData ?? []
  const seriesIds = [
    ...new Set(volumes.map((v) => v.series_id).filter(Boolean))
  ] as string[]

  const seriesMap = await fetchSeriesMap(supabase, seriesIds)
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const pagination: PaginationMeta = { page, limit, total, totalPages }

  const defaultSeries = {
    id: "",
    title: "Unknown",
    author: null,
    type: "other",
    tags: [] as string[]
  }

  return {
    data: volumes.map((v) => ({
      volume: v as Record<string, unknown>,
      series: v.series_id
        ? (seriesMap[v.series_id] ?? defaultSeries)
        : defaultSeries
    })),
    pagination
  }
}

/**
 * Paginated library endpoint with filtering and sorting.
 * Supports both series and volumes views.
 * @param request - Incoming GET request with query parameters.
 * @returns Paginated library data with metadata.
 * @source
 */
export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const auth = await protectedRoute(request, {
      rateLimit: RATE_LIMITS.libraryRead
    })
    if (!auth.ok) return auth.error
    const { user, supabase } = auth

    const params = parseLibraryParams(request.nextUrl.searchParams)
    if (typeof params === "string") {
      return apiError(400, params, { correlationId })
    }

    log.info("Library fetch", {
      view: params.view,
      page: params.page,
      limit: params.limit,
      sortField: params.sortField,
      search: params.search ?? undefined
    })

    const result =
      params.view === "volumes"
        ? await handleVolumesView(supabase, user.id, params)
        : await handleSeriesView(supabase, user.id, params)

    return apiSuccess(result, { correlationId })
  } catch (error) {
    log.error("Library fetch failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to fetch library data", { correlationId })
  }
}
