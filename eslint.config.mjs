import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
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
    files: ["app/api/**", "supabase/functions/**"],
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
