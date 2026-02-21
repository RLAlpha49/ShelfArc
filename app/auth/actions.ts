"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { ALLOWED_REDIRECT_PREFIXES } from "@/lib/auth/constants"
import { validatePassword } from "@/lib/auth/validate-password"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { sanitizePlainText } from "@/lib/sanitize-html"
import { createAdminClient } from "@/lib/supabase/admin"
import { createUserClient } from "@/lib/supabase/server"
import { isValidUsername } from "@/lib/validation"

function getSafeRedirect(raw: unknown): string {
  if (typeof raw !== "string") return "/library"
  const path = raw.trim()
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    !ALLOWED_REDIRECT_PREFIXES.some((p) => path.startsWith(p))
  ) {
    return "/library"
  }
  return path
}

/**
 * Returns the request origin derived from the actual incoming request headers
 * so that auth redirect URLs work in both development (localhost) and
 * production without relying solely on NEXT_PUBLIC_APP_URL.
 */
async function getRequestOrigin(): Promise<string | null> {
  const h = await headers()
  const host = h.get("x-forwarded-host") || h.get("host")
  if (!host) return process.env.NEXT_PUBLIC_APP_URL ?? null
  const proto =
    h.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https")
  return `${proto}://${host}`
}

/**
 * Authenticates a user with email and password, then redirects to the library.
 * @param formData - Form data containing `email` and `password` fields.
 * @returns An error object if authentication fails; otherwise redirects.
 * @source
 */
export async function login(formData: FormData) {
  const supabase = await createUserClient()

  const email = (formData.get("email") as string)?.trim()
  const password = formData.get("password") as string

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Valid email is required" }
  }
  if (!password) {
    return { error: "Password is required" }
  }

  const headerStore = await headers()
  const forwarded = headerStore.get("x-forwarded-for")
  const clientIp = forwarded?.split(",")[0]?.trim() || "unknown"

  const rateLimitResult = await consumeDistributedRateLimit({
    key: `login:${clientIp}`,
    maxHits: 5,
    windowMs: 60_000,
    cooldownMs: 5 * 60_000,
    reason: "Login rate limit"
  })

  if (rateLimitResult && !rateLimitResult.allowed) {
    return { error: "Too many login attempts. Please try again later." }
  }

  // Secondary per-email rate limit — prevents XFF-rotation bypass (defense-in-depth).
  const emailRateLimitResult = await consumeDistributedRateLimit({
    key: `login:email:${email.toLowerCase()}`,
    maxHits: 10,
    windowMs: 5 * 60_000,
    cooldownMs: 30 * 60_000,
    reason: "Login email rate limit"
  })

  if (emailRateLimitResult && !emailRateLimitResult.allowed) {
    return { error: "Too many login attempts. Please try again later." }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    return { error: error.message }
  }

  // Check if the session needs to be elevated to AAL2 (MFA required)
  const { data: aalData } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aalData?.currentLevel === "aal1" && aalData.nextLevel === "aal2") {
    // Redirect to MFA challenge — session is valid but needs second factor
    const destination = getSafeRedirect(formData.get("redirectTo"))
    redirect(`/mfa-challenge?redirectTo=${encodeURIComponent(destination)}`)
  }

  const destination = getSafeRedirect(formData.get("redirectTo"))
  revalidatePath("/", "layout")
  redirect(destination)
}

/**
 * Registers a new user account and redirects to the library on success.
 * @param formData - Form data containing `email`, `password`, and `username` fields.
 * @returns An error object if registration fails; otherwise redirects.
 * @source
 */
