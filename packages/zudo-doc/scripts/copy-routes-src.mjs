#!/usr/bin/env node
// scripts/copy-routes-src.mjs
//
// Copy the package-owned route ENTRYPOINT SOURCES from `src/routes/*.{tsx,ts}`
// into a published `routes-src/` tree, REWRITING their parent-relative imports
// to bare `@takazudo/zudo-doc/*` specifiers (S1 #2370).
//
// WHY this exists:
//   It produced the route `.tsx` sources the routes plugin used to inject:
//   zfb 0.1.0-next.65 could not read `paths()` from a compiled `.js` (#2370).
//   zfb 7.2.0 accepts compiled ESM route modules, so since #4838 the plugin
//   injects `dist/routes/*.js` directly and no longer reads this tree. The
//   published package still ships `routes-src/` and the `./routes-src/*`
//   export as a public compatibility surface; whether to retire it is a
//   separate decision (#4837). Until then this script keeps producing it.
//
// WHY the import rewrite is REQUIRED (not a verbatim copy):
//   Every `src/routes/*.tsx` imports siblings via parent-relative paths
//   (`../<seg>/...`, `../<file>.js`) that reach UP into `src/`. The published
//   tree has no parent `src/`, so a verbatim copy would dangle. We rewrite each
//   parent-relative specifier to the equivalent published package subpath
//   (`@takazudo/zudo-doc/<seg>` / `@takazudo/zudo-doc/<file>`), which resolves
//   through the consumer's node_modules. Every rewritten specifier MUST be a
//   real entry in package.json#exports (verified by #2370 + the no-src test).
//
// LEFT UNTOUCHED by the rewrite:
//   - same-dir relatives (`./_context.js`, `./_chrome.js`, `./_docs-helpers.js`)
//     — these helpers ARE copied alongside the entrypoints into routes-src/.
//   - the `virtual:zudo-doc-route-context` module (provided by the plugin).
//   - existing bare specifiers (`@takazudo/zfb/content`, `@takazudo/*`, etc.).
//
// Runs in the tsup `onSuccess` chain AFTER copy-eject-sources.mjs. A one-shot
// build's clean (`clean: !options.watch`) wipes `dist/` only — `routes-src/` is
// not under `dist/`, so it is NEVER automatically cleaned, under watch or
// otherwise. We wipe+recreate it here for deterministic output (no stale files
// from renamed/removed routes).

