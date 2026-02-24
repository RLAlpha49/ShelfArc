import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

/** Generic JSON-compatible record type. @source */
type JsonRecord = Record<string, unknown>

/** Metadata describing the contents and scope of a backup snapshot. @source */
type BackupMetadata = {
  createdAt: string
  tableCount: number
  rowCounts: Record<string, number>
  tableTruncated: Record<string, boolean>
}

/** Full backup payload containing metadata and table data. @source */
type BackupPayload = {
  metadata: BackupMetadata
  tables: Record<string, unknown[]>
}

/** Alias for the Supabase client return type. @source */
type SupabaseClient = ReturnType<typeof createClient>

/** Discriminated union for success/error outcomes used throughout the backup flow. @source */
type Result<T> =
  | { data: T; error?: never; details?: never; status?: never }
  | { data?: never; error: string; details?: string; status?: number }

/**
 * Creates a JSON Response with the given status and body.
 * @param status - HTTP status code.
 * @param body - JSON-serializable response body.
 * @returns A Response with JSON content-type.
 * @source
 */
const jsonResponse = (status: number, body: JsonRecord) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  })

/**
 * Reads a Deno environment variable with an optional fallback.
 * @param key - Environment variable name.
 * @param fallback - Default value if the variable is unset or empty.
 * @returns The variable value or fallback.
 * @source
 */
function getEnv(key: string): string | undefined
function getEnv(key: string, fallback: string): string
function getEnv(key: string, fallback?: string) {
  const value = Deno.env.get(key)
  if (value === undefined || value.trim() === "") {
    return fallback
  }
  return value
}

/**
 * Parses a string to an integer, returning a fallback for invalid or missing values.
 * @param value - String to parse.
 * @param fallback - Default if parsing fails.
 * @returns The parsed integer or fallback.
 * @source
 */
const toInt = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * Splits a comma-separated string into a trimmed, non-empty array of values.
 * @param value - Comma-separated input string.
 * @returns Array of parsed entries.
 * @source
 */
const parseCsv = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)

/**
 * Formats a Date into a compact ISO-8601 timestamp suitable for filenames.
 * @param date - The date to format.
 * @returns A string like `20260210T120000Z`.
 * @source
 */
const formatTimestamp = (date: Date) =>
  date
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z")

/**
 * Compresses a JSON string using gzip and returns the result as a Blob.
 * @param json - Raw JSON string to compress.
 * @returns A gzip-compressed Blob.
 * @source
 */
const gzipJson = async (json: string) => {
  const encoder = new TextEncoder()
  const stream = new Blob([encoder.encode(json)], {
    type: "application/json"
  })
    .stream()
    .pipeThrough(new CompressionStream("gzip"))
  return await new Response(stream).blob()
}

/**
 * Validates the request by requiring the BACKUP_SECRET header.
 * JWT Bearer tokens are not accepted — this endpoint is admin-only.
 * @param request - Incoming HTTP request.
 * @returns An object with `ok: true` on success, or `ok: false` with a `reason` string.
 * @source
 */
const requireAuthorization = (request: Request) => {
  const requiredSecret = getEnv("BACKUP_SECRET")
  if (!requiredSecret) {
    console.error(
      "[backup-db] BACKUP_SECRET is not configured; denying all requests."
    )
    return {
      ok: false,
      reason: "Backup endpoint is not configured."
    }
  }

  const providedSecret = request.headers.get("x-backup-secret") ?? ""
  if (providedSecret !== requiredSecret) {
    console.warn(
      "[backup-db] Unauthorized backup attempt — invalid x-backup-secret header."
    )
    return {
      ok: false,
      reason: "Missing or invalid x-backup-secret header."
    }
  }

  return { ok: true }
}

/**
 * Paginates through all objects in a Supabase Storage bucket under a given prefix.
 * @param supabase - Supabase client.
 * @param bucket - Storage bucket name.
 * @param prefix - Path prefix to list within.
 * @returns All matching storage objects or an error.
 * @source
 */
const listAllStorageObjects = async (
  supabase: SupabaseClient,
  bucket: string,
  prefix: string
) => {
  const allItems: { name: string; metadata?: { size?: number } }[] = []
  let offset = 0
  const limit = 1000

  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit, offset })

    if (error) {
      return { data: null, error }
    }

    if (!data || data.length === 0) {
      break
    }

    allItems.push(
      ...data.map((item: { name: string; metadata?: { size?: number } }) => ({
        name: item.name,
        metadata: item.metadata as { size?: number } | undefined
      }))
    )

    if (data.length < limit) {
      break
    }

    offset += data.length
  }

  return { data: allItems, error: null } as const
}

