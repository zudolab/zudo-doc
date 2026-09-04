#!/usr/bin/env node
// scripts/gen-nav-overflow-script.mjs
//
// Generates the git-committed `src/header/nav-overflow-generated-script.ts`
// build artifact (zudolab/zudo-doc#3534, epic #3533).
//
// WHY this exists (the load-bearing reason — recoverable only from the
// issue): the previous `src/header/nav-overflow-script.ts` built
// NAV_OVERFLOW_SCRIPT as a template literal evaluated at MODULE-EVALUATION
// TIME, embedding `pathMatchesNavPath`/`computeActiveNavPath` via
// `Function.prototype.toString()` on the LIVE imported bindings, plus a third
// live `CURRENT_PATH_SCRIPT_PRELUDE` interpolation added in 5.6.0
// (zudolab/zudo-doc#3502). Because the string was recomputed by executing
// code whose emit shape depends on the CONSUMER's own bundler, two
// renderings of the same logical script hashed differently (measured: zfb
// SSR 12392 bytes vs a consumer Vite build 12216 bytes) — so a consumer
// publishing a CSP inline-script hash could never reconcile it against this
// package's own build.
//
// This script freezes the whole embedding ONCE, at zudo-doc's own package
// build time, into a plain string literal — so nothing downstream ever
// reflects on a live function again, and the emitted bytes become
// consumer-bundler-independent.
//
// HOW (package build): reads `src/current-path/index.ts`,
// `src/header/nav-active.ts`, `src/header/nav-class-tokens.ts`, and
// `src/transitions/page-events.ts`
// SOURCE, strips TypeScript types deterministically via esbuild's
// `transformSync()` (same rationale as gen-search-widget-script.mjs — see
// that file's header comment for the full `ts.transpileModule()` vs esbuild
// history, zudolab/zudo-doc#3422 / #3430 — identical here: esbuild is only a
// package dependency (it is also used by the shipped ejected-header generator),
// and the effective floor tracks the root `pnpm.overrides` range), executes
// each transpiled CommonJS module in an isolated sandbox (empty
// `module`/`exports`; all four source files are import-free), then reads
// the REAL runtime values off each sandbox's `exports`:
//   - `exports.CURRENT_PATH_SCRIPT_PRELUDE` — read as a VALUE, never
//     reconstructed (it is itself a pre-built string, not a function).
//   - `exports.pathMatchesNavPath.toString()` /
//     `exports.computeActiveNavPath.toString()` — the exact same
//     Function.prototype.toString() mechanism the old code used, just run
//     once here instead of on every module evaluation downstream.
//     `computeActiveNavPath` closes over `pathMatchesNavPath`, so both are
//     extracted together (nav-active.ts:70-73 documents the closure).
//   - `exports.NAV_TOP_ACTIVE` / … — the twelve class-token arrays from
//     nav-class-tokens.ts, read as real array values. The three splice
//     formatters (`clsArgs`/`clsLiteral`/`clsAppend`) that used to live in
//     nav-overflow-script.ts move into this generator (below) since they now
//     run once at generation time instead of at every module evaluation.
//   - `exports.AFTER_NAVIGATE_EVENT` — the real event-name string, never
//     hardcoded here.
//
// **Duplicates the gen-search-widget-script.mjs scaffolding on purpose — does
// NOT extract a shared lib.** Factoring the two generators together would
// require touching the search-widget generator, whose output is CSP-hash-pinned
// in two places (its own drift-guard test and any downstream consumer's
// published hash); that byte-preserving-refactor risk isn't worth coupling to
// this change. A shared lib is a possible follow-up, not this one
// (zudolab/zudo-doc#3533 epic body).
//
// Composes the full IIFE script string (the template logic moved out of
// nav-overflow-script.ts) and writes it, write-if-changed, to
// `src/header/nav-overflow-generated-script.ts` with a GENERATED banner.
//
// Like `search-widget-script/generated-script.ts`, this generated file IS
// tracked in git — a deliberate departure from the gitignored-build-artifact
// convention used by `routes-src/` / `virtual-modules.d.ts`. Its whole value
// is a frozen, reviewable snapshot that a plain `git diff` can catch drifting
// from its four source files. It stays internal like the source files it
// reads — NOT added to the package `exports` map or `files[]`.
//
// EJECTED HEADER MODE (zudolab/zudo-doc#3541): copy-eject-sources.mjs ships
// this same generator beside the ejected header files. In that location it
// reads project-owned nav-active.ts / nav-class-tokens.ts locally, while the
// current-path and page-event inputs come from the installed package's dist/
// modules. It resolves esbuild from that package's dependency graph, so a
// consumer runs the understandable, self-contained command printed by eject:
// `node ./src/components/zudo-doc/header/gen-nav-overflow-script.mjs`.
//
// `buildNavOverflowScript()` is exported so both this script's CLI entry
// point AND the vitest drift-guard test
// (`src/header/__tests__/nav-overflow-script.test.ts`) can call it: the test
// re-runs the REAL extraction (fresh transpile of the current source files)
// and asserts it byte-matches the frozen `NAV_OVERFLOW_SCRIPT` shipped in
// `nav-overflow-generated-script.ts` — catching the case where one of the
// four source files changed but the generated file was never regenerated.
//
// Runs BEFORE tsup (build / prepare / predev — see package.json) so the
// first compile always has `nav-overflow-generated-script.ts` on disk to
// import from `nav-overflow-script.ts`, AND is hooked into the tsup `--watch`
// `onSuccess` chain (tsup.config.ts) BEFORE `copy-eject-sources.mjs` (running
// it after would copy the previous literal into `eject/` on the first watch
// cycle); write-if-changed keeps that loop-free (an unchanged regeneration
// does not re-trigger tsup's watcher).
//
// The `pnpm check:nav-overflow-drift` guard (b4push step + pr-checks CI step,
// mirroring `check:search-widget-drift`) landed as sub-issue
// zudolab/zudo-doc#3535 — see scripts/check-nav-overflow-script-drift.sh.

