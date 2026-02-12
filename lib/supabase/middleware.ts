import "server-only"
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/** Routes that always require authentication. @source */
const PROTECTED_ROUTES = ["/dashboard", "/library", "/settings"] as const

/** Authentication pages where logged-in users should be redirected away. @source */
const AUTH_ROUTES = ["/login", "/signup"] as const

/**
 * Detects whether the request carries any Supabase auth cookie.
 * @param request - The incoming middleware request.
 * @returns `true` when a Supabase auth-token cookie is present.
 * @source
 */
const hasSupabaseAuthCookie = (request: NextRequest) => {
  return request.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("-auth-token"))
}

/**
 * Refreshes the Supabase session and enforces auth-based route protection.
 * @param request - The incoming Next.js middleware request.
 * @returns A `NextResponse` with updated session cookies or a redirect.
 * @throws If required Supabase environment variables are missing.
 * @source
 */
export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  )
  const isAuthRoute = AUTH_ROUTES.includes(pathname as (typeof AUTH_ROUTES)[number])
  const hasAuthCookie = hasSupabaseAuthCookie(request)

  if (isProtectedRoute && !hasAuthCookie) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirect", pathname)
    return NextResponse.redirect(url)
  }

  if (!isProtectedRoute && !isAuthRoute) {
    return NextResponse.next({ request })
  }

  if (isAuthRoute && !hasAuthCookie) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({
    request
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    )
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        supabaseResponse = NextResponse.next({
          request
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      }
    }
  })

  // Refresh the session if expired
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirect", pathname)
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (isAuthRoute && user) {
    const url = request.nextUrl.clone()
    url.pathname = "/library"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
