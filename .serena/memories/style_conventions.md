# Style & conventions

## Formatting

- Prettier: **double quotes**, **no semicolons**, `trailingComma: none`, `tabWidth: 2`.
- Tailwind class sorting via `prettier-plugin-tailwindcss`.

## Linting

- ESLint config is `eslint-config-next` (core-web-vitals + typescript).

## TypeScript

- `strict: true`, `moduleResolution: bundler`.
- Path alias: `@/*` mapped to project root.

## UI conventions

- shadcn/ui configuration: `style: base-mira`, `cssVariables: true`, `baseColor: neutral`.
- Tailwind CSS lives in `app/globals.css`.
- App Router (`app/`) with React Server Components enabled (`components.json` has `rsc: true`).
