# App Router, API surface, and auth/session map

- Middleware (`middleware.ts` -> `lib/supabase/middleware.updateSession`) handles protected-route redirects and auth-route redirects; matcher excludes `/api`.
- Protected app routes: `/dashboard`, `/library`, `/settings` and nested pages.
- Auth actions (`app/auth/actions.ts`): `login`, `signup`, `logout`, `getUser`.
- API endpoints under `app/api/**`:
  - `books/search` (GET): public Google/OpenLibrary search.
  - `books/price` (GET): public Amazon scrape + rate limiting + concurrency control.
  - `books/price/history` (GET/POST): auth-required user-scoped history reads/writes.
  - `books/price/alerts` (GET/POST/PATCH/DELETE): auth-required alert CRUD.
  - `books/volume/[volumeId]` (GET): public Google volume lookup.
  - `covers/open-library` (GET): public image proxy with content-type allowlist.
  - `storage/file` (GET): auth + safe-path + user-prefix ownership check.
  - `uploads` (POST): auth + same-origin checks + kind/mime/size validation + optional replace cleanup.
  - `username/check` (GET): auth + username validation + RL.
- Important nuance: because `/api` bypasses middleware, route handlers must always perform explicit `auth.getUser()` when auth is required.
