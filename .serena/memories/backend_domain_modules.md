# Backend/domain module map

- Input safety:
  - `lib/validation.ts` runtime guards (enums, numeric checks, URL/username validators).
  - `lib/sanitize-html.ts` html/plain-text sanitization helpers.
  - `lib/library/sanitize-library.ts` sanitized series/volume write helpers.
- Normalization/search:
  - `lib/library/volume-normalization.ts`, `lib/normalize-title.ts` for dedupe/grouping/title cleanup.
  - `lib/books/search.ts`, `lib/books/isbn.ts`, `lib/books/google-books-keys.ts` for provider normalization + ISBN + key rotation.
  - `lib/csv/*` for import parsing/scoring/types.
- Guardrails and resilience:
  - `lib/rate-limit.ts` in-memory RL, `lib/rate-limit-distributed.ts` RPC-backed RL with fallback.
  - `lib/concurrency/limiter.ts` queue-based concurrency limits.
  - `lib/storage/safe-path.ts` anti-path-traversal validation.
- Supabase boundaries:
  - `lib/supabase/server.ts` user-scoped server client.
  - `lib/supabase/admin.ts` privileged service client requiring explicit reason.
  - `lib/supabase/client.ts` browser client.
  - `lib/supabase/middleware.ts` session refresh + route guard logic.
- Pricing pipeline: `lib/books/price/amazon-price.ts` builds search context, fetches Amazon HTML with protections, parses/scores results.
