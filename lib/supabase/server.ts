import "server-only"

import type { SetAllCookies } from "@supabase/ssr"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import type { Database } from "@/lib/types/database"

/** Reads the Supabase project URL from environment variables. @source */
const getSupabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL
/** Reads the Supabase anon/publishable key from environment variables. @source */
const getAnonKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

/**
 * Builds a comma-separated string of missing env-var names.
 * @param values - Array of env values (undefined entries become names).
 * @returns A message string listing the missing variables.
 * @source
 */
const buildMissingEnvMessage = (values: Array<string | undefined>) =>
  values.filter((value): value is string => Boolean(value)).join(", ")

/**
 * Creates a typed Supabase server client scoped to the current user's cookies.
 * @returns A Supabase server client with cookie-based auth.
 * @throws If required environment variables are missing.
 * @source
 */
export async function createUserClient() {
  const cookieStore = await cookies()
  const supabaseUrl = getSupabaseUrl()
  const supabaseKey = getAnonKey()

  const missingEnvVars = buildMissingEnvMessage([
    supabaseUrl ? undefined : "NEXT_PUBLIC_SUPABASE_URL",
    supabaseKey
      ? undefined
      : "NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  ])

  if (missingEnvVars) {
    throw new Error(`Missing ${missingEnvVars}`)
  }

  type CookiesToSet = Parameters<SetAllCookies>[0]

  return createServerClient<Database, "public">(
    supabaseUrl as string,
    supabaseKey as string,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        }
      }
    }
  )
}
