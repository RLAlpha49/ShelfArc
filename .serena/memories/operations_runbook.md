# Operations + environment runbook

- Required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`.
- Optional env vars: `GOOGLE_BOOKS_API_KEY`/`GOOGLE_BOOKS_API_KEYS`, `SUPABASE_STORAGE_BUCKET`, distributed RL toggle, backup settings.
- Setup baseline:
  - install deps with Bun,
  - apply `supabase/schema.sql`,
  - ensure storage bucket exists (`media` by default).
- Backup edge function (`supabase/functions/backup-db`) supports secret or bearer auth, paginated export, gzip output, and retention cleanup.
- Next config currently allows remote images from Google Books and Open Library.
- Middleware matcher excludes `/api`; auth for API must be handled in each route.