export async function signup(formData: FormData) {
  const supabase = await createUserClient()

  const email = (formData.get("email") as string)?.trim()
  const password = formData.get("password") as string
  const rawUsername = formData.get("username") as string

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Valid email is required" }
  }
  const passwordError = validatePassword(password)
  if (passwordError) {
    return { error: passwordError }
  }

  const username = sanitizePlainText(rawUsername || "", 20)

  if (!isValidUsername(username)) {
    return {
      error: "Username must be 3-20 characters (letters, numbers, underscores)"
    }
  }

  const headerStore = await headers()
  const forwarded = headerStore.get("x-forwarded-for")
  const clientIp = forwarded?.split(",")[0]?.trim() || "unknown"

  const rateLimitResult = await consumeDistributedRateLimit({
    key: `signup:${clientIp}`,
    maxHits: 3,
    windowMs: 60_000,
    cooldownMs: 10 * 60_000,
    reason: "Signup rate limit"
  })

  if (rateLimitResult && !rateLimitResult.allowed) {
    return { error: "Too many signup attempts. Please try again later." }
  }

  // Secondary per-email rate limit — prevents XFF-rotation bypass.
  const emailRateLimitResult = await consumeDistributedRateLimit({
    key: `signup:email:${email.toLowerCase()}`,
    maxHits: 5,
    windowMs: 10 * 60_000,
    cooldownMs: 60 * 60_000,
    reason: "Signup email rate limit"
  })

  if (emailRateLimitResult && !emailRateLimitResult.allowed) {
    return { error: "Too many signup attempts. Please try again later." }
  }

  const admin = createAdminClient({
    reason: "Check username uniqueness during signup"
  })

  const { data: existing, error: checkError } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .limit(1)

  if (checkError) {
    return { error: "Unable to verify username availability" }
  }

  if (existing && existing.length > 0) {
    return { error: "Username is already taken" }
  }

  const origin = await getRequestOrigin()
  if (!origin) {
    return { error: "Server configuration error. Please contact support." }
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username
      },
      emailRedirectTo: `${origin}/auth/callback?next=/library`
    }
  })

  if (error) {
    return { error: error.message }
  }

  const destination = getSafeRedirect(formData.get("redirectTo"))
  revalidatePath("/", "layout")
  redirect(destination)
}

/**
 * Sends a password reset email for the given address.
 * Always returns a generic success message to prevent email enumeration.
 * @param formData - Form data containing an `email` field.
 * @returns A success or error object.
 * @source
 */
export async function forgotPassword(formData: FormData) {
  const email = (formData.get("email") as string)?.trim()

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Valid email is required" }
  }

  const headerStore = await headers()
  const forwarded = headerStore.get("x-forwarded-for")
  const clientIp = forwarded?.split(",")[0]?.trim() || "unknown"

  const rateLimitResult = await consumeDistributedRateLimit({
    key: `forgot-password:${clientIp}`,
    maxHits: 3,
    windowMs: 60_000,
    cooldownMs: 10 * 60_000,
    reason: "Forgot password rate limit"
  })

  if (rateLimitResult && !rateLimitResult.allowed) {
    return { error: "Too many requests. Please try again later." }
  }

  // Secondary per-email rate limit — prevents XFF-rotation bypass.
  const emailRateLimitResult = await consumeDistributedRateLimit({
    key: `forgot-password:email:${email.toLowerCase()}`,
    maxHits: 5,
    windowMs: 10 * 60_000,
    cooldownMs: 60 * 60_000,
    reason: "Forgot password email rate limit"
  })

  if (emailRateLimitResult && !emailRateLimitResult.allowed) {
    return { error: "Too many requests. Please try again later." }
  }

  const origin = await getRequestOrigin()
  if (!origin) {
    return { error: "Server configuration error. Please contact support." }
  }

  const supabase = await createUserClient()
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`
  })

  return {
    success:
      "If an account with that email exists, we've sent a password reset link."
  }
}

/**
 * Signs the current user out and redirects to the home page.
 * @source
 */
export async function logout() {
  const supabase = await createUserClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/")
}

/**
 * Retrieves the currently authenticated Supabase user.
 * @returns The authenticated user object, or `null` if unauthenticated.
 * @source
 */
export async function getUser() {
  const supabase = await createUserClient()
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

/**
 * Sends a magic-link (OTP) email for passwordless sign-in.
 * Rate-limited per IP and per email to prevent abuse.
 * Always returns a generic success message to prevent email enumeration.
 * @param formData - Form data containing an `email` field and optional `redirectTo`.
 * @returns `{ success: string }` on success, or `{ error: string }` on failure.
 * @source
 */
export async function loginWithMagicLink(formData: FormData) {
  const email = (formData.get("email") as string)?.trim()

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Valid email is required" }
  }

  const headerStore = await headers()
  const forwarded = headerStore.get("x-forwarded-for")
  const clientIp = forwarded?.split(",")[0]?.trim() || "unknown"

  const rateLimitResult = await consumeDistributedRateLimit({
    key: `magic-link:${clientIp}`,
    maxHits: 3,
    windowMs: 60_000,
    cooldownMs: 10 * 60_000,
    reason: "Magic link rate limit"
  })

  if (rateLimitResult && !rateLimitResult.allowed) {
    return { error: "Too many requests. Please try again later." }
  }

  const emailRateLimitResult = await consumeDistributedRateLimit({
    key: `magic-link:email:${email.toLowerCase()}`,
    maxHits: 5,
    windowMs: 10 * 60_000,
    cooldownMs: 60 * 60_000,
    reason: "Magic link email rate limit"
  })

  if (emailRateLimitResult && !emailRateLimitResult.allowed) {
    return { error: "Too many requests. Please try again later." }
  }

  const origin = await getRequestOrigin()
  if (!origin) {
    return { error: "Server configuration error. Please contact support." }
  }

  const rawRedirectTo = formData.get("redirectTo")
  const safeNext = getSafeRedirect(rawRedirectTo)
  const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`

  const supabase = await createUserClient()
  await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl
    }
  })

  // Always return success to prevent email enumeration.
  return {
    success:
      "If an account with that email exists, we've sent a sign-in link. Check your inbox."
  }
}

