# Data Flow & Request Lifecycle

## Request lifecycle

```
Browser ──► Next.js Server
              │
              ├─ PAGE request (matched by middleware)
              │   │
              │   ▼
              │  middleware.ts ► updateSession()
              │   │
              │   ├─ Protected route (/dashboard, /library, /settings)?
              │   │   ├─ No auth cookie → redirect /login?redirect=<path>
              │   │   ├─ Has cookie → create Supabase SSR client
              │   │   │   └─ supabase.auth.getUser() (refreshes JWT if needed)
              │   │   │       ├─ No user → redirect /login
              │   │   │       └─ User valid → NextResponse.next() (cookies synced)
              │   │   └─ Refreshed cookies set on both request + response
              │   │
              │   ├─ Auth route (/login, /signup)?
              │   │   ├─ Not authenticated → pass through
              │   │   └─ Authenticated → redirect /library
              │   │
              │   └─ Other public route → pass through (no Supabase client created)
              │
              ├─ API request (/api/**)
              │   │  *** MIDDLEWARE EXCLUDED — matcher skips /api ***
              │   ▼
              │  Route handler (route.ts)
              │   ├─ Auth-required endpoints:
              │   │   └─ Explicit: createUserClient() → supabase.auth.getUser()
              │   │       └─ No user → apiError(401, "Unauthorized")
              │   ├─ Rate limiting check (in-memory or distributed RPC)
              │   ├─ Input validation (zod / lib/validation.ts)
              │   ├─ Input sanitization (lib/sanitize-html.ts)
              │   ├─ Business logic
              │   └─ Supabase query (RLS enforced on user client)
              │
              └─ Static assets → served directly (_next/static, images, etc.)
```

## Auth token flow

```
┌─────────────┐   signup/login    ┌──────────────────┐
│   Browser   │ ────────────────► │  Supabase Auth   │
│             │ ◄──── JWT pair ── │  (GoTrue)        │
│  httpOnly   │                   └──────────────────┘
│  cookies    │                          │
│ (sb-*-auth) │                          │
└─────┬───────┘                          │
      │ every request                    │
      ▼                                  │
┌─────────────┐  getUser()        ┌──────────────────┐
│ Middleware /│ ────────────────► │  Supabase Auth   │
│ Route Hndlr │ ◄─ refreshed JWT  │  (validates/     │
│             │                   │   refreshes)     │
└─────┬───────┘                   └──────────────────┘
      │ query with JWT
      ▼
┌──────────────────┐
│  Supabase DB     │   auth.uid() extracted from JWT
│  (RLS enforced)  │   → WHERE user_id = auth.uid()
└──────────────────┘
```

- Tokens stored as **httpOnly cookies** (sb-\*-auth-token) — NOT localStorage.
- Middleware refreshes tokens on every matched page request.
- API routes create their own Supabase client per-request for auth.

## Where RLS is enforced

- **Always**: Every query through `createUserClient()` runs with RLS.
- All 7 domain tables have RLS enabled: profiles, series, volumes, tags, price_history, price_alerts, rate_limit_buckets.
- Policy pattern: `auth.uid() = user_id` (or `= id` for profiles).
- `createAdminClient()` bypasses RLS — used only in trusted server code with a documented `reason`.

## API response envelope

```
Success:                          Error:
{                                 {
  "data": <T>,                      "error": "Human message",
  "meta"?: { ... }                  "code": "NOT_FOUND" | "RATE_LIMITED" | ...,
}                                   "details"?: { ... },
                                    "correlationId"?: "uuid"
Headers:                          }
  x-correlation-id: <uuid>
                                  Headers:
Status: 200 (default)               x-correlation-id: <uuid>
```

- `apiSuccess(data, {meta?, correlationId?, status?})` — wraps in `{data}`.
- `apiError(status, message, {code?, details?, extra?, correlationId?})` — wraps in `{error, code}`.
- Correlation IDs propagated in both body and `x-correlation-id` header.
- Default error codes derived from HTTP status (400→VALIDATION_ERROR, 404→NOT_FOUND, 429→RATE_LIMITED, etc.).

## Supabase client types

| Client                | Created by            | RLS | Where used                       |
| --------------------- | --------------------- | --- | -------------------------------- |
| `createUserClient`    | `lib/supabase/server` | Yes | Layouts, API routes (auth scope) |
| `createAdminClient`   | `lib/supabase/admin`  | No  | Server-only, requires `reason`   |
| `createBrowserClient` | `lib/supabase/client` | Yes | Client components (auth actions) |
