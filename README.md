# ShelfArc

ShelfArc is a personal library manager for **light novels** and **manga**—track series and volumes, ownership/wishlist status, reading progress, and collection insights.

Built with **Next.js 16 (App Router)**, **React 19**, **TypeScript**, and **Supabase**.

## What’s in the app

- **Library**: series + volume management, grid/list browsing, bulk selection/actions, unassigned volumes (`/library`).
- **Series details**: insights (owned/missing/reading/spend), tags, notes, bulk scrape (`/library/series/[id]`).
- **Volume details**: progress, rating, purchase/publish metadata, notes (`/library/volume/[id]`).
- **Dashboard**: recently added, what-to-buy-next suggestions, wishlist/spend breakdown (`/dashboard`).
- **Settings**: profile + avatar, appearance, pricing preferences, import/export (`/settings`).

## Local development

### 1) Install

- Use Bun (recommended for this repo):

  - `bun install`

### 2) Environment variables

This project expects Supabase + (optionally) Google Books keys.

1. Copy the example file:

   Duplicate `.env.example` into **either** `.env.local` (preferred for Next.js) **or** `.env`.

2. Fill in values:

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

Server-only (required for admin operations like uploads/storage downloads):

- `SUPABASE_SECRET_KEY`

Optional (book search):

- `GOOGLE_BOOKS_API_KEY` (or `GOOGLE_BOOKS_API_KEYS` for rotation)

Optional (uploads bucket name):

- `SUPABASE_STORAGE_BUCKET` (defaults to `media`)

> Note: `.env`, `.env.local` are gitignored.

### 3) Supabase setup

- Create a Supabase project.
- Apply the schema:

  - `supabase/schema.sql`

- Ensure a Storage bucket exists (default: `media`) if you want avatar/cover uploads.

### 4) Run the dev server

- `bun run dev`

## Scripts

- `bun run dev` — start Next dev server (Turbopack)
- `bun run build` — production build
- `bun run start` — run production server
- `bun run lint` — ESLint
- `bun run typecheck` — TypeScript
- `bun run format:write` — Prettier
- `bun run test` — Bun tests