/**
 * Completes the OAuth profile onboarding by saving a chosen username.
 * Called by new OAuth users (GitHub) who have not yet set a username.
 * Updates both the `profiles` table and the user's auth metadata.
 * @param formData - Form data containing a `username` field.
 * @returns `{ success: true }` or `{ error: string }`.
 * @source
 */
export async function completeOAuthProfile(formData: FormData) {
  const supabase = await createUserClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "You must be signed in to complete your profile." }
  }

  const rawUsername = formData.get("username") as string
  const username = sanitizePlainText(rawUsername || "", 20)

  if (!isValidUsername(username)) {
    return {
      error: "Username must be 3-20 characters (letters, numbers, underscores)"
    }
  }

  const rateLimitResult = await consumeDistributedRateLimit({
    key: `complete-profile:${user.id}`,
    maxHits: 5,
    windowMs: 60_000,
    cooldownMs: 5 * 60_000,
    reason: "Complete OAuth profile rate limit"
  })

  if (rateLimitResult && !rateLimitResult.allowed) {
    return { error: "Too many attempts. Please try again later." }
  }

  const admin = createAdminClient({
    reason: "Check username uniqueness during OAuth profile completion"
  })

  const { data: existing, error: checkError } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .neq("id", user.id)
    .limit(1)

  if (checkError) {
    return { error: "Unable to verify username availability" }
  }

  if (existing && existing.length > 0) {
    return { error: "Username is already taken" }
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ username })
    .eq("id", user.id)

  if (updateError) {
    return { error: "Failed to save username. Please try again." }
  }

  // Sync username to auth metadata so OAuth re-logins know the user is set up.
  await supabase.auth.updateUser({
    data: { username, display_name: username }
  })

  revalidatePath("/", "layout")
  return { success: true as const }
}

/**
 * Resends a verification email to the currently authenticated user.
 * Rate-limited to 3 attempts per hour per user.
 * @returns `{ success: true }` on success, or `{ error: string }` on failure.
 * @source
 */
export async function resendVerificationEmail() {
  const supabase = await createUserClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "You must be logged in to resend verification." }
  }

  const rateLimitResult = await consumeDistributedRateLimit({
    key: `verify-resend:${user.id}`,
    maxHits: 3,
    windowMs: 3_600_000,
    cooldownMs: 3_600_000,
    reason: "Verify email resend rate limit"
  })

  if (rateLimitResult && !rateLimitResult.allowed) {
    return { error: "Too many resend attempts. Try again later." }
  }

  const origin = await getRequestOrigin()
  if (!origin) {
    return { error: "Server configuration error. Please contact support." }
  }

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: user.email!,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/library`
    }
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true as const }
}
