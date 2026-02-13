# ADR-004: Supabase SSR with Per-Route API Auth

**Status**: Accepted

## Context

ShelfArc uses Supabase for authentication, database, and storage. Next.js middleware can refresh sessions and guard routes, but API routes under `app/api/` are excluded from middleware by design to allow public endpoints and avoid double-processing.

## Decision

Use Supabase SSR (`@supabase/ssr`) with a layered auth strategy:

1. **Middleware** (`middleware.ts`): Refreshes the session cookie on every request to authenticated routes. Redirects unauthenticated users to `/login` with a `redirectTo` parameter preserving the original path.

2. **Per-route API auth**: Every protected API route explicitly calls `createUserClient()` and checks the session. This is required because middleware excludes `/api` routes. Each handler returns 401 if no session is found.

3. **Client separation**:
   - `lib/supabase/client.ts` — browser client for client components.
   - `lib/supabase/server.ts` — user-scoped server client for API routes and server components.
   - `lib/supabase/admin.ts` — privileged service client (uses `SUPABASE_SECRET_KEY`) restricted to trusted server contexts only, requiring an explicit reason string.

## Consequences

- **Positive**: Defense-in-depth — middleware guards pages, API routes self-authenticate.
- **Positive**: `redirectTo` parameter preserves user intent after login.
- **Positive**: Admin client is isolated with an explicit reason requirement, reducing accidental privilege escalation.
- **Trade-off**: Every API route must include auth boilerplate — acceptable for security clarity.
- **Trade-off**: Middleware exclusion of `/api` means no automatic session refresh for API calls — clients rely on cookie freshness from page-level middleware runs.
