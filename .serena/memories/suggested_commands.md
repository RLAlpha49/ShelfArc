# Suggested commands (Windows / PowerShell)

## Install

- `bun install`

## Dev / Build / Start

- `bun run dev` — Next dev server (Turbopack)
- `bun run build` — production build
- `bun run start` — start production server

## Quality checks

- `bun run lint` — ESLint
- `bun run typecheck` — TypeScript typecheck
- `bun run format:write` — Prettier

## Tests

- `bun run test` — unit tests (Bun) + e2e
- `bun run test:e2e` — Playwright

## Dependency maintenance

- `bun run update` — npm-check-updates

## Useful PowerShell commands

- `Get-ChildItem` (list)
- `Set-Location <path>` (cd)
- `Get-Content <file>` (cat)
- `Select-String -Path <files> -Pattern <text>` (grep)
- `git status`, `git diff`, `git log`

> Note: `npm run <script>` or `pnpm run <script>` can also be used, but this repo has a `bun.lock`, so Bun is preferred.
