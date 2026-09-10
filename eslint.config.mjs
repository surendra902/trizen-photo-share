import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Photos are served from short-TTL presigned/blob URLs, which the
      // next/image optimizer cannot handle — plain <img> is intentional.
      "@next/next/no-img-element": "off",
      // Client pages follow the standard fetch-on-mount pattern (load data in
      // an effect, set state from it); these two lint rules flag that pattern
      // by design. Restructuring into RSC loaders is future work.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
