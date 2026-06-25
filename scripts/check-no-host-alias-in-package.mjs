#!/usr/bin/env node
// scripts/check-no-host-alias-in-package.mjs
//
// Structural guard for the package-first migration (epic #2344, S1a): the
// shared package @takazudo/zudo-doc MUST be self-contained. It is published to
// npm and consumed by every create-zudo-doc project, where the host's `@/…`
// path alias (a project-side tsconfig `paths` mapping to `src/`) does NOT
// exist. Any `import … from "@/…"` (or `export … from "@/…"`, or a bare
// `import "@/…"`) inside packages/zudo-doc/src/** would therefore resolve in
// this monorepo but fail at runtime / typecheck for downstream consumers — a
// silent boundary leak.
//
// This check fails (non-zero exit) if any source file under
// packages/zudo-doc/src/** references the `@/` host alias. Host-only singletons
// belong in project-side thin stubs, never in the package factory/source.
//
// Usage: node scripts/check-no-host-alias-in-package.mjs
// Exit 0 = no host-alias imports in the package. Exit 1 = leak detected.
//
// Wired into:
//   - package.json scripts (check:no-host-alias-in-package)
//   - scripts/run-b4push.sh (lightweight guard region)
//   - .github/workflows/pr-checks.yml (pure-Node guard job)
//   - scripts/check-b4push-ci-parity.mjs (REQUIRED_CI_GUARDS manifest)

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PKG_SRC_DIR = resolve(ROOT, "packages/zudo-doc/src");

// Only .ts/.tsx are import-bearing source. Skip test files (they may stub the
// host shape) and never descend into dist/ or node_modules.
const SOURCE_EXT_RE = /\.(ts|tsx)$/;
const SKIP_DIR_RE = /(^|\/)(__tests__|node_modules|dist)(\/|$)/;

/** Recursively collect .ts/.tsx files under `dir`, skipping test/dist dirs. */
function collectSourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(PKG_SRC_DIR, full);
    if (SKIP_DIR_RE.test(rel) || entry === "__tests__" || entry === "dist") {
      continue;
    }
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (SOURCE_EXT_RE.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

// Match the `@/…` host alias ONLY as a real module specifier — in an
// `import … from "@/…"`, `export … from "@/…"`, a bare `import "@/…"`, or a
// `require("@/…")` call. Anchoring on the `from`/`import`/`require` keyword (and
// the opening quote) prevents a false positive on an unrelated `@/` substring
// inside a string literal.
const HOST_ALIAS_RE =
  /(?:\bfrom\s*|\bimport\s*|\brequire\s*\(\s*)["'](@\/[^"']*)["']/g;

// Blank out `//` line comments and `/* … */` block comments BEFORE matching,
// replacing comment characters with spaces so line/column offsets are
// preserved. Several package modules carry JSDoc usage-example blocks that show
// the PROJECT-SIDE import pattern (e.g. `import { settings } from "@/config/…"`)
// to document how a consumer wires the export — those are documentation, not
// package imports, and must not trip the guard. String literals are left intact
// (a real `@/` specifier always sits inside a string after import/from/require).
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (match) =>
    match.replace(/[^\n]/g, " "),
  );
}

function scanFile(file) {
  const src = stripComments(readFileSync(file, "utf8"));
  const hits = [];
  for (const m of src.matchAll(HOST_ALIAS_RE)) {
    const before = src.slice(0, m.index);
    const line = before.split("\n").length;
    hits.push({ line, specifier: m[1] });
  }
  return hits;
}

function main() {
  const files = collectSourceFiles(PKG_SRC_DIR);
  const offenders = [];
  for (const file of files) {
    for (const hit of scanFile(file)) {
      offenders.push({
        path: relative(ROOT, file),
        line: hit.line,
        specifier: hit.specifier,
      });
    }
  }

  if (offenders.length > 0) {
    console.error("");
    console.error(
      "check:no-host-alias-in-package FAILED — the package must not import the host `@/` alias:",
    );
    console.error("");
    for (const o of offenders) {
      console.error(`  ${o.path}:${o.line}  →  "${o.specifier}"`);
    }
    console.error("");
    console.error(
      "The `@/` alias maps to the project's src/ and does NOT exist in published/scaffolded",
    );
    console.error(
      "consumers. Move the host-only singleton into a project-side thin stub and inject it,",
    );
    console.error(
      "or relocate the dependency into packages/zudo-doc/src/** with a relative import.",
    );
    return 1;
  }

  console.log(
    `OK — no host \`@/\` alias imports found in packages/zudo-doc/src (${files.length} source files scanned).`,
  );
  return 0;
}

process.exit(main());
