import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // The local mock preview's build (dev-mocks/), git-ignored.
    ".next-mock/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Native iOS shell: generated Xcode project plus copied bridge scripts.
    "ios/**",
    "app-shell/**",
    // Local, git-ignored launch-video project (vendored minified GSAP).
    "brag-output*/**",
  ]),
]);

export default eslintConfig;