/**
 * Resolves the list of database tables to back up, using an allow-list or an RPC helper.
 * @param supabase - Supabase client.
 * @param allowList - Explicit table names to include (takes priority over RPC discovery).
 * @param excludeList - Table names to exclude from backup.
 * @returns A Result containing the filtered table name array.
 * @source
 */
const resolveTables = async (
  supabase: SupabaseClient,
  allowList: string[],
  excludeList: Set<string>
): Promise<Result<string[]>> => {
  let tables: string[] = []

  if (allowList.length > 0) {
    tables = allowList
  } else {
    const { data, error } = await supabase.rpc<unknown[]>("backup_list_tables")
    if (error) {
      return {
        error:
          "Failed to list tables. Either define BACKUP_TABLES or create the backup_list_tables() SQL helper.",
        details: error.message,
        status: 500
      }
    }

    const tableData = Array.isArray(data) ? data : []
    tables = tableData
      .map((entry): string => {
        if (typeof entry === "string") {
          return entry
        }
        if (
          entry &&
          typeof entry === "object" &&
          "tablename" in entry &&
          typeof (entry as { tablename?: unknown }).tablename === "string"
        ) {
          return (entry as { tablename?: string }).tablename ?? ""
        }
        return ""
      })
      .filter(Boolean)
  }

  tables = tables.filter((table) => !excludeList.has(table))

  if (tables.length === 0) {
    return {
      error: "No tables selected for backup.",
      status: 400
    }
  }

  return { data: tables }
}

/** Configuration options for paginated table data fetching. @source */
type FetchTableOptions = {
  maxRowsPerTable?: number
  maxTotalRows?: number
  hardRowLimit?: number
  onPage?: (
    table: string,
    rows: unknown[],
    info: { offset: number; tableRows: number; totalRows: number }
  ) => void | Promise<void>
}

/** Result of evaluating a single page of rows against configured row limits. @source */
type PageEvaluation = {
  pageRows: unknown[]
  truncated: boolean
  stopTable: boolean
  stopAll: boolean
  nextTableRows: number
  nextTotalRows: number
}

/**
 * Evaluates a fetched page of rows against per-table and global row limits.
 * @param input - Page data and current counters.
 * @returns Evaluation result indicating which rows to keep and whether to stop.
 * @source
 */
const evaluatePage = (input: {
  data: unknown[]
  pageSize: number
  tableRows: number
  totalRows: number
  maxRowsPerTable: number
  maxTotalRows: number
}): PageEvaluation => {
  const {
    data,
    pageSize,
    tableRows,
    totalRows,
    maxRowsPerTable,
    maxTotalRows
  } = input

  const remainingForTable =
    maxRowsPerTable > 0 ? maxRowsPerTable - tableRows : Number.POSITIVE_INFINITY
  const remainingGlobal =
    maxTotalRows > 0 ? maxTotalRows - totalRows : Number.POSITIVE_INFINITY
  const remaining = Math.min(remainingForTable, remainingGlobal)

  if (remaining <= 0) {
    return {
      pageRows: [],
      truncated: true,
      stopTable: true,
      stopAll: maxTotalRows > 0 && totalRows >= maxTotalRows,
      nextTableRows: tableRows,
      nextTotalRows: totalRows
    }
  }

  const pageRows = data.length > remaining ? data.slice(0, remaining) : data
  const nextTableRows = tableRows + pageRows.length
  const nextTotalRows = totalRows + pageRows.length
  const stopByPage = data.length < pageSize
  const limitReached =
    (maxRowsPerTable > 0 && nextTableRows >= maxRowsPerTable) ||
    (maxTotalRows > 0 && nextTotalRows >= maxTotalRows)
  const truncatedBySlice = pageRows.length < data.length
  const truncatedByLimit = limitReached && !stopByPage
  const truncated = truncatedBySlice || truncatedByLimit
  const stopTable = truncated || stopByPage || limitReached

  return {
    pageRows,
    truncated,
    stopTable,
    stopAll: maxTotalRows > 0 && nextTotalRows >= maxTotalRows,
    nextTableRows,
    nextTotalRows
  }
}

