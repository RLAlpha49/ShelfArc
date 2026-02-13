# ADR-005: Local shadcn/ui Primitives and Design System

**Status**: Accepted

## Context

ShelfArc needs a consistent, accessible UI component library. Off-the-shelf component libraries often impose opinionated styling that conflicts with custom design requirements and increase bundle size with unused components.

## Decision

Use shadcn/ui as a local component library. Components are copied into `components/ui/` and customized in place rather than installed as a package dependency.

Configuration (`components.json`):

- Style: `base-mira` variant
- CSS variables: enabled via Tailwind v4
- Base color: neutral
- RSC: compatible (`rsc: true`)

Visual system:

- Rounded corners: `xl` / `2xl` for cards and dialogs
- Glass/warm-accent palette defined in `app/globals.css` via CSS custom properties
- Dark mode support via `next-themes` with `ThemeProvider`

## Consequences

- **Positive**: Full control over component behavior and styling — no version-lock to upstream.
- **Positive**: Only the components actually used are included — no unused code in the bundle.
- **Positive**: CSS variable theming integrates cleanly with Tailwind v4 and supports system/light/dark modes.
- **Trade-off**: No automatic upstream updates — manual effort to pull improvements from shadcn/ui when needed.
- **Trade-off**: Local primitives require team discipline to maintain consistency and avoid divergent customizations.
