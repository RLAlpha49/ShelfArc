import type { SupabaseClient } from "@supabase/supabase-js"
import { type NextRequest } from "next/server"

import { protectedRoute } from "@/lib/api/protected-route"
import { RATE_LIMITS } from "@/lib/api/rate-limit-presets"
import { apiError, apiSuccess, getErrorMessage } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { parseShelfArcCsv } from "@/lib/csv/parse-shelfarc-csv"
import { logger } from "@/lib/logger"
import {
  sanitizeOptionalHtml,
  sanitizeOptionalPlainText,
  sanitizePlainText
} from "@/lib/sanitize-html"
import type {
  Database,
  SeriesInsert,
  SeriesWithVolumes,
  Volume,
  VolumeInsert
} from "@/lib/types/database"
import {
  isNonNegativeFinite,
  isNonNegativeInteger,
  isPositiveInteger,
  isValidOwnershipStatus,
  isValidReadingStatus,
  isValidSeriesStatus,
  isValidTitleType,
  isValidVolumeEdition,
  isValidVolumeFormat
} from "@/lib/validation"

export const dynamic = "force-dynamic"

/* ─── Constants ─────────────────────────────────────────── */

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_VOLUMES = 10_000

type ImportMode = "merge" | "replace"
type MergeStrategy = "skip" | "overwrite"
type Db = SupabaseClient<Database>

/* ─── Sanitizers ─────────────────────────────────────────── */

function sanitizeSeriesImport(
  s: SeriesWithVolumes,
  userId: string
): SeriesInsert | null {
  const sanitizedTitle = sanitizePlainText(s.title || "", 500)
  if (!sanitizedTitle) return null

  return {
    user_id: userId,
    title: sanitizedTitle,
    type: isValidTitleType(s.type) ? s.type : "other",
    original_title: sanitizeOptionalPlainText(s.original_title, 500),
    description: sanitizeOptionalHtml(s.description),
    author: sanitizeOptionalPlainText(s.author, 1000),
    artist: sanitizeOptionalPlainText(s.artist, 1000),
    publisher: sanitizeOptionalPlainText(s.publisher, 1000),
    cover_image_url: sanitizeOptionalPlainText(s.cover_image_url, 2000),
    total_volumes:
      s.total_volumes != null && isPositiveInteger(s.total_volumes)
        ? s.total_volumes
        : null,
    status: isValidSeriesStatus(s.status) ? s.status : null,
    tags: Array.isArray(s.tags)
      ? s.tags
          .map((tag: unknown) => sanitizePlainText(String(tag ?? ""), 100))
          .filter(Boolean)
      : []
  }
}

function sanitizeVolumeImport(
  v: Volume,
  seriesId: string,
  userId: string
): VolumeInsert | null {
  if (
    typeof v.volume_number !== "number" ||
    !Number.isFinite(v.volume_number) ||
    v.volume_number < 0
  ) {
    return null
  }
  return {
    series_id: seriesId,
    user_id: userId,
    volume_number: v.volume_number,
    title: sanitizeOptionalPlainText(v.title, 500),
    description: sanitizeOptionalHtml(v.description),
    isbn: sanitizeOptionalPlainText(v.isbn, 20),
    cover_image_url: sanitizeOptionalPlainText(v.cover_image_url, 2000),
    ownership_status: isValidOwnershipStatus(v.ownership_status)
      ? v.ownership_status
      : "owned",
    reading_status: isValidReadingStatus(v.reading_status)
      ? v.reading_status
      : "unread",
    current_page:
      v.current_page != null && isNonNegativeInteger(v.current_page)
        ? v.current_page
        : null,
    page_count:
      v.page_count != null && isPositiveInteger(v.page_count)
        ? v.page_count
        : null,
    rating:
      v.rating != null &&
      typeof v.rating === "number" &&
      v.rating >= 0 &&
      v.rating <= 10
        ? v.rating
        : null,
    notes: sanitizeOptionalPlainText(v.notes, 5000),
    publish_date: sanitizeOptionalPlainText(v.publish_date, 20),
    purchase_date: sanitizeOptionalPlainText(v.purchase_date, 20),
    purchase_price:
      v.purchase_price != null && isNonNegativeFinite(v.purchase_price)
        ? v.purchase_price
        : null,
    edition: isValidVolumeEdition(v.edition) ? v.edition : null,
    format: isValidVolumeFormat(v.format) ? v.format : null,
    amazon_url: sanitizeOptionalPlainText(v.amazon_url, 2000)
  }
}

