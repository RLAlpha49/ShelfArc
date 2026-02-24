import type { KnipConfig } from "knip"

const config: KnipConfig = {
  // Lighthouse CI scripts are run directly by the CI runner; Supabase Edge Functions
  // are deployed via the Supabase CLI. Neither is imported by the Next.js module graph.
  ignore: [
    "lighthousePuppeteerScript.cjs",
    "lighthouserc.cjs",
    "supabase/functions/**"
  ],

  // lint-staged: invoked as a binary from .husky/pre-commit via `bun run lint-staged`.
  // Knip's husky plugin does not recognise `bun run <binary>`, causing a false-positive
  // "unused devDependency" warning. postcss is a peer of @tailwindcss/postcss and is
  // managed transitively; it surfaces in postcss.config.mjs as an implicit framework dep.
  ignoreDependencies: ["postcss", "lint-staged"],

  // ncu is the binary from npm-check-updates used ad-hoc via `ncu -u` in the update
  // script. It is intentionally not listed as a devDependency (run via bunx/npx).
  ignoreBinaries: ["ncu"],

  // Suppress false-positive "unused export" warnings for helpers/constants that are
  // exported for external consumers but also called within their own defining file.
  ignoreExportsUsedInFile: true,

  // Treat the following files as public-API entry points so their named exports are
  // not flagged as unused:
  //   components/ui/**  - shadcn/ui design-system; sub-exports are part of public API.
  //   lib/api/endpoints.ts - typed client wrappers; some lack a frontend caller yet.
  //   lib/types/**       - database and domain type aliases; consumed structurally by TS.
  //   lib/api-response.ts - typed envelope helpers used by API routes and tests.
  entry: [
    "components/ui/**/*.{ts,tsx}",
    "lib/api/endpoints.ts",
    "lib/types/**/*.ts",
    "lib/api-response.ts"
  ],

  // Type-only exports (interfaces, type aliases) are intentional public API. Knip cannot
  // always trace purely-type consumption across module boundaries, producing many false
  // positives. Disable the "types" category globally.
  exclude: ["types"]
}

export default config
