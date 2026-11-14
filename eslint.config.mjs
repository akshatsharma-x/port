import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import retrograde from "./eslint-rules/retrograde.mjs";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { retrograde },
    rules: {
      "retrograde/spacing-steps": "error",
      "retrograde/no-raw-color": "error",
    },
  },
  {
    // One RAF (DESIGN.md §4.1): lib/raf-funnel.ts batches every caller into one native frame and
    // gsap.ticker runs the chain. App code registers per-frame work with onTick() instead.
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "requestAnimationFrame", message: "One RAF: use onTick() from lib/ticker.ts (DESIGN.md §4.1)." },
        { name: "cancelAnimationFrame", message: "One RAF: use onTick() from lib/ticker.ts (DESIGN.md §4.1)." },
      ],
      "no-restricted-properties": [
        "error",
        ...["window", "globalThis", "self"].flatMap((object) => [
          { object, property: "requestAnimationFrame", message: "One RAF: use onTick() from lib/ticker.ts (DESIGN.md §4.1)." },
          { object, property: "cancelAnimationFrame", message: "One RAF: use onTick() from lib/ticker.ts (DESIGN.md §4.1)." },
        ]),
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".venv/**",
    ".artifacts/**",
    "scripts/fonts/.cache/**",
  ]),
]);
