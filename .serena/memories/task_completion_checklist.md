# Task completion checklist

When finishing a coding task:

1. **Format**: run `bun run format:write` if files were edited.
2. **Lint**: run `bun run lint`.
3. **Typecheck**: run `bun run typecheck`.
4. **Tests**: run `bun run test` (or at least `bun run test:e2e` if relevant).
5. **Env vars**: confirm any required env vars are present in `.env.local` (see `.env.local.example`).
6. **Security**: avoid exposing `SUPABASE_SECRET_KEY` on the client.
