# Security

## Supabase admin client

- Use `createUserClient()` for user-scoped data access (RLS enforced).
- Only use `createAdminClient()` inside server route handlers.
- Always authenticate the user and verify ownership before admin access.
- Provide a short `reason` when creating the admin client for auditability.
- Never use `SUPABASE_SECRET_KEY` in middleware, client components, or UI.

## Input validation & sanitization

### Core utilities

- **`lib/sanitize-html.ts`** — Centralized sanitization:
  - `sanitizeHtml(value)` — DOMPurify-based, allows limited HTML tags (a, b, blockquote, br, em, i, li, ol, p, strong, u, s, span, ul) and attributes (href, title). Use for `description` fields that may contain HTML from external sources (e.g. Google Books).
  - `sanitizeOptionalHtml(value)` — Returns `null` for empty/falsy input, otherwise calls `sanitizeHtml` and trims. Use for optional HTML description fields.
  - `sanitizePlainText(value, maxLength?)` — Strips ALL HTML tags, trims, optionally truncates. Use for text fields that should never contain HTML (title, author, name, etc.).
  - `sanitizeOptionalPlainText(value, maxLength?)` — Returns `null` for empty/falsy, otherwise calls `sanitizePlainText`. Use for optional plain text fields.

- **`lib/validation.ts`** — Runtime enum/type validators:
  - `TITLE_TYPES`, `OWNERSHIP_STATUSES`, `READING_STATUSES`, `BOOK_ORIENTATIONS` — Enum arrays.
  - `isValidTitleType()`, `isValidOwnershipStatus()`, `isValidReadingStatus()`, `isValidBookOrientation()` — Type guards.
  - `isPositiveInteger()`, `isNonNegativeInteger()`, `isNonNegativeFinite()` — Numeric validators.
  - `isValidUrl()` — URL format check (http/https).
  - `HEX_COLOR_PATTERN` — Regex for hex color validation.

### Field conventions (max lengths)

| Field                        | Max length | Sanitizer                                     |
| ---------------------------- | ---------- | --------------------------------------------- |
| name, title                  | 200-500    | `sanitizePlainText`                           |
| author, publisher, artist    | 1000       | `sanitizeOptionalPlainText`                   |
| description (series/volumes) | unlimited  | `sanitizeOptionalHtml` (allows limited HTML)  |
| description (bookshelves)    | 2000       | `sanitizeOptionalPlainText` (plain text only) |
| notes                        | 5000       | `sanitizeOptionalPlainText`                   |
| isbn                         | 20         | `sanitizeOptionalPlainText`                   |
| edition, format              | 200        | `sanitizeOptionalPlainText`                   |
| display_name                 | 100        | `sanitizePlainText`                           |
| tags (each)                  | 100        | `sanitizePlainText`                           |
| shelf_color                  | —          | `HEX_COLOR_PATTERN` validation                |

### Write path coverage

All database write paths are validated and sanitized:

1. **API routes (server-side):**
   - `app/api/bookshelves/route.ts` POST — name length, description sanitized, shelf_color hex validated, row dimensions range-checked.
   - `app/api/bookshelves/[id]/route.ts` PATCH — via `validateBookshelfUpdate()` helper.
   - `app/api/bookshelves/[id]/items/route.ts` POST/PATCH — `validateShelfItemInput()` / `validateShelfItemUpdate()` validate row_index, position_x, orientation enum, z_index. Malformed JSON caught.

2. **Auth actions (`app/auth/actions.ts`):**
   - `login` — email trimmed + basic format check, password non-empty.
   - `signup` — email validated, password min 6 chars, displayName sanitized (100 char limit).

3. **Client-side hooks (`lib/hooks/use-library.ts`):**
   - `createSeries` — all text fields sanitized, type/tags/total_volumes validated.
   - `editSeries` — `sanitizeSeriesUpdate()` helper.
   - `createVolume` — `buildSanitizedVolumeInsert()` helper.
   - `editVolume` — `sanitizeVolumeUpdate()` helper.

4. **JSON import (`components/settings/json-import.tsx`):**
   - `validateImportStructure()` — structural validation.
   - `sanitizeSeriesImport()` / `sanitizeVolumeImport()` — field sanitization.

5. **Settings profile (`app/(app)/settings/page.tsx`):**
   - `handleSaveProfile` — display_name sanitized.

### Defense in depth

- **RLS** on all tables with `user_id = auth.uid()` policies.
- **DB enum constraints** for `title_type`, `ownership_status`, `reading_status`, `book_orientation`.
- **DB trigger** `validate_shelf_item_user_match()` on shelf_items INSERT.
- **App-level validation** catches invalid input early with descriptive errors.

### Rules for new write paths

- Sanitize text: `sanitizePlainText` / `sanitizeOptionalPlainText` for plain text, `sanitizeOptionalHtml` for HTML fields.
- Validate enums at runtime using type guards from `lib/validation.ts`.
- Validate numerics (range, integer, finite) before writing.
- Authenticate user and verify ownership before writes.
- Wrap `request.json()` in try/catch in API routes.
- Set `user_id` server-side; never trust client-provided user IDs.
- Early return with 400 for validation failures.
- Extract validation into helpers when cognitive complexity exceeds 15.
