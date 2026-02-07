import "server-only"
import { createServerClient } from "@supabase/ssr"
import type { SetAllCookies } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/lib/types/database"

export async function createClient() {
  const cookieStore = await cookies()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SECRET_KEY

  const missingEnvVars = [
    supabaseUrl ? undefined : "NEXT_PUBLIC_SUPABASE_URL",
    supabaseKey ? undefined : "SUPABASE_SECRET_KEY"
  ].filter((value): value is string => Boolean(value))

  if (missingEnvVars.length > 0) {
    throw new Error(`Missing ${missingEnvVars.join(", ")}`)
  }

  const supabaseUrlValue = supabaseUrl as string
  const supabaseKeyValue = supabaseKey as string

  type CookiesToSet = Parameters<SetAllCookies>[0]

  return createServerClient<Database, "public">(
    supabaseUrlValue,
    supabaseKeyValue,
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
