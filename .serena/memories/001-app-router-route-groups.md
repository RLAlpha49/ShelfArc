# ADR-001: App Router Route Groups

**Status**: Accepted

## Context

ShelfArc needs a clear separation between public pages (landing, login, signup) and authenticated app pages (dashboard, library, settings). Next.js App Router supports route groups using parenthesized folder names that do not affect the URL path.

## Decision

Use a `(app)` route group for all authenticated routes. Public routes live at the top level of `app/`.

- `app/page.tsx`, `app/login/page.tsx`, `app/signup/page.tsx` — public, no auth required.
- `app/(app)/layout.tsx` — loads the authenticated user, renders the app shell, and redirects unauthenticated visitors.
- `app/(app)/dashboard/`, `app/(app)/library/`, `app/(app)/settings/` — protected pages.

The `(app)` layout handles session loading and provides the `AppShell` wrapper (sidebar, header) so individual pages do not repeat that logic.

## Consequences

- **Positive**: Clean URL paths (`/dashboard`, not `/app/dashboard`). Shared authenticated layout without prop drilling. Easy to add more public routes without touching the auth boundary.
- **Positive**: Middleware can target the `(app)` group for route-level guards while leaving public routes open.
- **Trade-off**: Developers must remember that `(app)` is the auth boundary — placing a page outside it makes it public.
- **Trade-off**: Two `layout.tsx` files to maintain (root and `(app)`), but the separation of concerns is worth the overhead.
