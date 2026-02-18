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

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    return { error: error.message }
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

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username
      }
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

  const origin = process.env.NEXT_PUBLIC_APP_URL
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