/* ─── JSON import helpers ─────────────────────────────────── */

function parseImportJson(content: string): SeriesWithVolumes[] {
  const parsed: unknown = JSON.parse(content)

  if (Array.isArray(parsed)) {
    return parsed as SeriesWithVolumes[]
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    "series" in parsed &&
    "volumes" in parsed
  ) {
    const obj = parsed as { series: unknown; volumes: unknown }
    if (!Array.isArray(obj.series))
      throw new TypeError("Invalid JSON format: 'series' must be an array")
    if (!Array.isArray(obj.volumes))
      throw new TypeError("Invalid JSON format: 'volumes' must be an array")

    const seriesList = obj.series as Record<string, unknown>[]
    const volumesList = obj.volumes as Volume[]

    const volumesBySeries = new Map<string, Volume[]>()
    for (const v of volumesList) {
      const sid = v.series_id
      if (sid) {
        const existing = volumesBySeries.get(sid) ?? []
        existing.push(v)
        volumesBySeries.set(sid, existing)
      }
    }

    return seriesList.map((s) => {
      const id = s.id as string
      return {
        ...s,
        volumes: volumesBySeries.get(id) ?? []
      } as SeriesWithVolumes
    })
  }

  throw new TypeError(
    "Invalid JSON format: expected an array of series or { series, volumes }"
  )
}

function validateImportVolume(
  v: unknown,
  seriesIndex: number,
  volumeIndex: number
): void {
  if (!v || typeof v !== "object")
    throw new TypeError(
      `Invalid volume at series ${seriesIndex}, volume ${volumeIndex}`
    )
  const vol = v as Record<string, unknown>
  if (
    typeof vol.volume_number !== "number" ||
    !Number.isFinite(vol.volume_number)
  )
    throw new TypeError(
      `Invalid volume_number at series ${seriesIndex}, volume ${volumeIndex}`
    )
}

function validateImportItem(item: unknown, index: number): void {
  if (!item || typeof item !== "object")
    throw new TypeError(`Invalid item at index ${index}: expected an object`)
  const record = item as Record<string, unknown>
  if (!record.title || typeof record.title !== "string")
    throw new TypeError(`Invalid item at index ${index}: title is required`)
  if (record.volumes !== undefined && !Array.isArray(record.volumes))
    throw new TypeError(
      `Invalid item at index ${index}: volumes must be an array`
    )
  if (Array.isArray(record.volumes)) {
    for (let j = 0; j < record.volumes.length; j++) {
      validateImportVolume(record.volumes[j], index, j)
    }
  }
}

function validateImportStructure(data: unknown[]): void {
  for (let i = 0; i < data.length; i++) {
    validateImportItem(data[i], i)
  }
}

/* ─── JSON import helpers ────────────────────────────────── */

type SeriesPair = { insert: SeriesInsert; original: SeriesWithVolumes }

function collectVolumeInserts(
  sources: { seriesId: string; original: SeriesWithVolumes }[],
  userId: string
): VolumeInsert[] {
  const result: VolumeInsert[] = []
  for (const { seriesId, original } of sources) {
    if (!original.volumes?.length) continue
    for (const v of original.volumes) {
      const vi = sanitizeVolumeImport(v, seriesId, userId)
      if (vi) result.push(vi)
    }
  }
  return result
}

async function insertVolumes(
  supabase: Db,
  volumes: VolumeInsert[]
): Promise<void> {
  if (volumes.length === 0) return
  const { error } = await supabase.from("volumes").insert(volumes)
  if (error) throw new Error("Failed to import volumes")
}

async function runReplaceImport(
  seriesPairs: SeriesPair[],
  userId: string,
  supabase: Db
): Promise<string> {
  await supabase.from("volumes").delete().eq("user_id", userId)
  await supabase.from("series").delete().eq("user_id", userId)

  const { data: insertedSeries, error } = await supabase
    .from("series")
    .insert(seriesPairs.map((p) => p.insert))
    .select("id")

  if (error || !insertedSeries) throw new Error("Failed to import series")

  const allVolumes = collectVolumeInserts(
    insertedSeries.map((s, i) => ({
      seriesId: s.id,
      original: seriesPairs[i].original
    })),
    userId
  )
  await insertVolumes(supabase, allVolumes)

  return `Imported ${insertedSeries.length.toLocaleString()} series with ${allVolumes.length.toLocaleString()} volumes`
}

