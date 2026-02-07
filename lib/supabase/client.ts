import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/lib/types/database"

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  const missingEnvVars = [
    supabaseUrl ? undefined : "NEXT_PUBLIC_SUPABASE_URL",
    supabaseKey
      ? undefined
      : "NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  ].filter((value): value is string => Boolean(value))

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(`Missing ${missingEnvVars.join(", ")}`)
  }

  return createBrowserClient<Database, "public">(supabaseUrl, supabaseKey)
}
