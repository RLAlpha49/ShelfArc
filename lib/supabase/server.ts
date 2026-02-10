import "server-only"
import { createServerClient } from "@supabase/ssr"
import type { SetAllCookies } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/lib/types/database"

const getSupabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL
const getAnonKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

const buildMissingEnvMessage = (values: Array<string | undefined>) =>
  values.filter((value): value is string => Boolean(value)).join(", ")

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
