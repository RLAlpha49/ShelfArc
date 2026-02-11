import "server-only"
import { createServerClient } from "@supabase/ssr"
import type { Database } from "@/lib/types/database"

/**
 * Options for creating an admin Supabase client that bypasses RLS.
 * A reason is required for auditability.
 * @source
 */
export type AdminClientOptions = {
  reason: string
}

/** Reads the Supabase project URL from environment variables. @source */
const getSupabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL
/** Reads the Supabase service-role key from environment variables. @source */
const getServiceRoleKey = () => process.env.SUPABASE_SECRET_KEY

/**
 * Builds a comma-separated string of missing env-var names.
 * @param values - Array of env values (undefined entries become names).
 * @returns A message string listing the missing variables.
 * @source
 */
const buildMissingEnvMessage = (values: Array<string | undefined>) =>
  values.filter((value): value is string => Boolean(value)).join(", ")

/**
 * Creates a Supabase admin client that bypasses RLS.
 * @param options - Must include a non-empty reason string.
 * @returns A typed Supabase server client.
 * @throws If the reason is empty or required env vars are missing.
 * @source
 */
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
