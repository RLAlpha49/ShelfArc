import { apiError } from "@/lib/api-response"

/**
 * Basic CSRF hardening for cookie-auth endpoints.
 * Rejects cross-site browser requests and mismatched Origin/Host.
 * @param request - The incoming request.
 * @returns An error Response if the request fails same-origin checks, or `undefined` if it passes.
 * @source
 */
export function enforceSameOrigin(request: Request): Response | undefined {
  const headers = request.headers
  if (!headers || typeof headers.get !== "function") {
    return undefined
  }

  const fetchSite = headers.get("sec-fetch-site")
  if (fetchSite === "cross-site") {
    return apiError(403, "Forbidden")
  }

  const origin = headers.get("origin")?.trim() ?? ""
  if (!origin) {
    // Require Origin for state-mutating methods (POST, PUT, PATCH, DELETE).
    // GET, HEAD, OPTIONS are safe methods and may omit Origin legitimately.
    const safeMethods = ["GET", "HEAD", "OPTIONS"]
    if (!safeMethods.includes(request.method?.toUpperCase() ?? "GET")) {
      return apiError(403, "Forbidden")
    }
    return undefined
  }

  const host = headers.get("x-forwarded-host") ?? headers.get("host")
  if (!host) return undefined

  try {
    const originUrl = new URL(origin)
    if (originUrl.host !== host) {
      return apiError(403, "Forbidden")
    }
  } catch {
    return apiError(403, "Forbidden")
  }

  return undefined
}
