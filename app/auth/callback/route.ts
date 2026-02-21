import { type NextRequest, NextResponse } from "next/server"

import { createUserClient } from "@/lib/supabase/server"

/**
 * OAuth and magic-link callback handler.
 *
 * Supabase redirects here after:
 *  - GitHub OAuth consent
 *  - Magic-link email click
 *
 * The `code` query parameter is exchanged for a session via PKCE.
 * New OAuth users (no custom username set yet) are sent to the profile
 * completion step so they can choose their own username.
 *
 * @param request - Incoming GET request from Supabase auth redirect.
 * @source
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/library"
  const origin = request.nextUrl.origin

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing_code", request.url)
    )
  }

  const supabase = await createUserClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const url = new URL("/login", origin)
    url.searchParams.set("error", "auth_callback_failed")
    return NextResponse.redirect(url)
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    const url = new URL("/login", origin)
    url.searchParams.set("error", "no_session")
    return NextResponse.redirect(url)
  }

  // Detect new OAuth users that haven't chosen their own username yet.
  // Email/password users always have `username` in raw_user_meta_data (set during signup).
  // OAuth users do not — the DB trigger auto-generates one from their email prefix.
  // We let new OAuth users pick a custom username before proceeding.
  const isOAuthProvider =
    user.app_metadata?.provider && user.app_metadata.provider !== "email"
  const hasCustomUsername = Boolean(user.user_metadata?.username)

  if (isOAuthProvider && !hasCustomUsername) {
    const url = new URL("/auth/complete-profile", origin)
    // Preserve the intended destination so the complete-profile page can forward after saving.
    url.searchParams.set("next", next)
    return NextResponse.redirect(url)
  }

  // Validate `next` — only allow relative paths that start with allowed prefixes.
  const allowedPrefixes = ["/library", "/dashboard", "/settings", "/activity"]
  const safeNext =
    next.startsWith("/") &&
    !next.startsWith("//") &&
    allowedPrefixes.some((p) => next.startsWith(p))
      ? next
      : "/library"

  return NextResponse.redirect(new URL(safeNext, origin))
}