async function fetchExistingVolumeLookup(
  supabase: Db,
  userId: string
): Promise<Map<string, true>> {
  const { data, error } = await supabase
    .from("volumes")
    .select("series_id, volume_number, edition")
    .eq("user_id", userId)
  if (error) throw new Error("Failed to read existing volumes")
  const lookup = new Map<string, true>()
  for (const ev of data ?? []) {
    lookup.set(
      `${ev.series_id}::${ev.volume_number}::${ev.edition ?? ""}`,
      true
    )
  }
  return lookup
}

async function runMergeImport(
  seriesPairs: SeriesPair[],
  mergeStrategy: MergeStrategy,
  userId: string,
  supabase: Db
): Promise<string> {
  const { data: existingSeries, error: fetchError } = await supabase
    .from("series")
    .select("id, title, type")
    .eq("user_id", userId)
  if (fetchError) throw new Error("Failed to read existing collection")

  const existingMap = new Map<string, string>()
  for (const s of existingSeries ?? []) {
    existingMap.set(`${s.title.toLowerCase()}::${s.type}`, s.id)
  }

  const newPairs: SeriesPair[] = []
  const matchedPairs: { existingId: string; original: SeriesWithVolumes }[] = []
  for (const pair of seriesPairs) {
    const key = `${pair.insert.title.toLowerCase()}::${pair.insert.type}`
    const existingId = existingMap.get(key)
    if (existingId) matchedPairs.push({ existingId, original: pair.original })
    else newPairs.push(pair)
  }

  let newSeriesIds: { id: string }[] = []
  if (newPairs.length > 0) {
    const { data, error } = await supabase
      .from("series")
      .insert(newPairs.map((p) => p.insert))
      .select("id")
    if (error || !data) throw new Error("Failed to import new series")
    newSeriesIds = data
  }

  const volumeSources = [
    ...newSeriesIds.map((s, i) => ({
      seriesId: s.id,
      original: newPairs[i].original
    })),
    ...matchedPairs.map((m) => ({
      seriesId: m.existingId,
      original: m.original
    }))
  ]
  const allVolumes = collectVolumeInserts(volumeSources, userId)

  if (allVolumes.length > 0) {
    const existingLookup = await fetchExistingVolumeLookup(supabase, userId)
    const toInsert = allVolumes.filter(
      (vol) =>
        !existingLookup.has(
          `${vol.series_id}::${vol.volume_number}::${vol.edition ?? ""}`
        )
    )
    await insertVolumes(supabase, toInsert)
  }

  const stratLabel =
    mergeStrategy === "skip" ? " (skip duplicates)" : " (overwrite)"
  return `Imported ${newPairs.length.toLocaleString()} new series, merged ${matchedPairs.length.toLocaleString()} existing (${allVolumes.length.toLocaleString()} volumes processed${stratLabel})`
}

/* ─── JSON import logic ──────────────────────────────────── */

async function handleJsonImport(
  content: string,
  mode: ImportMode,
  mergeStrategy: MergeStrategy,
  userId: string,
  supabase: Db
): Promise<string> {
  const data = parseImportJson(content)
  validateImportStructure(data)

  const totalVolumes = data.reduce(
    (sum, s) => sum + (s.volumes?.length ?? 0),
    0
  )
  if (totalVolumes > MAX_VOLUMES) {
    throw new Error(
      `Import too large: maximum ${MAX_VOLUMES.toLocaleString()} volumes allowed (got ${totalVolumes.toLocaleString()})`
    )
  }

  const seriesPairs: SeriesPair[] = []
  for (const s of data) {
    const insert = sanitizeSeriesImport(s, userId)
    if (insert) seriesPairs.push({ insert, original: s })
  }

  if (seriesPairs.length === 0) {
    throw new Error(
      "No valid series found. Ensure each series in the file has a title."
    )
  }

  return mode === "replace"
    ? runReplaceImport(seriesPairs, userId, supabase)
    : runMergeImport(seriesPairs, mergeStrategy, userId, supabase)
}

/* ─── ShelfArc CSV import helpers ───────────────────────── */

type CsvSeriesGroup = {
  seriesTitle: string
  seriesType: string
  author: string
  publisher: string
  rows: ReturnType<typeof parseShelfArcCsv>
}

function groupCsvRowsBySeries(
  rows: ReturnType<typeof parseShelfArcCsv>
): Map<string, CsvSeriesGroup> {
  const map = new Map<string, CsvSeriesGroup>()
  for (const row of rows) {
    const key = `${row.seriesTitle.toLowerCase()}::${row.seriesType.toLowerCase()}`
    if (!map.has(key)) {
      map.set(key, {
        seriesTitle: row.seriesTitle,
        seriesType: row.seriesType,
        author: row.author,
        publisher: row.publisher,
        rows: []
      })
    }
    map.get(key)!.rows.push(row)
  }
  return map
}

