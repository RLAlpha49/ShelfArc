import "server-only"
import { createServerClient } from "@supabase/ssr"
import type { Database } from "@/lib/types/database"

/**
 * ⚠️ Admin client bypasses RLS.
 * Use only inside server routes after explicit auth + ownership checks.
 * Provide a short reason for auditability.
 */
export type AdminClientOptions = {
  reason: string
}

const getSupabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL
const getServiceRoleKey = () => process.env.SUPABASE_SECRET_KEY

const buildMissingEnvMessage = (values: Array<string | undefined>) =>
  values.filter((value): value is string => Boolean(value)).join(", ")

export function createAdminClient(options: AdminClientOptions) {
  if (!options?.reason?.trim()) {
    throw new Error("createAdminClient requires a non-empty reason")
  }

  const supabaseUrl = getSupabaseUrl()
  const supabaseKey = getServiceRoleKey()

  const missingEnvVars = buildMissingEnvMessage([
    supabaseUrl ? undefined : "NEXT_PUBLIC_SUPABASE_URL",
    supabaseKey ? undefined : "SUPABASE_SECRET_KEY"
  ])

  if (missingEnvVars) {
    throw new Error(`Missing ${missingEnvVars}`)
  }

  return createServerClient<Database, "public">(
    supabaseUrl as string,
    supabaseKey as string,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          // No-op: admin client does not manage user sessions.
        }
      }
    }
  )
}
