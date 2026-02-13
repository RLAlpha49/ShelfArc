# ADR-003: Dual Zustand Stores

**Status**: Accepted

## Context

ShelfArc needs to persist user preferences (theme, default sort, view mode) and library interaction state (filters, sort, view presets, selection) across sessions. A single monolithic store would grow unwieldy and couple unrelated concerns.

## Decision

Use two separate Zustand stores with `persist` middleware:

1. **`library-store`** (`lib/store/library-store.ts`): Data-oriented state for the library page — filter/sort/view presets, selection state, saved filter presets. Persisted to `localStorage` under a library-specific key. Hydration-aware to avoid SSR mismatches.

2. **`settings-store`** (`lib/store/settings-store.ts`): Application-wide user preferences — appearance settings, workflow defaults, and feature flags. Persisted to `localStorage` under a settings-specific key. Applied at mount time via `SettingsApplier`.

Both stores use Zustand's `persist` middleware with JSON storage and expose hydration status to prevent flash-of-default-state.

## Consequences

- **Positive**: Clear responsibility boundaries — library state vs. app-wide settings.
- **Positive**: Independent hydration — settings load immediately, library state loads when the library page mounts.
- **Positive**: Smaller, focused stores are easier to test and refactor.
- **Trade-off**: Two stores to maintain. Cross-store coordination (e.g., settings affecting library defaults) requires explicit wiring.
- **Trade-off**: Local-first persistence means no cross-device sync (planned as F-10: cloud-synced saved searches).
