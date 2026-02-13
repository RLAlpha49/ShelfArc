# ADR-002: Client-Heavy Library with Server API Routes

**Status**: Accepted

## Context

The library page is the most interaction-dense surface in ShelfArc: real-time filtering, sorting, bulk selection, drag-and-drop reordering, inline edits, dialog flows, and virtualized rendering. These features require frequent state updates and DOM manipulation that benefit from running entirely on the client.

At the same time, data mutations (CRUD, search, scraping, storage) benefit from running on the server where Supabase credentials, rate limiting, and external API keys are available.

## Decision

Keep the library page and its components as client-heavy React components (`"use client"`). All data mutations and external API calls go through Next.js API routes under `app/api/`.

- **Client**: filtering, sorting, search UI, selection, dialogs, virtualized grid/list, local state derivations via Zustand.
- **Server (API routes)**: Supabase CRUD, Google Books search, Amazon price scraping, storage/upload, CSV import processing.

The `useLibrary` hook bridges the two: it loads data from Supabase on mount, maintains local state, and calls API routes for mutations.

## Consequences

- **Positive**: Responsive, instant UI interactions without round-trips.
- **Positive**: Secrets (Supabase service key, API keys) stay server-side.
- **Positive**: Rate limiting, validation, and CSRF checks happen at the API layer.
- **Trade-off**: Initial page load fetches all library data client-side, which may not scale to very large collections (addressed by planned I-030: server-side pagination).
- **Trade-off**: Larger client bundle due to client-heavy components — mitigated by code splitting and lazy-loading dialogs.
