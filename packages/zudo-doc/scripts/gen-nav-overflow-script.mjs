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
// HOW: reads `src/current-path/index.ts`, `src/header/nav-active.ts`,
// `src/header/nav-class-tokens.ts`, and `src/transitions/page-events.ts`
// SOURCE, strips TypeScript types deterministically via esbuild's
// `transformSync()` (same rationale as gen-search-widget-script.mjs — see
// that file's header comment for the full `ts.transpileModule()` vs esbuild
// history, zudolab/zudo-doc#3422 / #3430 — identical here: esbuild is only a
// transitive dep via tsup, declared as an explicit `esbuild` devDependency,
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
// Registering a `pnpm check:nav-overflow-drift` guard (b4push + CI, mirroring
// `check:search-widget-drift`) is a separate sub-issue (zudolab/zudo-doc#3535)
// — not wired here.

import { readFileSync, writeFileSync, existsSync, realpathSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const CURRENT_PATH_SRC_PATH = resolve(PKG_ROOT, "src/current-path/index.ts");
const NAV_ACTIVE_SRC_PATH = resolve(PKG_ROOT, "src/header/nav-active.ts");
const NAV_CLASS_TOKENS_SRC_PATH = resolve(PKG_ROOT, "src/header/nav-class-tokens.ts");
const PAGE_EVENTS_SRC_PATH = resolve(PKG_ROOT, "src/transitions/page-events.ts");
const OUTPUT_PATH = resolve(PKG_ROOT, "src/header/nav-overflow-generated-script.ts");

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
function transpile(sourcePath) {
  const source = readFileSync(sourcePath, "utf8");
  let result;
  try {
    result = transformSync(source, TRANSFORM_OPTIONS);
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
function extractCurrentPathPrelude() {
  const outputText = transpile(CURRENT_PATH_SRC_PATH);
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
function extractNavActiveFunctions() {
  const outputText = transpile(NAV_ACTIVE_SRC_PATH);
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

// The twelve class-token arrays nav-overflow-script.ts used to import
// directly from nav-class-tokens.ts (see that module's header comment for
// the SSR ↔ runtime lockstep rationale, zudolab/zudo-doc#3023).
const NAV_CLASS_TOKEN_NAMES = [
  "NAV_TOP_ACTIVE",
  "NAV_TOP_INACTIVE",
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

/** Extract the twelve real class-token arrays from nav-class-tokens.ts. */
function extractNavClassTokens() {
  const outputText = transpile(NAV_CLASS_TOKENS_SRC_PATH);
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
  return tokens;
}

/** Extract the real AFTER_NAVIGATE_EVENT value from transitions/page-events.ts — never hardcoded. */
function extractAfterNavigateEvent() {
  const outputText = transpile(PAGE_EVENTS_SRC_PATH);
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
export function buildNavOverflowScript() {
  const currentPathPrelude = extractCurrentPathPrelude();
  const { pathMatchesNavPathSrc, computeActiveNavPathSrc } = extractNavActiveFunctions();
  const {
    NAV_TOP_ACTIVE,
    NAV_TOP_INACTIVE,
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
  } = extractNavClassTokens();
  const afterNavigateEventLiteral = JSON.stringify(extractAfterNavigateEvent());

  return /* javascript */ `(function () {
  var cleanupNavOverflow = null;

  function trimSlashes(p) {
    while (p.length > 1 && p.charAt(p.length - 1) === "/") p = p.slice(0, -1);
    return p || "/";
  }

  function navPathname(a) {
    try { return trimSlashes(new URL(a.href, location.href).pathname); }
    catch (e) { return ""; }
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

    // Build NavItemLike-shaped entries from the live DOM so the shared
    // computeActiveNavPath can do the deepest-match walk — the same call
    // shape the SSR header uses (matches computeActiveNavPath). A dropdown
    // missing its own top-level anchor is skipped entirely (path "" would
    // otherwise match every current path — pathMatchesNavPath treats "" as
    // the root "/"), mirroring the parentLink guard used below for the same
    // malformed-markup case.
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
        var parentMatch = !!topA && navPathname(topA) === activePath && activePath !== "";
        var anyChild = false;
        it.querySelectorAll(":scope > div a").forEach(function (c) {
          var childActive = navPathname(c) === activePath && activePath !== "";
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
        topActive = activePath !== "" && navPathname(topA) === activePath;
      }

      setTopActive(topA, topActive);
    });
  }

  function initNavOverflow() {
    if (cleanupNavOverflow) cleanupNavOverflow();

    // Repaint the active highlight for the current URL before measuring /
    // cloning, so the overflow "···" menu mirrors the correct active state.
    applyActiveNav();

    var nav = document.querySelector("[data-header-nav]");
    var moreContainer = document.querySelector("[data-nav-more]");
    var moreMenu = document.querySelector("[data-nav-more-menu]");
    var moreToggle = document.querySelector("[data-nav-more-toggle]");
    if (!nav || !moreContainer || !moreMenu || !moreToggle) return;

    var items = Array.from(nav.querySelectorAll(":scope > [data-nav-item]"));
    if (items.length === 0) return;

    var controller = new AbortController();

    function update() {
      items.forEach(function (el) { el.style.display = ""; });
      moreContainer.style.display = "";
      moreMenu.innerHTML = "";
      moreMenu.classList.add("hidden");
      moreToggle.setAttribute("aria-expanded", "false");

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

      for (var i3 = cutoffIndex; i3 < items.length; i3++) {
        items[i3].style.display = "none";
      }

      for (var i4 = cutoffIndex; i4 < items.length; i4++) {
        var el = items[i4];
        var isDropdown = el.hasAttribute("data-nav-item-dropdown");

        if (isDropdown) {
          var parentLink = el.querySelector(":scope > a");
          var childLinks = el.querySelectorAll(":scope > div a");
          if (parentLink) {
            var li = document.createElement("li");
            var a = document.createElement("a");
            a.href = parentLink.href;
            var parentText = parentLink.textContent ? parentLink.textContent.trim().replace(/\\s+/g, " ") : "";
            a.textContent = parentText;
            a.className = ${clsLiteral(NAV_MENU_PARENT)};
            if (parentLink.getAttribute("aria-current") === "page") {
              a.className += ${clsAppend(NAV_MENU_PARENT_ACTIVE_SUFFIX)};
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
    return realpathSync(resolve(process.argv[1])) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (isMainModule) {
  const script = buildNavOverflowScript();

  const banner = `// GENERATED FILE — do not edit by hand.
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
`;

  const output = `${banner}
/** Composes the frozen desktop-nav overflow controller IIFE script. Exported
 * so the vitest drift guard can prove NAV_OVERFLOW_SCRIPT below still matches
 * this literal (a re-generation of it would be a no-op, not a rebuild). */
export function buildNavOverflowScript(): string {
  return ${JSON.stringify(script)};
}

/** Client-side script string for the desktop header nav overflow controller.
 * See the module header of this generator for the embedding contract; see
 * current-path/index.ts / header/nav-active.ts / header/nav-class-tokens.ts /
 * transitions/page-events.ts for the frozen sources. */
export const NAV_OVERFLOW_SCRIPT: string = buildNavOverflowScript();
`;

  const existing = existsSync(OUTPUT_PATH) ? readFileSync(OUTPUT_PATH, "utf8") : null;

  if (existing === output) {
    process.stdout.write(
      "[gen-nav-overflow-script] nav-overflow-generated-script.ts unchanged, skip write\n",
    );
  } else {
    writeFileSync(OUTPUT_PATH, output, "utf8");
    process.stdout.write(
      "[gen-nav-overflow-script] nav-overflow-generated-script.ts written\n",
    );
  }
}
