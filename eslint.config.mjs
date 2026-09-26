import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// src/world/** is the PURE side of the Expedition layer (docs/design/20 §2.5, §7.0): validators, the pipeline and
// Vitest (node) import it, so it may never import Phaser or React (not even as types).
const WORLD_PURITY_PATHS = [
  { name: "phaser", message: "src/world/** is pure: no Phaser. Put drawing in src/game/hosts/expedition/**." },
  { name: "react", message: "src/world/** is pure: no React. Put UI in src/game/expedition/**." },
  { name: "react-dom", message: "src/world/** is pure: no React." },
];
const WORLD_PURITY_PATTERNS = [
  { group: ["phaser/*", "react/*", "react-dom/*", "next", "next/*"], message: "src/world/** is pure: no Phaser, React or Next." },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/world/**/*.{ts,tsx}"],
    ignores: ["src/world/contraptions/**", "src/world/sandboxes/**"],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", { paths: WORLD_PURITY_PATHS, patterns: WORLD_PURITY_PATTERNS }],
    },
  },
  {
    // Metas never see params or solutions at runtime (§2.5.6, the live-reveal rule): no runtime imports of mechanics
    // modes or the registry. Type-only imports are fine; src/mechanics/util.ts (evalExact*) is allowed.
    files: ["src/world/contraptions/**/*.{ts,tsx}", "src/world/sandboxes/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: WORLD_PURITY_PATHS,
          patterns: [
            ...WORLD_PURITY_PATTERNS,
            {
              group: ["**/mechanics/families/**", "**/mechanics/registry", "**/mechanics/registry.ts", "**/mechanics/stub", "**/world/library"],
              allowTypeImports: true,
              message: "Contraption metas may not import mechanics modes or the registry at runtime (docs/design/20 §2.5.6).",
            },
          ],
        },
      ],
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
