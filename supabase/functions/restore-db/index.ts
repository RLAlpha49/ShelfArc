import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

/** Generic JSON-compatible record type. @source */
type JsonRecord = Record<string, unknown>

/** Alias for the Supabase client return type. @source */
type SupabaseClient = ReturnType<typeof createClient>

/** Backup payload shape produced by the backup-db edge function. @source */
type BackupPayload = {
  metadata: {
    createdAt: string
    tableCount: number
    rowCounts: Record<string, number>
    tableTruncated: Record<string, boolean>
  }
  tables: Record<string, unknown[]>
}

/**
 * Defines the order in which tables must be restored to satisfy foreign key constraints.
 * Tables listed earlier are restored first; unlisted tables are restored after all listed ones.
 * @source
 */
const TABLE_RESTORE_ORDER = [
  "profiles",
  "series",
  "volumes",
  "tags",
  "price_history",
  "price_alerts"
]

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
 * Validates the request using either a shared secret header or a JWT Bearer token.
 * @param request - Incoming HTTP request.
 * @param supabase - Supabase client for JWT verification.
 * @returns An object with `ok: true` on success, or `ok: false` with a `reason` string.
 * @source
 */
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

/**
 * Validates that a backup path is safe and well-formed.
 * Rejects traversal attacks, absolute paths, and non-.json.gz files.
 * @param path - The backup path to validate.
 * @returns `true` if the path is safe to use.
 * @source
 */
const isSafeBackupPath = (path: string) => {
  if (!path || typeof path !== "string") return false
  if (!path.endsWith(".json.gz")) return false
  if (path.includes("..")) return false
  if (path.includes("\\")) return false
  if (path.startsWith("/")) return false
  if (path.includes("\0")) return false

  // Block encoded traversal sequences
  const lower = path.toLowerCase()
  const blocked = ["%2e", "%2f", "%5c", "%00"]
  if (blocked.some((seq) => lower.includes(seq))) return false

  return true
}

/**
 * Downloads and decompresses a .json.gz backup from Supabase Storage.
 * @param supabase - Supabase client.
 * @param bucket - Storage bucket name.
 * @param backupPath - Full path to the backup file within the bucket.
 * @returns The parsed BackupPayload or an error response.
 * @source
 */
const downloadBackup = async (
  supabase: SupabaseClient,
  bucket: string,
  backupPath: string
): Promise<
  { data: BackupPayload; error?: never } | { data?: never; error: string }
> => {
  const { data, error } = await (
    supabase.storage.from(bucket) as unknown as {
      download: (
        path: string
      ) => Promise<{ data: Blob | null; error: { message: string } | null }>
    }
  ).download(backupPath)

  if (error || !data) {
    return { error: error?.message ?? "Failed to download backup file." }
  }

  try {
    const decompressedStream = data
      .stream()
      .pipeThrough(new DecompressionStream("gzip"))
    const decompressedResponse = new Response(decompressedStream)
    const text = await decompressedResponse.text()
    const payload = JSON.parse(text) as BackupPayload

    if (!payload.tables || typeof payload.tables !== "object") {
      return { error: "Invalid backup format: missing tables object." }
    }

    return { data: payload }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: `Failed to decompress or parse backup: ${message}` }
  }
}

/**
 * Sorts table names for restore according to the FK constraint order.
 * Tables in TABLE_RESTORE_ORDER come first (in order); remaining tables follow alphabetically.
 * @param tables - Array of table names from the backup payload.
 * @returns Sorted array of table names.
 * @source
 */
const sortTablesForRestore = (tables: string[]): string[] => {
  const orderMap = new Map(
    TABLE_RESTORE_ORDER.map((name, index) => [name, index])
  )

  const ordered = tables
    .filter((t) => orderMap.has(t))
    .sort((a, b) => (orderMap.get(a) ?? 0) - (orderMap.get(b) ?? 0))

  const unordered = tables
    .filter((t) => !orderMap.has(t))
    .sort((a, b) => a.localeCompare(b))

  return [...ordered, ...unordered]
}

/** Supabase query result shape for mutation operations. @source */
type MutationResult = { error: { message: string } | null }

/**
 * Restores a single table by deleting existing rows and inserting backed-up rows.
 * Inserts in batches to avoid exceeding payload limits.
 * @param supabase - Supabase client (service role).
 * @param table - Table name to restore.
 * @param rows - Rows to insert.
 * @returns Row count on success or an error message.
 * @source
 */
const restoreTable = async (
  supabase: SupabaseClient,
  table: string,
  rows: unknown[]
): Promise<{ rowCount: number; error?: string }> => {
  // Delete all existing rows first.
  // The neq guard ensures the query is not empty (Supabase requires a filter on delete).
  const deleteResult = await (supabase
    .from(table)
    .delete()
    .neq(
      "id",
      "00000000-0000-0000-0000-000000000000"
    ) as unknown as Promise<MutationResult>)

  if (deleteResult.error) {
    return {
      rowCount: 0,
      error: `Failed to clear table ${table}: ${deleteResult.error.message}`
    }
  }

  if (rows.length === 0) {
    return { rowCount: 0 }
  }

  // Insert in batches of 500 to avoid payload limits
  const batchSize = 500
  let inserted = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const insertResult = await (supabase
      .from(table)
      .insert(batch) as unknown as Promise<MutationResult>)

    if (insertResult.error) {
      return {
        rowCount: inserted,
        error: `Failed to insert into ${table} at batch ${Math.floor(i / batchSize)}: ${insertResult.error.message}`
      }
    }

    inserted += batch.length
  }

  return { rowCount: inserted }
}

/**
 * Edge function handler that restores a database from a backup on POST requests.
 * Validates authorization, downloads and decompresses the backup, then restores
 * tables in FK-safe order.
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

  const authCheck = await requireAuthorization(request, supabase)
  if (!authCheck.ok) {
    return jsonResponse(401, { error: authCheck.reason })
  }

  let body: { backupPath?: string }
  try {
    body = await request.json()
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body." })
  }

  const backupPath = body.backupPath?.trim()
  if (!backupPath) {
    return jsonResponse(400, {
      error: "Missing required field: backupPath."
    })
  }

  if (!isSafeBackupPath(backupPath)) {
    return jsonResponse(400, {
      error:
        "Invalid backupPath. Must end with .json.gz and contain no traversal sequences."
    })
  }

  const bucket = getEnv("BACKUP_BUCKET", "backups")

  const downloadResult = await downloadBackup(supabase, bucket, backupPath)
  if (!downloadResult.data) {
    return jsonResponse(404, { error: downloadResult.error })
  }

  const payload = downloadResult.data
  const tableNames = Object.keys(payload.tables)
  const sortedTables = sortTablesForRestore(tableNames)

  const restoredCounts: Record<string, number> = {}
  const errors: string[] = []

  for (const table of sortedTables) {
    const rows = payload.tables[table]
    if (!Array.isArray(rows)) {
      errors.push(`Skipped ${table}: data is not an array.`)
      continue
    }

    const result = await restoreTable(supabase, table, rows)
    restoredCounts[table] = result.rowCount

    if (result.error) {
      errors.push(result.error)
    }
  }

  const hasErrors = errors.length > 0

  return jsonResponse(hasErrors ? 207 : 200, {
    ok: !hasErrors,
    restoredTables: sortedTables,
    rowCounts: restoredCounts,
    backupCreatedAt: payload.metadata.createdAt,
    ...(hasErrors ? { errors } : {})
  })
})