/**
 * Fetches all rows for a single table with pagination and row-limit enforcement.
 * @param input - Table name, client, pagination settings, and row limit configuration.
 * @returns Row count, truncation status, and updated global totals, or an error.
 * @source
 */
const fetchTableRows = async (input: {
  supabase: SupabaseClient
  table: string
  pageSize: number
  onPage: (
    table: string,
    rows: unknown[],
    info: { offset: number; tableRows: number; totalRows: number }
  ) => void | Promise<void>
  maxRowsPerTable: number
  maxTotalRows: number
  hardRowLimit: number
  totalRows: number
}): Promise<
  Result<{
    rowCount: number
    truncated: boolean
    stopAll: boolean
    totalRows: number
  }>
> => {
  const {
    supabase,
    table,
    pageSize,
    onPage,
    maxRowsPerTable,
    maxTotalRows,
    hardRowLimit
  } = input
  let totalRows = input.totalRows
  let tableRows = 0
  let truncated = false
  let stopAll = false

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(offset, offset + pageSize - 1)

    if (error) {
      return {
        error: `Failed to fetch rows for table ${table}.`,
        details: error.message,
        status: 500
      }
    }

    if (!data || data.length === 0) {
      break
    }

    const evaluation = evaluatePage({
      data,
      pageSize,
      tableRows,
      totalRows,
      maxRowsPerTable,
      maxTotalRows
    })

    if (evaluation.pageRows.length === 0) {
      truncated = true
      stopAll = evaluation.stopAll
      break
    }

    const nextTableRows = evaluation.nextTableRows
    const nextTotalRows = evaluation.nextTotalRows
    truncated = truncated || evaluation.truncated
    stopAll = evaluation.stopAll

    if (hardRowLimit > 0 && nextTableRows > hardRowLimit) {
      return {
        error: `Table ${table} exceeds hard row limit (${hardRowLimit}).`,
        details:
          "Enable streaming mode or increase BACKUP_HARD_ROW_LIMIT to proceed with large tables.",
        status: 413
      }
    }

    await onPage(table, evaluation.pageRows, {
      offset,
      tableRows,
      totalRows
    })

    tableRows = nextTableRows
    totalRows = nextTotalRows

    if (evaluation.stopTable) {
      break
    }
  }

  return {
    data: {
      rowCount: tableRows,
      truncated,
      stopAll,
      totalRows
    }
  }
}

/**
 * Fetches data for all specified tables, respecting row limits and page size.
 * @param supabase - Supabase client.
 * @param tables - List of table names to export.
 * @param pageSize - Number of rows per paginated fetch.
 * @param options - Row limit and callback configuration.
 * @returns Combined table data, row counts, and truncation flags, or an error.
 * @source
 */
const fetchTableData = async (
  supabase: SupabaseClient,
  tables: string[],
  pageSize: number,
  options: FetchTableOptions = {}
): Promise<
  Result<{
    tableData: Record<string, unknown[]>
    rowCounts: Record<string, number>
    tableTruncated: Record<string, boolean>
  }>
> => {
  const tableData: Record<string, unknown[]> = {}
  const rowCounts: Record<string, number> = {}
  const tableTruncated: Record<string, boolean> = {}
  const useDefaultSink = !options.onPage
  const onPage =
    options.onPage ??
    ((table: string, rows: unknown[]) => {
      if (!tableData[table]) {
        tableData[table] = []
      }
      tableData[table].push(...rows)
    })
  const maxRowsPerTable = Math.max(0, options.maxRowsPerTable ?? 0)
  const maxTotalRows = Math.max(0, options.maxTotalRows ?? 0)
  const hardRowLimit = Math.max(0, options.hardRowLimit ?? 0)
  let totalRows = 0
  let stopAll = false

  for (const table of tables) {
    if (stopAll) {
      tableTruncated[table] = true
      rowCounts[table] = 0
      if (useDefaultSink) {
        tableData[table] = []
      }
      continue
    }

    if (useDefaultSink) {
      tableData[table] = []
    }

    const tableResult = await fetchTableRows({
      supabase,
      table,
      pageSize,
      onPage,
      maxRowsPerTable,
      maxTotalRows,
      hardRowLimit,
      totalRows
    })

    if (!tableResult.data) {
      return tableResult
    }

    rowCounts[table] = tableResult.data.rowCount
    tableTruncated[table] = tableResult.data.truncated
    totalRows = tableResult.data.totalRows
    stopAll = tableResult.data.stopAll
  }

  return { data: { tableData, rowCounts, tableTruncated } }
}

