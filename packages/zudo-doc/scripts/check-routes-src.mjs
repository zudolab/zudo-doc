#!/usr/bin/env node
// scripts/check-routes-src.mjs
//
// Presence + import-hygiene guard for the published `routes-src/` tree (S1 #2370).
// Run as part of the `prepack` hook so a build that skipped the
// `copy-routes-src.mjs` step — or left a parent-relative import unrewritten —
// fails loudly instead of publishing a package whose injected dynamic routes
// would dangle in a consumer's node_modules.
//
// Two checks:
//   1. PRESENCE  — routes-src/ exists, is non-empty, and contains the known
//                  entrypoint set (the resolver in plugins/routes.ts points at
//                  these by basename).
//   2. HYGIENE   — NO residual parent-relative import remains. The scan is
//                  SEMANTIC (matches import/export specifier syntax), NOT a
//                  broad `../` text grep — so comments and string literals
//                  containing `../` do not produce false positives. We match:
//                    - static / re-export:  … from "../…"  /  … from '../…'
//                    - dynamic:             import("../…")
//                    - bare side-effect:    import "../…"
//
// Exit 0 → routes-src/ present, non-empty, every entrypoint there, zero
//           residual parent-relative imports.
// Exit 1 → missing/empty dir, missing entrypoint, or a residual `../` import
//           (with a clear diagnostic naming the file + line).

import { statSync, readdirSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTES_SRC = resolve(__dirname, "../routes-src");

/** Route entrypoint basenames the resolver in plugins/routes.ts injects.
 *  Must stay in sync with deriveRoutes() in src/plugins/routes.ts. */
const REQUIRED_ENTRYPOINTS = [
  "index.tsx",
  "404.tsx",
  "sitemap.xml.tsx",
  "robots.txt.tsx",
  "docs-slug.tsx",
  "docs-versions.tsx",
  "docs-tags-index.tsx",
  "docs-tags-tag.tsx",
  "api-ai-chat.tsx",
  "locale-index.tsx",
  "locale-docs-slug.tsx",
  "locale-docs-versions.tsx",
  "locale-docs-tags-index.tsx",
  "locale-docs-tags-tag.tsx",
  "v-docs-slug.tsx",
  "v-locale-docs-slug.tsx",
];

// Semantic specifier matchers for a parent-relative ("../") import.
// Each captures the specifier syntax that precedes the quoted string, so a
// `../` appearing in a comment or arbitrary string literal is NOT matched.
const RESIDUAL_PATTERNS = [
  // static / re-export:  … from "../…"
  /\bfrom\s+(["'])\.\.\/[^"']*\1/,
  // dynamic:             import("../…")
  /\bimport\s*\(\s*(["'])\.\.\/[^"']*\1/,
  // bare side-effect:    import "../…"   (import directly followed by a string)
  /\bimport\s+(["'])\.\.\/[^"']*\1/,
];

let ok = true;

// ── (1) PRESENCE ───────────────────────────────────────────────────────────
let files = [];
try {
  statSync(ROUTES_SRC);
  files = readdirSync(ROUTES_SRC, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name);
} catch {
  process.stderr.write(
    `\n[check-routes-src] ERROR: routes-src/ is missing.\n` +
      `  Run \`pnpm --filter @takazudo/zudo-doc build\` first so the tsup\n` +
      `  onSuccess hook (copy-routes-src.mjs) generates the files, then retry.\n\n`,
  );
  process.exit(1);
}

if (files.length === 0) {
  process.stderr.write(
    `\n[check-routes-src] ERROR: routes-src/ exists but is empty.\n` +
      `  The tsup onSuccess hook (copy-routes-src.mjs) may have failed.\n` +
      `  Re-run \`pnpm --filter @takazudo/zudo-doc build\` and check for errors.\n\n`,
  );
  process.exit(1);
}

for (const ep of REQUIRED_ENTRYPOINTS) {
  if (!files.includes(ep)) {
    process.stderr.write(
      `\n[check-routes-src] ERROR: routes-src/${ep} is missing — the resolver\n` +
        `  in plugins/routes.ts injects it. Re-run the package build.\n\n`,
    );
    ok = false;
  }
}

// ── (2) HYGIENE — no residual parent-relative imports ────────────────────────
let residualCount = 0;
for (const name of files) {
  if (!/\.[cm]?[jt]sx?$/.test(name)) continue;
  const text = readFileSync(join(ROUTES_SRC, name), "utf8");
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (RESIDUAL_PATTERNS.some((re) => re.test(line))) {
      process.stderr.write(
        `[check-routes-src] ERROR residual parent-relative import: ` +
          `routes-src/${name}:${i + 1}: ${line.trim()}\n`,
      );
      residualCount++;
      ok = false;
    }
  }
}

if (residualCount > 0) {
  process.stderr.write(
    `\n[check-routes-src] ${residualCount} residual parent-relative import(s) found.\n` +
      `  copy-routes-src.mjs must rewrite every \`../…\` specifier to a bare\n` +
      `  \`@takazudo/zudo-doc/*\` subpath — a parent-relative import would dangle\n` +
      `  in a published consumer (no \`src/\` parent ships in the tarball).\n\n`,
  );
}

if (!ok) process.exit(1);

process.stdout.write(
  `[check-routes-src] routes-src/ OK (${files.length} files, ${REQUIRED_ENTRYPOINTS.length} entrypoints, 0 residual ../ imports)\n`,
);
