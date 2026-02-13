# ShelfArc

ShelfArc is a collector-focused library manager for **light novels** and **manga**.

Think: _“my shelves, but searchable, analyzable, and actually enjoyable to maintain.”_

---

## Why ShelfArc exists

Most catalog tools are either too generic or too rigid for manga/LN collectors. ShelfArc is optimized for real collection workflows:

- Track series and individual volumes with rich metadata
- Manage owned vs wishlist states and reading progress
- Import large batches (CSV/JSON)
- Watch prices and alerts for specific volumes
- Keep visual shelves tidy with cover images and assignment workflows

---

## Core capabilities

### Library and collection workflows

- Series + volume CRUD with structured status fields
- Series insights (owned/missing/reading/spend)
- Unassigned volume inbox and assign-to-series flow
- Bulk actions, filter presets, and search/source-assisted entry
- Duplicate detection + merge resolution dialog

### Discovery and enrichment

- Google Books and Open Library search normalization
- Volume lookup endpoint by external volume ID
- Cover image resolution/upload pipeline
- Amazon price scraping flow for price history updates

### Dashboard and settings

- Dashboard views: recent additions, suggestions, wishlist/tracked views
- Price history and alert widgets
- Profile settings (display name/avatar), appearance/preferences
- Data import/export routes and tools

---

## Tech stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, shadcn/ui primitives, Tailwind CSS v4
- **Language:** TypeScript 5 (strict mode)
- **Data/Auth:** Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- **State:** Zustand (persisted view/settings state)
- **Validation/Sanitization:** runtime guards + DOMPurify-based sanitizers
- **Tests:** Bun test runner (`bun test`)

---

## Local setup

### 1) Install dependencies

- `bun install`

### 2) Configure environment

1. Copy `.env.example` to `.env.local`
2. Fill required values:

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Browser-safe Supabase key |
| `SUPABASE_SECRET_KEY` | Yes (server) | Service-role operations (server only) |
| `GOOGLE_BOOKS_API_KEY` | Optional | Single Google Books API key |
| `GOOGLE_BOOKS_API_KEYS` | Optional | Rotating key list |
| `SUPABASE_STORAGE_BUCKET` | Optional | Upload bucket (default: `media`) |

Additional backup/distributed rate-limit related env vars are documented inline in `.env.example`.

### 3) Provision database/storage

- Apply `supabase/schema.sql` to your Supabase project.
- Ensure storage bucket exists (default bucket name: `media`).

### 4) Start development server

- `bun run dev`

---

## Scripts

- `bun run dev` — Next.js dev server (Turbopack)
- `bun run build` — production build
- `bun run start` — start production server
- `bun run lint` — ESLint
- `bun run typecheck` — TypeScript no-emit check
- `bun run format:write` — Prettier formatting
- `bun run test` — Bun tests
- `bun run update` — dependency update sweep (`ncu -u`)

---

## License

MIT — see `LICENSE`.