/**
 * Uploads a gzip-compressed backup to Supabase Storage, retrying with a UUID suffix on conflict.
 * @param supabase - Supabase client.
 * @param bucket - Storage bucket name.
 * @param prefix - Path prefix for the backup file.
 * @param payload - Backup data to serialize and upload.
 * @param createdAt - Timestamp used for the backup filename.
 * @returns The final storage path on success, or an error.
 * @source
 */
const uploadBackup = async (
  supabase: SupabaseClient,
  bucket: string,
  prefix: string,
  payload: BackupPayload,
  createdAt: Date
): Promise<Result<string>> => {
  const backupBlob = await gzipJson(JSON.stringify(payload))
  const timestamp = formatTimestamp(createdAt)
  let backupPath = `${prefix}/${timestamp}.json.gz`

  const initialUpload = await supabase.storage
    .from(bucket)
    .upload(backupPath, backupBlob, {
      contentType: "application/gzip",
      upsert: false
    })

  if (initialUpload.error) {
    const errorMessage = initialUpload.error.message.toLowerCase()
    const errorStatus =
      (initialUpload.error as { statusCode?: number; status?: number })
        .statusCode ??
      (initialUpload.error as { statusCode?: number; status?: number }).status
    const hasStatus = typeof errorStatus === "number"
    // Supabase reports conflicts via a 409 status code; treat it as authoritative.
    // Fall back to message heuristics when no numeric status is available.
    const isConflict =
      errorStatus === 409 ||
      (!hasStatus &&
        (errorMessage.includes("already exists") ||
          errorMessage.includes("duplicate") ||
          errorMessage.includes("conflict")))

    if (!isConflict) {
      return {
        error: "Failed to upload backup file.",
        details: initialUpload.error.message,
        status: typeof errorStatus === "number" ? errorStatus : 500
      }
    }

    // Append a UUID to avoid filename collisions on timestamp conflict.
    const fallbackPath = `${prefix}/${timestamp}-${crypto.randomUUID()}.json.gz`
    const retryUpload = await supabase.storage
      .from(bucket)
      .upload(fallbackPath, backupBlob, {
        contentType: "application/gzip",
        upsert: false
      })

    if (retryUpload.error) {
      return {
        error: "Failed to upload backup file.",
        details: retryUpload.error.message,
        status: 500
      }
    }

    backupPath = fallbackPath
  }

  return { data: backupPath }
}

/**
 * Deletes old backups exceeding the configured count and total size limits.
 * @param supabase - Supabase client.
 * @param bucket - Storage bucket name.
 * @param prefix - Path prefix where backups are stored.
 * @param keepLast - Maximum number of recent backups to retain.
 * @param maxTotalBytes - Maximum total backup size in bytes before pruning.
 * @returns An array of warning messages if any retention issues occurred.
 * @source
 */
const applyRetention = async (
  supabase: SupabaseClient,
  bucket: string,
  prefix: string,
  keepLast: number,
  maxTotalBytes: number
) => {
  const warnings: string[] = []

  const { data: objects, error: listError } = await listAllStorageObjects(
    supabase,
    bucket,
    prefix
  )

  if (listError) {
    warnings.push(`Retention skipped: ${listError.message}`)
    return warnings
  }

  const items = (objects ?? [])
    .filter((item) => item.name)
    .map((item) => ({
      name: item.name,
      size: item.metadata?.size ?? 0
    }))

  // Sort newest-first so `slice(keepLast)` yields the oldest candidates for deletion.
  const sortedByNameDesc = [...items].sort((a, b) =>
    b.name.localeCompare(a.name)
  )

  let totalBytes = items.reduce((sum, item) => sum + item.size, 0)
  const deletable = sortedByNameDesc.slice(keepLast)
  const deletableByAge = [...deletable].sort((a, b) =>
    a.name.localeCompare(b.name)
  )

  const toDelete: string[] = []
  const seen = new Set<string>()
  const addToDelete = (item: { name: string; size: number }) => {
    const path = `${prefix}/${item.name}`
    if (seen.has(path)) {
      return
    }
    seen.add(path)
    toDelete.push(path)
    totalBytes -= item.size
  }

  if (maxTotalBytes > 0 && totalBytes > maxTotalBytes) {
    for (const item of deletableByAge) {
      if (totalBytes <= maxTotalBytes) {
        break
      }
      addToDelete(item)
    }
  }

  for (const item of deletable) {
    addToDelete(item)
  }

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase.storage
      .from(bucket)
      .remove(toDelete)

    if (deleteError) {
      warnings.push(`Retention delete failed: ${deleteError.message}`)
    }
  }

  if (totalBytes > maxTotalBytes && maxTotalBytes > 0) {
    warnings.push(
      "Retention cap exceeded even after deleting older backups. Consider lowering BACKUP_KEEP_LAST or raising BACKUP_MAX_TOTAL_MB."
    )
  }

  return warnings
}

