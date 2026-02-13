# Supabase schema + RLS + integrity notes

- Enums: `title_type` (light_novel|manga|other), `ownership_status` (owned|wishlist), `reading_status` (unread|reading|completed|on_hold|dropped).
- Core tables: `profiles`, `series`, `volumes`, `tags`, `price_history`, `price_alerts`, `rate_limit_buckets`.
- Key relations: all user-owned domain tables reference `profiles.id`; `volumes` links to `series` (nullable via `SET NULL` on delete).
- RLS enabled broadly with self-ownership policies (`auth.uid() = user_id` or equivalent).
- Distributed RL model uses RPC functions (`rate_limit_consume`, `rate_limit_cleanup`) and locked-down table access for `rate_limit_buckets`.
- Triggers/functions include auto profile creation (`handle_new_user`) and `updated_at` maintenance.
- Data-integrity note: DB constrains `volumes.rating` to 1..5; app-level validation should stay aligned to avoid write-time conflicts.
