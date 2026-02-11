import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Explicit React version avoids calling plugin detection which can break under ESLint 10.
  // Keeps ESLint 10 while preventing `contextOrFilename.getFilename` errors in
  // eslint-plugin-react's version detection code.
  {
    settings: {
      react: {
        version: "19.2.4",
        defaultVersion: "19.2.4"
      }
    }
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts"
  ]),
  {
    rules: {
      "@next/next/no-img-element": "off",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/image",
              message: "Use the native <img> element instead of next/image."
            },
            {
              name: "@/lib/supabase/admin",
              message:
                "Admin client is privileged. Prefer createUserClient; only use in server routes after explicit authorization."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["app/api/**", "app/auth/**", "supabase/functions/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/image",
              message: "Use the native <img> element instead of next/image."
            }
          ]
        }
      ]
    }
  }
])

export default eslintConfig
