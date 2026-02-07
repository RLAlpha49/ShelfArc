import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

type JsonRecord = Record<string, unknown>

type BackupMetadata = {
  createdAt: string
  tableCount: number
  rowCounts: Record<string, number>
  tableTruncated: Record<string, boolean>
}

type BackupPayload = {
  metadata: BackupMetadata
  tables: Record<string, unknown[]>
}

type SupabaseClient = ReturnType<typeof createClient>

type Result<T> =
  | { data: T; error?: never; details?: never; status?: never }
  | { data?: never; error: string; details?: string; status?: number }

const jsonResponse = (status: number, body: JsonRecord) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  })

function getEnv(key: string): string | undefined
function getEnv(key: string, fallback: string): string
function getEnv(key: string, fallback?: string) {
  const value = Deno.env.get(key)
  if (value === undefined || value.trim() === "") {
    return fallback
  }
  return value
}

const toInt = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

const parseCsv = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)

const formatTimestamp = (date: Date) =>
  date
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z")

const gzipJson = async (json: string) => {
  const encoder = new TextEncoder()
  const stream = new Blob([encoder.encode(json)], {
    type: "application/json"
  })
    .stream()
    .pipeThrough(new CompressionStream("gzip"))
  return await new Response(stream).blob()
}

const requireAuthorization = async (
  request: Request,
  supabase: SupabaseClient
) => {
  const requiredSecret = getEnv("BACKUP_SECRET")
  if (requiredSecret) {
    const providedSecret = request.headers.get("x-backup-secret") ?? ""
    if (providedSecret !== requiredSecret) {
      return {
        ok: false,
        reason: "Missing or invalid x-backup-secret header."
      }
    }
    return { ok: true }
  }

  const authHeader = request.headers.get("authorization") ?? ""
  const tokenMatch = /^Bearer\s+(.+)$/i.exec(authHeader)
  if (!tokenMatch) {
    return {
      ok: false,
      reason:
        "Missing Authorization header. Provide a JWT or set BACKUP_SECRET for header-based auth."
    }
  }

  const token = tokenMatch[1]?.trim()
  if (!token) {
    return {
      ok: false,
      reason:
        "Missing JWT in Authorization header. Provide a Bearer token or set BACKUP_SECRET."
    }
  }

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) {
    return {
      ok: false,
      reason: error?.message ?? "Invalid or expired JWT."
    }
  }

  return { ok: true }
}

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

type PageEvaluation = {
  pageRows: unknown[]
  truncated: boolean
  stopTable: boolean
  stopAll: boolean
  nextTableRows: number
  nextTotalRows: number
}

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

  const authCheck = await requireAuthorization(request, supabase)
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
