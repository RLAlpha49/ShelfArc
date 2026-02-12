import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createUserClient } from "@/lib/supabase/server"
import { isSafeStoragePath } from "@/lib/storage/safe-path"

/** Supabase Storage bucket for user media files. @source */
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "media"

/**
 * Downloads a user-owned file from Supabase Storage, scoped to the authenticated user's directory.
 * @param request - Incoming request with a `path` query parameter.
 * @returns The file contents with appropriate caching headers, or an error response.
 * @source
 */
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path")?.trim()

  if (!path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 })
  }

  if (!isSafeStoragePath(path)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 })
  }

  const userClient = await createUserClient()
  const {
    data: { user }
  } = await userClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const adminClient = createAdminClient({
    reason: "Download user-owned storage file"
  })
  const { data, error } = await adminClient.storage
    .from(STORAGE_BUCKET)
    .download(path)

  if (error || !data) {
    console.error("Storage download failed", error)
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let contentLength: number | null = null
  contentLength = data.size

  const headers: Record<string, string> = {
    "Content-Type": data.type || "application/octet-stream",
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff"
  }

  if (typeof contentLength === "number") {
    headers["Content-Length"] = String(contentLength)
  }

  return new Response(data, { headers })
}