import { cpSync, rmSync, mkdirSync, statSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const SRC_ROUTES = resolve(PKG_ROOT, "src", "routes");
const DEST_ROUTES = resolve(PKG_ROOT, "routes-src");

/** Returns true for files that should be excluded from the routes-src copy. */
function shouldExclude(name) {
  if (/\.test\.[cm]?[jt]sx?$/.test(name)) return true; // *.test.ts / *.test.tsx
  if (name === "vitest.config.ts") return true;
  return false;
}

// ── Import rewrite ─────────────────────────────────────────────────────────
//
// Two parent-relative shapes, mapped to package subpaths:
//   ../<seg>/<rest>          → @takazudo/zudo-doc/<seg>     (SUBDIR form)
//   ../<file>.{js,ts,tsx}    → @takazudo/zudo-doc/<file>    (FILE form)
//
// Applied across THREE specifier syntaxes (semantic coverage, matching the
// check-routes-src.mjs guard): static `from "…"`, dynamic `import("…")`, and
// bare side-effect `import "…"`. Today only static `from` imports exist, but
// covering all three keeps the script correct as routes evolve.

const PARENT_SUBDIR = String.raw`\.\.\/([\w-]+)\/[^"']+`;
const PARENT_FILE = String.raw`\.\.\/([\w-]+)\.[cm]?[jt]sx?`;

/** Rewrite every parent-relative specifier in `code` to a bare package subpath. */
function rewriteImports(code) {
  let out = code;

  // Static / re-export `from "…"` and `from '…'`.
  //   SUBDIR: from "../<seg>/<rest>"  → from "@takazudo/zudo-doc/<seg>"
  out = out.replace(
    new RegExp(String.raw`(from\s+)(["'])` + PARENT_SUBDIR + String.raw`\2`, "g"),
    (_m, from, q, seg) => `${from}${q}@takazudo/zudo-doc/${seg}${q}`,
  );
  //   FILE: from "../<file>.ext"      → from "@takazudo/zudo-doc/<file>"
  out = out.replace(
    new RegExp(String.raw`(from\s+)(["'])` + PARENT_FILE + String.raw`\2`, "g"),
    (_m, from, q, file) => `${from}${q}@takazudo/zudo-doc/${file}${q}`,
  );

  // Dynamic `import("…")`.
  out = out.replace(
    new RegExp(String.raw`(import\s*\(\s*)(["'])` + PARENT_SUBDIR + String.raw`\2`, "g"),
    (_m, head, q, seg) => `${head}${q}@takazudo/zudo-doc/${seg}${q}`,
  );
  out = out.replace(
    new RegExp(String.raw`(import\s*\(\s*)(["'])` + PARENT_FILE + String.raw`\2`, "g"),
    (_m, head, q, file) => `${head}${q}@takazudo/zudo-doc/${file}${q}`,
  );

  // Bare side-effect `import "…"` (NOT `import x from`, NOT `import(`).
  out = out.replace(
    new RegExp(String.raw`(import\s+)(["'])` + PARENT_SUBDIR + String.raw`\2`, "g"),
    (_m, head, q, seg) => `${head}${q}@takazudo/zudo-doc/${seg}${q}`,
  );
  out = out.replace(
    new RegExp(String.raw`(import\s+)(["'])` + PARENT_FILE + String.raw`\2`, "g"),
    (_m, head, q, file) => `${head}${q}@takazudo/zudo-doc/${file}${q}`,
  );

  return out;
}

// ── Copy + rewrite ─────────────────────────────────────────────────────────

try {
  statSync(SRC_ROUTES);
} catch {
  process.stderr.write(
    `\n[copy-routes-src] ERROR: src/routes/ is missing — cannot build routes-src.\n\n`,
  );
  process.exit(1);
}

// Wipe the old routes-src/ tree so removed/renamed routes don't linger.
rmSync(DEST_ROUTES, { recursive: true, force: true });
mkdirSync(DEST_ROUTES, { recursive: true });

let copied = 0;
let rewritten = 0;

for (const entry of readdirSync(SRC_ROUTES, { withFileTypes: true })) {
  if (entry.isDirectory()) continue; // src/routes is flat (no __tests__ etc. to recurse)
  const name = entry.name;
  if (!/\.[cm]?[jt]sx?$/.test(name)) continue; // .ts / .tsx only
  if (shouldExclude(name)) continue;

  const srcFile = join(SRC_ROUTES, name);
  const destFile = join(DEST_ROUTES, name);

  const original = readFileSync(srcFile, "utf8");
  // A boundary definition must have one module identity in zfb v3+ (#4059).
  // Host route stubs reach dist/routes while injected routes reach this staged
  // tree. Re-export the compiled definition instead of making a second copy.
  // Keep the virtual configuration import in the canonical module: it still
  // evaluates independently in the SSR and hydrated client graphs.
  const transformed = name === "_design-token-panel-bootstrap.tsx"
    ? 'export { ConfiguredDesignTokenPanelBootstrap } from "@takazudo/zudo-doc/routes/design-token-panel-bootstrap";\n'
    : rewriteImports(original);
  writeFileSync(destFile, transformed, "utf8");
  copied++;
  if (transformed !== original) rewritten++;
}

if (copied === 0) {
  process.stderr.write(
    `\n[copy-routes-src] ERROR: no route source files copied from src/routes/.\n\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `[copy-routes-src] routes-src/ OK (${copied} files, ${rewritten} rewritten)\n`,
);
