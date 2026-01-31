# ShelfArc — project overview

## Purpose

ShelfArc appears to be a Next.js app for managing a personal library/collection (series & volumes), with authenticated access and import/export flows. This is inferred from the `app/(app)/library`, `components/library/*`, and settings/import/export routes.

## Tech stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **UI**: React 19, shadcn/ui components, Tailwind CSS v4 (PostCSS), Base UI
- **State**: Zustand
- **Auth/Data**: Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- **Forms**: react-hook-form
- **Testing**: Playwright (e2e), Bun test runner
- **Tooling**: ESLint 9 (next/core-web-vitals + typescript), Prettier 3
- **Misc**: date-fns, sonner, hugeicons

## Codebase structure (rough)

- `app/`: App Router routes + layouts; route group `app/(app)/` for authenticated pages (dashboard, library, settings, import/export).
- `app/auth/*`: auth actions and login/signup pages.
- `components/`: shared UI and feature components; `components/ui` is shadcn-generated.
- `components/library/`: library feature UI (series/volume cards, dialogs, toolbar).
- `lib/`: utilities, hooks, Zustand store, Supabase client helpers.
- `supabase/`: schema and Supabase assets.
- `public/`: static assets.

## Environment variables

From `.env.local.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
