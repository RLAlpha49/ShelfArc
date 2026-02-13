# Security invariants to preserve

- Never expose or import `SUPABASE_SECRET_KEY` in client or middleware code.
- Use `createUserClient()` for user-scoped operations; use `createAdminClient()` only in trusted server contexts with explicit reason.
- Treat all external input as untrusted:
  - sanitize text/html (`sanitizePlainText`/`sanitizeOptionalHtml`),
  - validate enums/numbers/username/url with runtime guards,
  - reject malformed payloads early (400-class errors).
- Storage/file endpoints must enforce both `isSafeStoragePath(path)` and per-user prefix ownership (`${user.id}/...`).
- Upload endpoint protections rely on same-origin checks + allowlisted mime/kind + size bounds + safe replacement paths.
- Public scrape/search/proxy endpoints must keep strict host/content-type/rate-limit controls to limit abuse.
- Since middleware excludes `/api`, every protected API route must authenticate explicitly.
