# Security

## Supabase admin client

- Use `createUserClient()` for user-scoped data access (RLS enforced).
- Only use `createAdminClient()` inside server route handlers.
- Always authenticate the user and verify ownership before admin access.
- Provide a short `reason` when creating the admin client for auditability.
- Never use `SUPABASE_SECRET_KEY` in middleware, client components, or UI.