/**
 * Edge function handler that performs a full database backup on POST requests.
 * Validates authorization, fetches table data, uploads a gzip-compressed snapshot, and applies retention.
 * @source
 */
serve(async (request: Request) => {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." })
  }

  const supabaseUrl = getEnv(
    "SUPABASE_URL",
    getEnv("NEXT_PUBLIC_SUPABASE_URL") ?? ""
  )
  const serviceRoleKey = getEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    getEnv("SUPABASE_SECRET_KEY") ?? ""
  )

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, {
      error:
        "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY."
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  const authCheck = requireAuthorization(request)
  if (!authCheck.ok) {
    return jsonResponse(401, { error: authCheck.reason })
  }

  const bucket = getEnv("BACKUP_BUCKET", "backups")
  const prefix = getEnv("BACKUP_PREFIX", "db-backups")
  const keepLast = Math.max(0, toInt(getEnv("BACKUP_KEEP_LAST"), 7))
  const maxTotalMb = Math.max(0, toInt(getEnv("BACKUP_MAX_TOTAL_MB"), 256))
  const maxTotalBytes = maxTotalMb * 1024 * 1024
  const pageSize = Math.max(1, toInt(getEnv("BACKUP_PAGE_SIZE"), 1000))
  const maxRowsPerTable = Math.max(
    0,
    toInt(getEnv("BACKUP_MAX_ROWS_PER_TABLE"), 0)
  )
  const maxTotalRows = Math.max(0, toInt(getEnv("BACKUP_MAX_TOTAL_ROWS"), 0))
  const hardRowLimit = Math.max(
    0,
    toInt(getEnv("BACKUP_HARD_ROW_LIMIT"), 250000)
  )

  const allowList = parseCsv(getEnv("BACKUP_TABLES"))
  const excludeList = new Set(parseCsv(getEnv("BACKUP_EXCLUDE_TABLES")))

  const tablesResult = await resolveTables(supabase, allowList, excludeList)
  if (!tablesResult.data) {
    return jsonResponse(tablesResult.status ?? 500, {
      error: tablesResult.error,
      details: tablesResult.details
    })
  }

  const tableDataResult = await fetchTableData(
    supabase,
    tablesResult.data,
    pageSize,
    {
      maxRowsPerTable,
      maxTotalRows,
      hardRowLimit
    }
  )
  if (!tableDataResult.data) {
    return jsonResponse(tableDataResult.status ?? 500, {
      error: tableDataResult.error,
      details: tableDataResult.details
    })
  }

  const truncatedTables = Object.entries(tableDataResult.data.tableTruncated)
    .filter(([, truncated]) => truncated)
    .map(([table]) => table)
  const truncationWarnings =
    truncatedTables.length > 0
      ? [`Backup truncated for tables: ${truncatedTables.join(", ")}.`]
      : []

  const createdAt = new Date()
  const payload: BackupPayload = {
    metadata: {
      createdAt: createdAt.toISOString(),
      tableCount: tablesResult.data.length,
      rowCounts: tableDataResult.data.rowCounts,
      tableTruncated: tableDataResult.data.tableTruncated
    },
    tables: tableDataResult.data.tableData
  }

  const uploadResult = await uploadBackup(
    supabase,
    bucket,
    prefix,
    payload,
    createdAt
  )
  if (!uploadResult.data) {
    return jsonResponse(uploadResult.status ?? 500, {
      error: uploadResult.error,
      details: uploadResult.details
    })
  }

  const warnings = await applyRetention(
    supabase,
    bucket,
    prefix,
    keepLast,
    maxTotalBytes
  )

  return jsonResponse(200, {
    ok: true,
    backupPath: uploadResult.data,
    bucket,
    prefix,
    metadata: payload.metadata,
    warnings: [...truncationWarnings, ...warnings]
  })
})