import { readFileSync, writeFileSync, existsSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Find the installed package from an ejected header without assuming npm's
 * node_modules layout. The symlinked package root is enough: createRequire()
 * below resolves esbuild from the package's own dependency graph under npm,
 * pnpm, and yarn installs. */
function findInstalledPackageRoot(startDirs) {
  for (const startDir of startDirs) {
    let dir = resolve(startDir);
    while (true) {
      const candidate = resolve(dir, "node_modules/@takazudo/zudo-doc");
      if (existsSync(resolve(candidate, "package.json"))) return realpathSync(candidate);
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  throw new Error(
    "[gen-nav-overflow-script] could not find node_modules/@takazudo/zudo-doc. " +
      "Run this command from an installed zudo-doc project after `pnpm install`.",
  );
}

/** Resolve the generator's four inputs and output in package-build or ejected mode. */
export function resolveGenerationContext() {
  const packageRootCandidate = resolve(__dirname, "..");
  const packageHeaderDir = resolve(packageRootCandidate, "src/header");
  const isPackageGenerator = existsSync(resolve(packageHeaderDir, "nav-active.ts"));

  if (isPackageGenerator) {
    return {
      kind: "package",
      packageRoot: packageRootCandidate,
      currentPathSource: resolve(packageRootCandidate, "src/current-path/index.ts"),
      navActiveSource: resolve(packageHeaderDir, "nav-active.ts"),
      navClassTokensSource: resolve(packageHeaderDir, "nav-class-tokens.ts"),
      pageEventsSource: resolve(packageRootCandidate, "src/transitions/page-events.ts"),
      outputPath: resolve(packageHeaderDir, "nav-overflow-generated-script.ts"),
    };
  }

  // In an ejected payload this script sits beside the two project-owned
  // customization inputs. The current-path prelude and page-event vocabulary
  // intentionally stay package-owned and come from the installed compiled
  // modules, so an ejected project does not fork framework lifecycle inputs.
  if (
    !existsSync(resolve(__dirname, "nav-active.ts")) ||
    !existsSync(resolve(__dirname, "nav-class-tokens.ts"))
  ) {
    throw new Error(
      "[gen-nav-overflow-script] expected nav-active.ts and nav-class-tokens.ts " +
        `beside the ejected generator at ${__dirname}`,
    );
  }
  const packageRoot = findInstalledPackageRoot([process.cwd(), __dirname]);
  return {
    kind: "ejected",
    packageRoot,
    currentPathSource: resolve(packageRoot, "dist/current-path/index.js"),
    navActiveSource: resolve(__dirname, "nav-active.ts"),
    navClassTokensSource: resolve(__dirname, "nav-class-tokens.ts"),
    pageEventsSource: resolve(packageRoot, "dist/transitions/page-events.js"),
    outputPath: resolve(__dirname, "nav-overflow-generated-script.ts"),
  };
}

function loadTransformSync(packageRoot) {
  try {
    const requireFromPackage = createRequire(resolve(packageRoot, "package.json"));
    return requireFromPackage("esbuild").transformSync;
  } catch (err) {
    throw new Error(
      "[gen-nav-overflow-script] could not load the esbuild dependency shipped by " +
        `@takazudo/zudo-doc: ${err.message}`,
    );
  }
}

// Explicit, stable esbuild options — identical rationale to
// gen-search-widget-script.mjs's TRANSFORM_OPTIONS (see that file): `format:
// "cjs"` so each source's `export`s become a CommonJS `module.exports` object
// we can read off the sandboxed `module` param, `target: "es2020"` so
// `var`-style function bodies pass through unchanged (no downlevel helpers),
// `platform: "neutral"` so esbuild injects no Node/browser global shims (all
// four source files are import-free — nothing to shim). Every minify knob is
// explicitly false: the acceptance criterion is a human-readable, byte-stable
// emit across runs, never a minified one.
const TRANSFORM_OPTIONS = {
  loader: "ts",
  format: "cjs",
  target: "es2020",
  platform: "neutral",
  sourcemap: false,
  minify: false,
  minifyWhitespace: false,
  minifyIdentifiers: false,
  minifySyntax: false,
};

/** A source string carrying no CommonJS/ESM module scaffolding that could
 *  survive the transpile into the embedded browser script. Matches only the
 *  syntactic shapes (`require(...)`, `import(...)`, `module.exports`,
 *  `exports.x`), NOT the bare words — the extracted function text includes
 *  body comments, and a comment merely mentioning "import"/"export" must not
 *  fail the build. */
function assertNoModuleScaffolding(label, text) {
  if (/\brequire\s*\(|\bimport\s*\(|\bmodule\.exports\b|\bexports\s*\./.test(text)) {
    throw new Error(
      `[gen-nav-overflow-script] ${label} leaked module scaffolding into the embedded script:\n${text}`,
    );
  }
}

/** Transpile a TS source file to CommonJS JS, type-stripped, via esbuild's `transformSync`. */
function transpile(sourcePath, transformSync) {
  const source = readFileSync(sourcePath, "utf8");
  let result;
  try {
    result = transformSync(source, {
      ...TRANSFORM_OPTIONS,
      loader: sourcePath.endsWith(".ts") ? "ts" : "js",
    });
  } catch (err) {
    const messages = (err.errors ?? []).map((e) => e.text).join("; ") || err.message;
    throw new Error(
      `[gen-nav-overflow-script] failed to transpile ${sourcePath}: ${messages}`,
    );
  }
  // Warnings are fatal on purpose: this file's output is embedded verbatim
  // into a shipped browser script, so anything esbuild flags must be resolved
  // in the source rather than silently carried through.
  if (result.warnings.length > 0) {
    const messages = result.warnings.map((w) => w.text).join("; ");
    throw new Error(
      `[gen-nav-overflow-script] esbuild reported warning(s) while transpiling ${sourcePath} (treated as fatal): ${messages}`,
    );
  }
  return result.code;
}

/** Execute transpiled CommonJS source in an isolated sandbox and return its exports. */
function executeCommonJs(code, label) {
  const moduleObj = { exports: {} };
  const fn = new Function("module", "exports", code);
  try {
    fn(moduleObj, moduleObj.exports);
  } catch (err) {
    throw new Error(
      `[gen-nav-overflow-script] failed to execute transpiled ${label}: ${err.message}`,
    );
  }
  return moduleObj.exports;
}

/** Extract the real CURRENT_PATH_SCRIPT_PRELUDE value from current-path/index.ts. */
function extractCurrentPathPrelude(context, transformSync) {
  const outputText = transpile(context.currentPathSource, transformSync);
  const exportsObj = executeCommonJs(outputText, "current-path/index.ts");
  const value = exportsObj.CURRENT_PATH_SCRIPT_PRELUDE;
  if (typeof value !== "string" || !value) {
    throw new Error(
      "[gen-nav-overflow-script] CURRENT_PATH_SCRIPT_PRELUDE missing or not a string in current-path/index.ts",
    );
  }
  assertNoModuleScaffolding("CURRENT_PATH_SCRIPT_PRELUDE", value);
  return value;
}

/** Extract the real, unit-tested pathMatchesNavPath/computeActiveNavPath source text from nav-active.ts. */
function extractNavActiveFunctions(context, transformSync) {
  const outputText = transpile(context.navActiveSource, transformSync);
  const exportsObj = executeCommonJs(outputText, "nav-active.ts");
  const { pathMatchesNavPath, computeActiveNavPath } = exportsObj;
  if (typeof pathMatchesNavPath !== "function" || typeof computeActiveNavPath !== "function") {
    throw new Error(
      "[gen-nav-overflow-script] nav-active.ts did not export pathMatchesNavPath/computeActiveNavPath functions",
    );
  }
  const pathMatchesNavPathSrc = pathMatchesNavPath.toString();
  const computeActiveNavPathSrc = computeActiveNavPath.toString();
  assertNoModuleScaffolding("pathMatchesNavPath", pathMatchesNavPathSrc);
  assertNoModuleScaffolding("computeActiveNavPath", computeActiveNavPathSrc);
  return { pathMatchesNavPathSrc, computeActiveNavPathSrc };
}

// The fourteen class-token arrays nav-overflow-script.ts used to import
// directly from nav-class-tokens.ts (see that module's header comment for
// the SSR ↔ runtime lockstep rationale, zudolab/zudo-doc#3023).
const NAV_CLASS_TOKEN_NAMES = [
  "NAV_TOP_ACTIVE",
  "NAV_TOP_INACTIVE",
  "NAV_MORE_ACTIVE",
  "NAV_MORE_INACTIVE",
  "NAV_CHEVRON_ACTIVE",
  "NAV_CHEVRON_INACTIVE",
  "NAV_CHILD_ACTIVE",
  "NAV_CHILD_INACTIVE",
  "NAV_MENU_PARENT",
  "NAV_MENU_PARENT_ACTIVE_SUFFIX",
  "NAV_MENU_PLAIN",
  "NAV_MENU_PLAIN_ACTIVE_SUFFIX",
  "NAV_MENU_CHILD_ACTIVE",
  "NAV_MENU_CHILD_INACTIVE",
];

/** Extract the fourteen real class-token arrays from nav-class-tokens.ts. */
function extractNavClassTokens(context, transformSync) {
  const outputText = transpile(context.navClassTokensSource, transformSync);
  const exportsObj = executeCommonJs(outputText, "nav-class-tokens.ts");
  const tokens = {};
  for (const name of NAV_CLASS_TOKEN_NAMES) {
    const value = exportsObj[name];
    if (!Array.isArray(value) || !value.every((token) => typeof token === "string")) {
      throw new Error(
        `[gen-nav-overflow-script] nav-class-tokens.ts did not export ${name} as a string array`,
      );
    }
    tokens[name] = value;
  }
  // Exhaustiveness: a token array exported by nav-class-tokens.ts (and thus
  // available to header.tsx's SSR markup) but missing from
  // NAV_CLASS_TOKEN_NAMES would be silently absent from the frozen script —
  // the exact SSR ↔ runtime class drift the tokens module exists to prevent,
  // and one no drift guard can see (the generated bytes legitimately don't
  // change). Fail loudly instead.
  const unconsumed = Object.keys(exportsObj).filter(
    (name) => name.startsWith("NAV_") && !NAV_CLASS_TOKEN_NAMES.includes(name),
  );
  if (unconsumed.length > 0) {
    throw new Error(
      `[gen-nav-overflow-script] nav-class-tokens.ts exports token array(s) not embedded in the script: ${unconsumed.join(", ")}. Add them to NAV_CLASS_TOKEN_NAMES and splice them into the template in buildNavOverflowScript().`,
    );
  }
  return tokens;
}

/** Extract the real AFTER_NAVIGATE_EVENT value from transitions/page-events.ts — never hardcoded. */
function extractAfterNavigateEvent(context, transformSync) {
  const outputText = transpile(context.pageEventsSource, transformSync);
  const exportsObj = executeCommonJs(outputText, "page-events.ts");
  const value = exportsObj.AFTER_NAVIGATE_EVENT;
  if (typeof value !== "string" || !value) {
    throw new Error(
      "[gen-nav-overflow-script] AFTER_NAVIGATE_EVENT missing or not a string in transitions/page-events.ts",
    );
  }
  return value;
}

// The class lists spliced into the script below are the SSR ↔ runtime
// lockstep: they must match the strings header.tsx renders (nav-class-tokens.ts
// header comment, zudolab/zudo-doc#3023). Moved here from nav-overflow-script.ts
// (zudolab/zudo-doc#3534) — they now run once at generation time rather than on
// every module evaluation.

// -> `"bg-fg", "text-bg"` — argument list for a classList.add/remove(...) call.
const clsArgs = (tokens) => tokens.map((token) => JSON.stringify(token)).join(", ");

// -> `"bg-fg text-bg"` — a single class-string literal for `className = ...`.
const clsLiteral = (tokens) => JSON.stringify(tokens.join(" "));

// -> `" font-bold text-accent"` — leading-space append for `className += ...`.
const clsAppend = (tokens) => JSON.stringify(" " + tokens.join(" "));

/**
 * Composes the full desktop-nav overflow controller IIFE script,
 * string-for-string identical in structure to the old template-literal build
 * in nav-overflow-script.ts, but with the four previously-live interpolations
 * replaced by frozen values extracted above.
 */
export function buildNavOverflowScript(context = resolveGenerationContext()) {
  const transformSync = loadTransformSync(context.packageRoot);
  const currentPathPrelude = extractCurrentPathPrelude(context, transformSync);
  const { pathMatchesNavPathSrc, computeActiveNavPathSrc } = extractNavActiveFunctions(
    context,
    transformSync,
  );
  const {
    NAV_TOP_ACTIVE,
    NAV_TOP_INACTIVE,
    NAV_MORE_ACTIVE,
    NAV_MORE_INACTIVE,
    NAV_CHEVRON_ACTIVE,
    NAV_CHEVRON_INACTIVE,
    NAV_CHILD_ACTIVE,
    NAV_CHILD_INACTIVE,
    NAV_MENU_PARENT,
    NAV_MENU_PARENT_ACTIVE_SUFFIX,
    NAV_MENU_PLAIN,
    NAV_MENU_PLAIN_ACTIVE_SUFFIX,
    NAV_MENU_CHILD_ACTIVE,
    NAV_MENU_CHILD_INACTIVE,
  } = extractNavClassTokens(context, transformSync);
  const afterNavigateEventLiteral = JSON.stringify(
    extractAfterNavigateEvent(context, transformSync),
  );

  // ---------------------------------------------------------------------
  // NOTE ON COMMENTS IN THE TEMPLATE BELOW: every byte inside the returned
  // literal ships inline in the <head> of EVERY page, so rationale lives out
  // here (generator source, not shipped) and the template keeps only short
  // pointers back to these paragraphs.
  //
  // navPathname / cross-origin (zudolab/zudo-doc#3950)
  // -------------------------------------------------
  // Keeping only `.pathname` collapses an external `headerNav` entry like
  // "https://other.example/" to "/", which then exact-matches this site's own
  // root route and steals the highlight from whatever SSR marked active. The
  // SSR matcher (nav-active.ts) compares the raw configured `path` string, so
  // "https://other.example/" never equals or prefixes "/". Returning "" for a
  // cross-origin href restores that agreement instead of re-deriving it.
  //
  // The "" sentinel, and why it cannot win
  // --------------------------------------
  // "" is produced by navPathname for a cross-origin or unparseable href.
  // pathMatchesNavPath LETS IT PASS for every absolute current path — with
  // navPath "" the prefix test degenerates to `currentPath.startsWith("/")`.
  // What makes it safe is computeActiveNavPath's length-descending sort: ""
  // is the strict minimum, so it is only ever picked when nothing else
  // matched, and all three paint sites then guard on `activePath !== ""` and
  // paint nothing. Those guards are load-bearing — do not drop them as
  // "redundant". A same-origin href can never yield "" (trimSlashes floors at
  // "/"), so "" is exclusively the sentinel.
  //
  // Reusing SSR's active-state decision (zudolab/zudo-doc#3953)
  // -----------------------------------------------------------
  // SSR resolves the active item as `isNavItemActiveByCategory(item,
  // activeCategory) || isNavItemActive(item, activeNavPath)` — category
  // first, path as a per-item fallback, ORed, not either/or. This script used
  // to know only the path half, so it repainted from the URL alone and
  // DISCARDED SSR's category decision on every first paint: any page whose
  // big category picks an item that URL-prefix matching does not lost its
  // highlight on load (measured: a root route rendering a docs/<section>
  // entry went from `aria-current="page"` to nothing).
  //
  // Rather than re-deriving the category client-side — a third matcher to
  // keep in sync, which is the drift the embedded-verbatim core above exists
  // to prevent — SSR republishes what it already resolved:
  //   * `data-zd-nav-section` on `.zd-doc-content-band` (doc-layout.tsx) —
  //     the page's `navSection`. That element is INSIDE the client router's
  //     swapped region, so the value is fresh after every swap. The header is
  //     persisted across swaps, so nothing written into it could be.
  //   * `data-nav-category` on each nav anchor (header.tsx) — the item's
  //     configured `categoryMatch`. Config-derived and identical on every
  //     page, so it is safe on the persisted header.
  // `isAnchorActive` below then mirrors SSR's precedence exactly. When the
  // page has no section (home, 404, tag, version), the attribute is absent
  // and the predicate collapses to the previous path-only behaviour.
  //
  // PARSE ORDER — why the first paint is deferred
  // ---------------------------------------------
  // This script is emitted INSIDE <header> (header.tsx), which the HTML
  // parser reaches BEFORE `.zd-doc-content-band` further down the body. At
  // the top-level `initNavOverflow()` call the band therefore does not exist
  // yet, `document.querySelector("[data-zd-nav-section]")` returns null, and
  // a repaint at that moment would fall back to path-only matching and CLEAR
  // exactly the SSR category highlight this section exists to preserve.
  // AFTER_NAVIGATE_EVENT does not fire on initial load, so nothing would put
  // it back. SSR's paint is already correct for the page being parsed, so
  // `initNavOverflow` skips `applyActiveNav` while `document.readyState ===
  // "loading"` and re-inits once on DOMContentLoaded, when the band is in the
  // DOM. Do not "simplify" either half away.
  // ---------------------------------------------------------------------
  return /* javascript */ `(function () {
  var cleanupNavOverflow = null;

  function trimSlashes(p) {
    while (p.length > 1 && p.charAt(p.length - 1) === "/") p = p.slice(0, -1);
    return p || "/";
  }

  // "" for cross-origin: unmatchable sentinel, matching SSR (#3950).
  function navPathname(a) {
    try {
      var u = new URL(a.href, location.href);
      if (u.origin !== location.origin) return "";
      return trimSlashes(u.pathname);
    } catch (e) { return ""; }
  }

  // Explicit current-route override, embedded from current-path/index.ts so
  // this script cannot drift from the three other read sites
  // (zudolab/zudo-doc#3398, #3408).
  ${currentPathPrelude}

  // Shared matching core (zudolab/zudo-doc#3398): embedded verbatim from
  // nav-active.ts so this script's longest-match walk cannot drift from the
  // SSR header's own computeActiveNavPath call (header.tsx). computeActiveNavPath
  // closes over pathMatchesNavPath, so both are embedded together.
  var pathMatchesNavPath = ${pathMatchesNavPathSrc};
  var computeActiveNavPath = ${computeActiveNavPathSrc};

  // Recompute which header nav item is "active" from the CURRENT URL and
  // repaint the highlight. SSR sets the active item on first paint, but the
  // header is persisted across same-locale client-router swaps
  // (data-zfb-transition-persist), so without this the highlight would stay
  // frozen on the page where the header was first rendered. Mirrors the
  // sidebar island's client-side approach (match the current path against
  // each entry's href) and the SSR longest-match + dropdown-parent rules.
  // URL-based: hrefs and the current path both carry the base + locale
  // prefix, so they compare directly without stripping.
  function applyActiveNav() {
    var nav = document.querySelector("[data-header-nav]");
    if (!nav) return;
    var topItems = Array.from(nav.querySelectorAll(":scope > [data-nav-item]"));
    if (topItems.length === 0) return;

    var cur = trimSlashes(readCurrentPath(CURRENT_PATH_DATASET_KEY));

    // SSR's own resolved big category, republished per page (#3953).
    var sectionEl = document.querySelector("[data-zd-nav-section]");
    var navSection = (sectionEl && sectionEl.getAttribute("data-zd-nav-section")) || "";

    // Build NavItemLike-shaped entries from the live DOM so the shared
    // computeActiveNavPath can do the deepest-match walk — the same call
    // shape the SSR header uses (matches computeActiveNavPath). A dropdown
    // missing its own top-level anchor is skipped entirely, mirroring the
    // parentLink guard used below for the same malformed-markup case.
    // A "" path (cross-origin) is unmatchable ONLY because of the length sort
    // plus the \`activePath !== ""\` guards below — keep both.
    var navItems = [];
    topItems.forEach(function (it) {
      var isDropdown = it.hasAttribute("data-nav-item-dropdown");
      var topA = isDropdown ? it.querySelector(":scope > a") : it;
      if (!topA) return;
      var children = [];
      if (isDropdown) {
        it.querySelectorAll(":scope > div a").forEach(function (c) {
          children.push({ path: navPathname(c) });
        });
      }
      navItems.push({ path: navPathname(topA), children: children });
    });

    var activePath = computeActiveNavPath(navItems, cur) || "";

    // Mirrors SSR: category match OR path match, per item (see nav-active.ts).
    function isAnchorActive(a) {
      if (!a) return false;
      if (navSection !== "" && a.getAttribute("data-nav-category") === navSection) return true;
      return activePath !== "" && navPathname(a) === activePath;
    }

    function setTopActive(a, active) {
      if (!a) return;
      if (active) {
        a.classList.add(${clsArgs(NAV_TOP_ACTIVE)});
        a.classList.remove(${clsArgs(NAV_TOP_INACTIVE)});
        a.setAttribute("aria-current", "page");
      } else {
        a.classList.remove(${clsArgs(NAV_TOP_ACTIVE)});
        a.classList.add(${clsArgs(NAV_TOP_INACTIVE)});
        a.removeAttribute("aria-current");
      }
    }

    topItems.forEach(function (it) {
      var isDropdown = it.hasAttribute("data-nav-item-dropdown");
      var topA = isDropdown ? it.querySelector(":scope > a") : it;
      var topActive = false;

      if (isDropdown) {
        var parentMatch = isAnchorActive(topA);
        var anyChild = false;
        it.querySelectorAll(":scope > div a").forEach(function (c) {
          var childActive = isAnchorActive(c);
          if (childActive) {
            anyChild = true;
            c.setAttribute("data-active", "");
            c.classList.add(${clsArgs(NAV_CHILD_ACTIVE)});
            c.classList.remove(${clsArgs(NAV_CHILD_INACTIVE)});
          } else {
            c.removeAttribute("data-active");
            c.classList.remove(${clsArgs(NAV_CHILD_ACTIVE)});
            c.classList.add(${clsArgs(NAV_CHILD_INACTIVE)});
          }
        });
        topActive = parentMatch || anyChild;
        var svg = topA ? topA.querySelector("svg") : null;
        if (svg) {
          if (topActive) { svg.classList.add(${clsArgs(NAV_CHEVRON_ACTIVE)}); svg.classList.remove(${clsArgs(NAV_CHEVRON_INACTIVE)}); }
          else { svg.classList.add(${clsArgs(NAV_CHEVRON_INACTIVE)}); svg.classList.remove(${clsArgs(NAV_CHEVRON_ACTIVE)}); }
        }
      } else {
        topActive = isAnchorActive(topA);
      }

      setTopActive(topA, topActive);
    });
  }

  function initNavOverflow() {
    if (cleanupNavOverflow) cleanupNavOverflow();

    // Repaint the active highlight for the current URL before measuring /
    // cloning, so the overflow "···" menu mirrors the correct active state.
    // Skipped mid-parse: the content band is not in the DOM yet (#3953).
    if (document.readyState !== "loading") applyActiveNav();

    var nav = document.querySelector("[data-header-nav]");
    var moreContainer = document.querySelector("[data-nav-more]");
    var moreMenu = document.querySelector("[data-nav-more-menu]");
    var moreToggle = document.querySelector("[data-nav-more-toggle]");
    if (!nav || !moreContainer || !moreMenu || !moreToggle) return;

    function setMoreActive(active) {
      if (active) {
        moreToggle.classList.add(${clsArgs(NAV_MORE_ACTIVE)});
        moreToggle.classList.remove(${clsArgs(NAV_MORE_INACTIVE)});
      } else {
        moreToggle.classList.add(${clsArgs(NAV_MORE_INACTIVE)});
        moreToggle.classList.remove(${clsArgs(NAV_MORE_ACTIVE)});
      }
    }

    // The persisted header can be re-initialized with a different nav shape.
    // Clear a prior page's transferred active state even when there are no
    // items and update() will not be installed (#3758).
    setMoreActive(false);

    var items = Array.from(nav.querySelectorAll(":scope > [data-nav-item]"));
    if (items.length === 0) {
      moreContainer.style.display = "none";
      return;
    }

    var controller = new AbortController();

    function update() {
      items.forEach(function (el) { el.style.display = ""; });
      moreContainer.style.display = "";
      moreMenu.innerHTML = "";
      moreMenu.classList.add("hidden");
      moreToggle.setAttribute("aria-expanded", "false");
      setMoreActive(false);

      var itemWidths = items.map(function (el) { return el.offsetWidth; });
      var moreWidth = moreContainer.offsetWidth;
      var navGap = parseFloat(getComputedStyle(nav).columnGap) || 0;
      var available = nav.clientWidth;

      if (available <= 0) {
        moreContainer.style.display = "none";
        return;
      }

      var total = 0;
      for (var i = 0; i < itemWidths.length; i++) {
        total += itemWidths[i] + (i > 0 ? navGap : 0);
      }

      if (total <= available) {
        moreContainer.style.display = "none";
        return;
      }

      var used = 0;
      var cutoffIndex = 0;

      for (var i2 = 0; i2 < items.length; i2++) {
        var w = itemWidths[i2] + (i2 > 0 ? navGap : 0);
        if (used + w > available - moreWidth - navGap) break;
        used += w;
        cutoffIndex = i2 + 1;
      }

      var hiddenHasActiveItem = false;
      for (var i3 = cutoffIndex; i3 < items.length; i3++) {
        var hiddenItem = items[i3];
        hiddenItem.style.display = "none";
        var hiddenTopLink = hiddenItem.hasAttribute("data-nav-item-dropdown")
          ? hiddenItem.querySelector(":scope > a")
          : hiddenItem;
        var hiddenActiveChild = hiddenItem.querySelector(":scope > div a[data-active]");
        if ((hiddenTopLink && hiddenTopLink.getAttribute("aria-current") === "page") || hiddenActiveChild) {
          hiddenHasActiveItem = true;
        }
      }
      setMoreActive(hiddenHasActiveItem);

      var currentCloneAssigned = false;
      for (var i4 = cutoffIndex; i4 < items.length; i4++) {
        var el = items[i4];
        var isDropdown = el.hasAttribute("data-nav-item-dropdown");

        if (isDropdown) {
          var parentLink = el.querySelector(":scope > a");
          var childLinks = el.querySelectorAll(":scope > div a");
          var hasActiveChild = Array.from(childLinks).some(function (child) {
            return child.hasAttribute("data-active");
          });
          if (parentLink) {
            var li = document.createElement("li");
            var a = document.createElement("a");
            a.href = parentLink.href;
            var parentText = parentLink.textContent ? parentLink.textContent.trim().replace(/\\s+/g, " ") : "";
            a.textContent = parentText;
            a.className = ${clsLiteral(NAV_MENU_PARENT)};
            if (parentLink.getAttribute("aria-current") === "page") {
              a.className += ${clsAppend(NAV_MENU_PARENT_ACTIVE_SUFFIX)};
              if (!hasActiveChild && !currentCloneAssigned) {
                a.setAttribute("aria-current", "page");
                currentCloneAssigned = true;
              }
            }
            li.appendChild(a);
            moreMenu.appendChild(li);
          }
          childLinks.forEach(function (child) {
            var li = document.createElement("li");
            var a = document.createElement("a");
            a.href = child.href;
            a.textContent = child.textContent ? child.textContent.trim() : "";
            var isChildActive = child.hasAttribute("data-active");
            a.className = isChildActive
              ? ${clsLiteral(NAV_MENU_CHILD_ACTIVE)}
              : ${clsLiteral(NAV_MENU_CHILD_INACTIVE)};
            if (isChildActive && !currentCloneAssigned) {
              a.setAttribute("aria-current", "page");
              currentCloneAssigned = true;
            }
            li.appendChild(a);
            moreMenu.appendChild(li);
          });
        } else {
          var anchor = el;
          var li2 = document.createElement("li");
          var a2 = document.createElement("a");
          a2.href = anchor.href;
          a2.textContent = anchor.textContent ? anchor.textContent.trim() : "";
          a2.className = ${clsLiteral(NAV_MENU_PLAIN)};
          if (anchor.getAttribute("aria-current") === "page") {
            a2.className += ${clsAppend(NAV_MENU_PLAIN_ACTIVE_SUFFIX)};
            if (!currentCloneAssigned) {
              a2.setAttribute("aria-current", "page");
              currentCloneAssigned = true;
            }
          }
          li2.appendChild(a2);
          moreMenu.appendChild(li2);
        }
      }
    }

    moreToggle.addEventListener("click", function () {
      var isOpen = !moreMenu.classList.contains("hidden");
      moreMenu.classList.toggle("hidden", isOpen);
      moreToggle.setAttribute("aria-expanded", String(!isOpen));
    }, { signal: controller.signal });

    document.addEventListener("click", function (e) {
      if (!moreContainer.contains(e.target)) {
        moreMenu.classList.add("hidden");
        moreToggle.setAttribute("aria-expanded", "false");
      }
    }, { signal: controller.signal });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (!moreMenu.classList.contains("hidden")) {
        moreMenu.classList.add("hidden");
        moreToggle.setAttribute("aria-expanded", "false");
        moreToggle.focus();
        return;
      }
      var active = document.activeElement;
      var dropdown = active && active.closest ? active.closest("[data-nav-item-dropdown]") : null;
      if (dropdown && active && active.blur) {
        active.blur();
      }
    }, { signal: controller.signal });

    var dropdowns = nav.querySelectorAll("[data-nav-item-dropdown]");
    dropdowns.forEach(function (dd) {
      var trigger = dd.querySelector(":scope > a");
      if (!trigger) return;
      function setExpanded(v) {
        trigger.setAttribute("aria-expanded", String(v));
      }
      dd.addEventListener("mouseenter", function () { setExpanded(true); }, { signal: controller.signal });
      dd.addEventListener("mouseleave", function () { setExpanded(false); }, { signal: controller.signal });
      dd.addEventListener("focusin", function () { setExpanded(true); }, { signal: controller.signal });
      dd.addEventListener("focusout", function (e) {
        if (!dd.contains(e.relatedTarget)) {
          setExpanded(false);
        }
      }, { signal: controller.signal });
    });

    var ro = new ResizeObserver(update);
    ro.observe(nav);
    controller.signal.addEventListener("abort", function () { ro.disconnect(); });

    document.fonts.ready.then(update);

    update();

    cleanupNavOverflow = function () { controller.abort(); };
  }

  initNavOverflow();
  // First-paint re-init once the body is parsed, so applyActiveNav can read
  // the content band's data-zd-nav-section (#3953).
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNavOverflow, { once: true });
  }
  document.addEventListener(${afterNavigateEventLiteral}, initNavOverflow);
})();`;
}

// ── CLI entry: write-if-changed ─────────────────────────────────────────────
// Realpath both sides: Node resolves the ESM entry's `import.meta.url` to its
// REAL path (default --preserve-symlinks=false) while `process.argv[1]` keeps
// whatever spelling the invoker typed, so under a symlinked checkout a plain
// `resolve()` comparison silently mismatches and the CLI becomes an exit-0
// no-op — leaving nav-overflow-generated-script.ts missing (hard tsup failure
// later) or, worse, stale.
const isMainModule = (() => {
  if (!process.argv[1]) return false;
  try {
    // Realpath BOTH sides: under `--preserve-symlinks-main` (sometimes set
    // via NODE_OPTIONS in pnpm/monorepo setups) `import.meta.url` keeps the
    // symlinked spelling, so a one-sided realpath re-creates the silent
    // exit-0 no-op this block exists to prevent.
    return (
      realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
})();

function buildGeneratedModule(script, context) {
  const banner = context.kind === "package"
    ? `// GENERATED FILE — do not edit by hand.
// Produced by scripts/gen-nav-overflow-script.mjs (zudolab/zudo-doc#3534,
// epic #3533) from src/current-path/index.ts (CURRENT_PATH_SCRIPT_PRELUDE),
// src/header/nav-active.ts (pathMatchesNavPath/computeActiveNavPath,
// type-stripped), src/header/nav-class-tokens.ts (the twelve class-token
// arrays), and src/transitions/page-events.ts (AFTER_NAVIGATE_EVENT).
// Re-run \`pnpm --filter @takazudo/zudo-doc gen:nav-overflow-script\` (or any
// build/dev entry point, which already runs it) to regenerate after editing
// any of those source files.
//
// This file is committed to git (mirrors search-widget-script/generated-script.ts,
// zudolab/zudo-doc#3421 / #3431) — a deliberate departure from this repo's
// usual gitignored-generated-file convention (routes-src/, virtual-modules.d.ts).
// Regenerate AND commit the result after editing any of the four source files.
`
    : `// GENERATED FILE — do not edit by hand.
// Produced by the ejected header's gen-nav-overflow-script.mjs from the local
// nav-active.ts and nav-class-tokens.ts customization inputs plus the installed
// @takazudo/zudo-doc current-path and page-event inputs.
// Re-run \`node ./src/components/zudo-doc/header/gen-nav-overflow-script.mjs\`
// after editing either local input, then commit this file with your customization.
// The script value remains frozen so its CSP bytes do not depend on the
// consumer bundler.
`;

  return `${banner}
/** Returns the frozen desktop-nav overflow controller IIFE script. NOTE: the
 * vitest drift guard imports buildNavOverflowScript from
 * scripts/gen-nav-overflow-script.mjs (a fresh re-generation) — NEVER from
 * this module: comparing NAV_OVERFLOW_SCRIPT below against this same file's
 * function would be a vacuous self-comparison. */
export function buildNavOverflowScript(): string {
  return ${JSON.stringify(script)};
}

/** Client-side script string for the desktop header nav overflow controller.
 * See the module header of this generator for the embedding contract; see
 * current-path/index.ts / header/nav-active.ts / header/nav-class-tokens.ts /
 * transitions/page-events.ts for the frozen sources. */
export const NAV_OVERFLOW_SCRIPT: string = buildNavOverflowScript();
`;
}

/** Regenerate the committed package literal or the local ejected literal. */
export function generateNavOverflowScript(context = resolveGenerationContext()) {
  const script = buildNavOverflowScript(context);
  const output = buildGeneratedModule(script, context);

  const existing = existsSync(context.outputPath)
    ? readFileSync(context.outputPath, "utf8")
    : null;

  if (existing === output) {
    process.stdout.write(
      `[gen-nav-overflow-script] ${context.outputPath} unchanged, skip write\n`,
    );
  } else {
    writeFileSync(context.outputPath, output, "utf8");
    process.stdout.write(
      `[gen-nav-overflow-script] ${context.outputPath} written\n`,
    );
  }

  return { output, outputPath: context.outputPath, changed: existing !== output };
}

if (isMainModule) {
  generateNavOverflowScript();
}