function buildVolumeInsert(
  row: ReturnType<typeof parseShelfArcCsv>[number],
  seriesId: string,
  userId: string
): VolumeInsert {
  return {
    series_id: seriesId,
    user_id: userId,
    volume_number: row.volumeNumber,
    title: sanitizeOptionalPlainText(row.volumeTitle, 500),
    description: sanitizeOptionalPlainText(row.volumeDescription, 5000),
    isbn: sanitizeOptionalPlainText(row.isbn, 20),
    ownership_status: row.ownershipStatus,
    reading_status: row.readingStatus,
    page_count: row.pageCount,
    rating: row.rating,
    notes: sanitizeOptionalPlainText(row.notes, 5000),
    publish_date: row.publishDate,
    purchase_date: row.purchaseDate,
    purchase_price: row.purchasePrice,
    edition: isValidVolumeEdition(row.edition) ? row.edition : null,
    format: isValidVolumeFormat(row.format) ? row.format : null
  }
}

async function ensureCsvSeries(
  group: CsvSeriesGroup,
  existingSeriesMap: Map<string, string>,
  userId: string,
  supabase: Db
): Promise<string | null> {
  const seriesKey = `${group.seriesTitle.toLowerCase()}::${group.seriesType.toLowerCase()}`
  const existing = existingSeriesMap.get(seriesKey)
  if (existing) return existing

  const title = sanitizePlainText(group.seriesTitle, 500)
  if (!title) return null

  const seriesInsert: SeriesInsert = {
    user_id: userId,
    title,
    type: isValidTitleType(group.seriesType) ? group.seriesType : "other",
    author: sanitizeOptionalPlainText(group.author, 1000),
    publisher: sanitizeOptionalPlainText(group.publisher, 1000),
    tags: []
  }

  const { data, error } = await supabase
    .from("series")
    .insert(seriesInsert)
    .select("id")
    .single()

  if (error || !data)
    throw new Error(`Failed to create series: ${group.seriesTitle}`)

  existingSeriesMap.set(seriesKey, data.id)
  return data.id
}

async function processCsvGroup(
  group: CsvSeriesGroup,
  existingSeriesMap: Map<string, string>,
  existingVolumeLookup: Map<string, string>,
  mergeStrategy: MergeStrategy,
  userId: string,
  supabase: Db
): Promise<{
  toUpsert: (VolumeInsert & { id?: string })[]
  created: number
  skipped: number
}> {
  const seriesId = await ensureCsvSeries(
    group,
    existingSeriesMap,
    userId,
    supabase
  )
  if (!seriesId) return { toUpsert: [], created: 0, skipped: 0 }

  let created = 0
  let skipped = 0
  const toUpsert: (VolumeInsert & { id?: string })[] = []

  for (const row of group.rows) {
    const volumeKey = `${seriesId}::${row.volumeNumber}::${row.edition ?? ""}`
    const existingId = existingVolumeLookup.get(volumeKey)

    if (existingId && mergeStrategy === "skip") {
      skipped++
      continue
    }

    const volumeData = buildVolumeInsert(row, seriesId, userId)

    if (existingId) {
      toUpsert.push({ ...volumeData, id: existingId })
    } else {
      toUpsert.push(volumeData)
      existingVolumeLookup.set(volumeKey, "inserted")
      created++
    }
  }

  return { toUpsert, created, skipped }
}

/* ─── ShelfArc CSV import logic ──────────────────────────── */

