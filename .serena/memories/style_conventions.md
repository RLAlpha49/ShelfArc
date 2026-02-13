# Style & conventions

## Formatting

- Prettier: **double quotes**, **no semicolons**, `trailingComma: none`, `tabWidth: 2`.
- Tailwind class sorting via `prettier-plugin-tailwindcss`.

## Linting

- ESLint config is `eslint-config-next` (core-web-vitals + typescript).

## TypeScript

- `strict: true`, `moduleResolution: bundler`.
- Path alias: `@/*` mapped to project root.

## A11y / lint quirks

- Prefer semantic elements over ARIA roles when possible:
  - Use `<fieldset>/<legend>` instead of `role="group"`.
  - Use `<ul>/<li>` instead of `role="list"` / `role="listitem"`.
- Prefer `document.documentElement.dataset.*` over `setAttribute("data-…", …)`.
- Prefer `globalThis` (e.g. `globalThis.window`) over direct `window` references.

## UI conventions

- shadcn/ui configuration: `style: base-mira`, `cssVariables: true`, `baseColor: neutral`.
- Tailwind CSS lives in `app/globals.css`.
- App Router (`app/`) with React Server Components enabled (`components.json` has `rsc: true`).
