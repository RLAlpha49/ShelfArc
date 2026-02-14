import { type NextRequest, NextResponse } from "next/server"
import { createUserClient } from "@/lib/supabase/server"
import { apiError } from "@/lib/api-response"
import { getCorrelationId, CORRELATION_HEADER } from "@/lib/correlation"
import { logger } from "@/lib/logger"
import type {
  FetchLibrarySeriesResponse,
  FetchLibraryVolumesResponse,
  PaginationMeta
} from "@/lib/api/types"
import type {
  TitleType,
  OwnershipStatus,
  ReadingStatus
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

type SupabaseClient = Awaited<ReturnType<typeof createUserClient>>

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

/**
 * Fetches volumes grouped by series ID for the given series IDs.
 * @source
 */
async function fetchVolumesBySeries(
  supabase: SupabaseClient,
  seriesIds: string[],
  userId: string
): Promise<Record<string, Array<Record<string, unknown>>>> {
  const result: Record<string, Array<Record<string, unknown>>> = {}
  if (seriesIds.length === 0) return result

  const { data, error } = await supabase
    .from("volumes")
    .select("*")
    .in("series_id", seriesIds)
    .eq("user_id", userId)
    .order("volume_number", { ascending: true })

  if (error) throw new Error(`Volume query failed: ${error.message}`)

  for (const vol of data ?? []) {
    const sid = vol.series_id
    if (!sid) continue
    if (!result[sid]) result[sid] = []
    result[sid].push(vol as Record<string, unknown>)
  }
  return result
}

type SeriesWithVolumes = FetchLibrarySeriesResponse["data"][number]

/**
 * Applies post-query volume filters (ownership/reading status) and excluded tags.
 * @source
 */
function applySeriesPostFilters(
  series: SeriesWithVolumes[],
  params: LibraryQueryParams
): SeriesWithVolumes[] {
  let result = series

  if (params.ownershipStatus) {
    const status = params.ownershipStatus
    result = result
      .filter((s) =>
        s.volumes.some(
          (v) =>
            (v as { ownership_status?: string }).ownership_status === status
        )
      )
      .map((s) => ({
        ...s,
        volumes: s.volumes.filter(
          (v) =>
            (v as { ownership_status?: string }).ownership_status === status
        )
      }))
  }

  if (params.readingStatus) {
    const status = params.readingStatus
    result = result
      .filter((s) =>
        s.volumes.some(
          (v) => (v as { reading_status?: string }).reading_status === status
        )
      )
      .map((s) => ({
        ...s,
        volumes: s.volumes.filter(
          (v) => (v as { reading_status?: string }).reading_status === status
        )
      }))
  }

  if (params.excludeTags.length > 0) {
    result = result.filter(
      (s) => !params.excludeTags.some((tag) => s.tags.includes(tag))
    )
  }

  return result
}

/**
 * Handles the series view: fetches paginated series with their volumes.
 * @source
 */
async function handleSeriesView(
  supabase: SupabaseClient,
  userId: string,
  params: LibraryQueryParams
): Promise<FetchLibrarySeriesResponse> {
  const { page, limit, sortField, sortOrder, search, type, tags } = params

  let countQuery = supabase
    .from("series")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)

  let dataQuery = supabase.from("series").select("*").eq("user_id", userId)

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

  const seriesList = seriesData ?? []
  const volumesBySeries = await fetchVolumesBySeries(
    supabase,
    seriesList.map((s) => s.id),
    userId
  )

  const merged: SeriesWithVolumes[] = seriesList.map((s) => ({
    id: s.id,
    title: s.title,
    original_title: s.original_title,
    description: s.description,
    notes: s.notes,
    author: s.author,
    artist: s.artist,
    publisher: s.publisher,
    cover_image_url: s.cover_image_url,
    type: s.type,
    total_volumes: s.total_volumes,
    status: s.status,
    tags: s.tags,
    created_at: s.created_at,
    updated_at: s.updated_at,
    user_id: s.user_id,
    volumes: volumesBySeries[s.id] ?? []
  }))

  const filtered = applySeriesPostFilters(merged, params)
  const adjustedTotal =
    params.ownershipStatus ||
    params.readingStatus ||
    params.excludeTags.length > 0
      ? filtered.length
      : total

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
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
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
    const supabase = await createUserClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return apiError(401, "Not authenticated", { correlationId })
    }

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

    const response = NextResponse.json(result)
    response.headers.set(CORRELATION_HEADER, correlationId)
    return response
  } catch (error) {
    log.error("Library fetch failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to fetch library data", { correlationId })
  }
}
