// Configure cron schedule in the Supabase dashboard.
// Use `0 * * * *` (hourly) so the single-scrape-per-call batch rotates through all user alerts
// within a reasonable window. Each alert is deduped by a 12-hour price_history cache,
// so only one live Amazon scrape occurs per invocation, keeping Next.js responses under 10s.
// This function POSTs to the Next.js /api/automations/evaluate endpoint using a shared secret.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts"

/** Generic JSON-serializable record type. @source */
type JsonRecord = Record<string, unknown>

/**
 * Creates a JSON Response with the given status and body.
 * @param status - HTTP status code.
 * @param body - JSON-serializable response body.
 * @returns A Response with JSON content-type.
 * @source
 */
const jsonResponse = (status: number, body: JsonRecord): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  })

/**
 * Reads a Deno environment variable, returning `undefined` if unset or empty.
 * @param key - Environment variable name.
 * @returns The trimmed value, or `undefined`.
 * @source
 */
const getEnv = (key: string): string | undefined => {
  const value = Deno.env.get(key)
  return value === undefined || value.trim() === "" ? undefined : value.trim()
}

/**
 * Edge function handler that triggers price alert evaluation by calling the Next.js API.
 * Reads `APP_URL` and `EVALUATION_SECRET` from environment variables, then POSTs
 * to `{APP_URL}/api/automations/evaluate` with the shared secret header.
 * @source
 */
serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." })
  }

  const appUrl = getEnv("APP_URL")
  const evaluationSecret = getEnv("EVALUATION_SECRET")

  if (!appUrl || !evaluationSecret) {
    const missing = [
      !appUrl && "APP_URL",
      !evaluationSecret && "EVALUATION_SECRET"
    ]
      .filter(Boolean)
      .join(", ")
    return jsonResponse(500, {
      error: `Missing required environment variables: ${missing}.`
    })
  }

  const evaluateUrl = `${appUrl}/api/automations/evaluate`

  try {
    const response = await fetch(evaluateUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-evaluation-secret": evaluationSecret
      },
      body: "{}"
    })

    const body = (await response.json()) as JsonRecord
    return jsonResponse(response.status, body)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return jsonResponse(500, {
      error: `Failed to reach evaluation endpoint: ${message}`
    })
  }
})