async function handleCsvImport(
  content: string,
  mode: ImportMode,
  mergeStrategy: MergeStrategy,
  userId: string,
  supabase: Db
): Promise<string> {
  const rows = parseShelfArcCsv(content)

  if (rows.length === 0) {
    throw new Error(
      "No valid data found in CSV. Ensure the file uses ShelfArc export format."
    )
  }
  if (rows.length > MAX_VOLUMES) {
    throw new Error(
      `Import too large: maximum ${MAX_VOLUMES.toLocaleString()} volumes allowed (got ${rows.length.toLocaleString()})`
    )
  }

  const seriesMap = groupCsvRowsBySeries(rows)

  if (mode === "replace") {
    await supabase.from("volumes").delete().eq("user_id", userId)
    await supabase.from("series").delete().eq("user_id", userId)
  }

  const { data: existingSeries, error: fetchError } = await supabase
    .from("series")
    .select("id, title, type")
    .eq("user_id", userId)
  if (fetchError) throw new Error("Failed to read existing collection")

  const existingSeriesMap = new Map<string, string>()
  for (const s of existingSeries ?? []) {
    existingSeriesMap.set(`${s.title.toLowerCase()}::${s.type}`, s.id)
  }

  const { data: existingVolumes, error: volFetchError } = await supabase
    .from("volumes")
    .select("id, series_id, volume_number, edition")
    .eq("user_id", userId)
  if (volFetchError) throw new Error("Failed to read existing volumes")

  const existingVolumeLookup = new Map<string, string>()
  for (const ev of existingVolumes ?? []) {
    existingVolumeLookup.set(
      `${ev.series_id}::${ev.volume_number}::${ev.edition ?? ""}`,
      ev.id
    )
  }

  let totalCreatedSeries = 0
  let totalCreatedVolumes = 0
  let totalSkipped = 0
  const allToUpsert: (VolumeInsert & { id?: string })[] = []

  for (const [, group] of seriesMap) {
    const seriesKey = `${group.seriesTitle.toLowerCase()}::${group.seriesType.toLowerCase()}`
    const hadSeriesBefore = existingSeriesMap.has(seriesKey)
    const { toUpsert, created, skipped } = await processCsvGroup(
      group,
      existingSeriesMap,
      existingVolumeLookup,
      mergeStrategy,
      userId,
      supabase
    )
    if (!hadSeriesBefore && existingSeriesMap.has(seriesKey))
      totalCreatedSeries++
    allToUpsert.push(...toUpsert)
    totalCreatedVolumes += created
    totalSkipped += skipped
  }

  for (let i = 0; i < allToUpsert.length; i += 500) {
    const batch = allToUpsert.slice(i, i + 500)
    const { error } = await supabase
      .from("volumes")
      .upsert(batch, { onConflict: "id" })
    if (error) throw new Error("Failed to import volumes")
  }

  const actionLabel = mode === "replace" ? "Replaced" : "Merged"
  const skipNote =
    totalSkipped > 0 ? `, ${totalSkipped.toLocaleString()} skipped` : ""
  return `${actionLabel} collection: ${totalCreatedSeries.toLocaleString()} new series, ${totalCreatedVolumes.toLocaleString()} new volumes${skipNote}`
}

/* ─── Route handler ──────────────────────────────────────── */

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const result = await protectedRoute(request, {
      csrf: true,
      rateLimit: RATE_LIMITS.importWrite
    })
    if (!result.ok) return result.error
    const { user, supabase } = result

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return apiError(400, "Expected multipart/form-data", { correlationId })
    }

    const file = formData.get("file")
    if (!(file instanceof File)) {
      return apiError(400, "Missing required field: file", { correlationId })
    }
    if (file.size === 0) {
      return apiError(400, "File is empty", { correlationId })
    }
    if (file.size > MAX_FILE_SIZE) {
      return apiError(400, "File too large (max 10 MB)", { correlationId })
    }

    const modeRaw = formData.get("mode")
    const mode: ImportMode = modeRaw === "replace" ? "replace" : "merge"

    const mergeStrategyRaw = formData.get("mergeStrategy")
    const mergeStrategy: MergeStrategy =
      mergeStrategyRaw === "skip" ? "skip" : "overwrite"

    const content = await file.text()
    const filename = file.name.toLowerCase()

    let summary: string
    if (filename.endsWith(".json")) {
      summary = await handleJsonImport(
        content,
        mode,
        mergeStrategy,
        user.id,
        supabase
      )
    } else if (
      filename.endsWith(".csv") ||
      filename.endsWith(".tsv") ||
      filename.endsWith(".txt")
    ) {
      summary = await handleCsvImport(
        content,
        mode,
        mergeStrategy,
        user.id,
        supabase
      )
    } else {
      return apiError(
        400,
        "Unsupported file type. Upload a .json or .csv file",
        { correlationId }
      )
    }

    return apiSuccess({ summary }, { correlationId })
  } catch (err) {
    const message = getErrorMessage(err, "Unknown error")
    // Surface user-visible validation errors as 400 rather than 500
    if (
      err instanceof TypeError ||
      err instanceof SyntaxError ||
      message.startsWith("No valid") ||
      message.startsWith("Import too large") ||
      message.startsWith("Failed to create series") ||
      message.startsWith("Unsupported")
    ) {
      return apiError(400, message, { correlationId })
    }
    log.error("POST /api/library/import failed", { error: message })
    return apiError(500, "Internal server error", { correlationId })
  }
}
