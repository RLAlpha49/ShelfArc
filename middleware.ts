import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

/**
 * Next.js middleware that refreshes the Supabase auth session on every matched request.
 * @param request - The incoming request.
 * @returns The response with an updated session cookie.
 * @source
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

/** Middleware route matcher configuration; excludes static assets and image files. @source */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*[.](?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
}
