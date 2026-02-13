# ShelfArc architecture overview (2026-02)

- Stack: Next.js 16 App Router, React 19, TypeScript 5, Supabase SSR, Zustand, shadcn/ui (base-mira), Tailwind v4.
- Route shape: public routes (`/`, `/login`, `/signup`) + authenticated route group `app/(app)` => `/dashboard`, `/library`, `/settings`.
- Layouts: `app/layout.tsx` provides global providers/theme/toaster; `app/(app)/layout.tsx` loads authenticated user and renders app shell.
- Data model revolves around `series`, `volumes`, `tags`, `price_history`, `price_alerts`, user `profiles`.
- Library UX is client-heavy (dialogs, bulk actions, local derivations), while writes/search/storage/proxy work is handled by API routes.
- Core architecture pattern: sanitize + validate inputs at app layer, enforce ownership with RLS + user_id checks, and isolate privileged operations in server/admin paths only.
