# Data Model & Entity Relations

## Entity relationship diagram

```
                          ┌──────────────────┐
                          │   auth.users     │ (Supabase managed)
                          │   id UUID PK     │
                          └────────┬─────────┘
                                   │ ON DELETE CASCADE
                                   ▼
                          ┌──────────────────┐
                          │    profiles      │
                          │──────────────────│
                          │ id UUID PK (FK)  │──► auth.users(id)
                          │ user_id INT UQ   │ (auto-identity, for display)
                          │ email TEXT       │
                          │ username TEXT    │ UQ idx (lowercased)
                          │ avatar_url TEXT? │    CHECK: ^\w{3,20}$
                          │ created_at       │
                          │ updated_at       │
                          └──┬────┬────┬─────┘
                             │    │    │
              ┌──────────────┘    │    └──────────────┐
              │                   │                   │
              ▼                   ▼                   ▼
   ┌──────────────────┐  ┌──────────────┐  ┌──────────────────┐
   │     series       │  │    tags      │  │  rate_limit_     │
   │──────────────────│  │──────────────│  │  buckets         │
   │ id UUID PK       │  │ id UUID PK   │  │──────────────────│
   │ user_id FK ──────│► │ user_id FK   │  │ key TEXT PK      │
   │ title TEXT       │  │ name TEXT    │  │ hits INT         │
   │ original_title?  │  │ color TEXT?  │  │ window_started_at│
   │ description?     │  │ created_at   │  │ blocked_until    │
   │ notes?           │  │ UQ(user,name)│  │ updated_at       │
   │ author?          │  └──────────────┘  └──────────────────┘
   │ artist?          │
   │ publisher?       │
   │ cover_image_url? │
   │ type title_type  │  (manga|light_novel|other)
   │ total_volumes?   │
   │ status TEXT?     │  (ongoing|completed|hiatus|...)
   │ tags TEXT[]      │
   │ created_at       │
   │ updated_at       │
   └──────┬───────────┘
          │ 1
          │
          │ ON DELETE SET NULL
          │ n
          ▼
   ┌───────────────────┐
   │    volumes        │
   │───────────────────│
   │ id UUID PK        │
   │ series_id FK? ────│► series(id)  [nullable, SET NULL on delete]
   │ user_id FK ───────│► profiles(id)
   │ volume_number INT │
   │ title TEXT?       │
   │ description?      │
   │ isbn TEXT?        │
   │ cover_image_url?  │
   │ edition TEXT?     │ (first_edition|collectors|omnibus|...)
   │ format TEXT?      │ (paperback|hardcover|digital|...)
   │ page_count INT?   │
   │ publish_date?     │
   │ purchase_date?    │
   │ purchase_price?   │ DECIMAL(10,2)
   │ ownership_status  │ (owned|wishlist)
   │ reading_status    │ (unread|reading|completed|on_hold|dropped)
   │ current_page INT? │
   │ amazon_url TEXT?  │
   │ rating INT?       │ CHECK(1..10)
   │ notes TEXT?       │
   │ started_at?       │
   │ finished_at?      │
   │ UQ(series_id, volume_number, edition) │
   └──────┬────────────┘
          │ 1
          │ ON DELETE CASCADE
          │ n
   ┌──────┴──────────────────────────────────┐
   │                                         │
   ▼                                         ▼
┌──────────────────┐              ┌──────────────────┐
│  price_history   │              │  price_alerts    │
│──────────────────│              │──────────────────│
│ id UUID PK       │              │ id UUID PK       │
│ volume_id FK ────│► volumes(id) │ volume_id FK ────│► volumes(id)
│ user_id FK ──────│► profiles    │ user_id FK ──────│► profiles
│ price DEC(10,2)  │              │ target_price     │ DEC(10,2)
│ currency TEXT    │ def 'USD'    │ currency TEXT    │ def 'USD'
│ source TEXT      │ def 'amazon' │ enabled BOOL     │ def true
│ product_url?     │              │ triggered_at?    │
│ scraped_at       │              │ created_at       │
│ (append-only)    │              │ updated_at       │
└──────────────────┘              │ UQ(volume,user)  │
                                  └──────────────────┘
```

## Key indexes

| Table         | Index                                   | Purpose                          |
| ------------- | --------------------------------------- | -------------------------------- |
| series        | (user_id), (user_id, type)              | User-scoped filtering            |
| series        | (user_id, title), (user_id, updated_at) | Sorting                          |
| series        | GIN(tags)                               | Tag-based filtering              |
| volumes       | (user_id), (series_id), (isbn)          | Lookups                          |
| volumes       | (user_id, ownership_status)             | Status filtering                 |
| volumes       | (user_id, reading_status)               | Status filtering                 |
| volumes       | (series_id, volume_number)              | Series volume ordering           |
| volumes       | (user_id, updated_at DESC)              | Recent activity sort             |
| volumes       | (user_id, purchase_date DESC)           | Purchase date sort               |
| price_history | (volume_id, scraped_at DESC)            | Latest price lookup              |
| price_alerts  | (user_id, enabled)                      | Active alerts for user           |
| profiles      | LOWER(username) UNIQUE                  | Case-insensitive username lookup |

## DB enums

| Enum             | Values                                       |
| ---------------- | -------------------------------------------- |
| title_type       | manga, light_novel, other                    |
| ownership_status | owned, wishlist                              |
| reading_status   | unread, reading, completed, on_hold, dropped |

## RLS policy summary

| Table         | SELECT                         | INSERT             | UPDATE          | DELETE          |
| ------------- | ------------------------------ | ------------------ | --------------- | --------------- |
| profiles      | uid() = id                     | (auto via trigger) | uid() = id      | —               |
| series        | uid() = user_id                | uid() = user_id    | uid() = user_id | uid() = user_id |
| volumes       | uid() = user_id                | uid() = user_id    | uid() = user_id | uid() = user_id |
| tags          | uid() = user_id                | uid() = user_id    | uid() = user_id | uid() = user_id |
| price_history | uid() = user_id                | uid() = user_id    | —               | —               |
| price_alerts  | uid() = user_id                | uid() = user_id    | uid() = user_id | uid() = user_id |
| rate*limit*\* | (locked down, RPC-only access) |

All policies use `(select auth.uid()) = user_id` pattern. Profile creation handled by `handle_new_user` trigger on `auth.users` insert.
