// search-widget-script — client-side IIFE for the `<site-search>` custom element
// (epic #2344, S5).
//
// The host's `pages/lib/_search-widget-script.ts` previously imported
// `AFTER_NAVIGATE_EVENT` from `@takazudo/zudo-doc/transitions` at module scope
// — that import is already inside this package. Moving the script here
// removes the last host-facing reason to keep `_search-widget-script.ts`
// as a non-trivial module (the host stub becomes a thin re-export).
//
// Pure — no node builtins, no `@/` host alias imports.
//
// SEARCH_WIDGET_SCRIPT itself is a frozen string literal generated at
// package build time by scripts/gen-search-widget-script.mjs (zudolab/
// zudo-doc#3412) from the real, unit-tested ./scoring.ts source and the
// real ../transitions/page-events.ts AFTER_NAVIGATE_EVENT value — never a
// live `Function.prototype.toString()` reflection executed at module
// evaluation of THIS file (that used to be the mechanism here, and broke
// under a downstream bundler that renames minified node_modules exports:
// the frozen template's literal text still called the un-renamed names).
// See generated-script.ts's header banner and the generator's module
// header comment for the full mechanism.
//
// Features (unchanged from before this refactor):
//   - Dialog open/close (button, backdrop click, Escape key)
//   - ⌘K / Ctrl+K global keyboard shortcut
//   - Lazy-fetch of `search-index.json`
//   - Built-in word-match scoring (pre-lowercased `_titleLc/_descLc/_bodyLc`)
//   - Result highlighting with `<mark>` and text truncation
//   - Infinite scroll via `IntersectionObserver` (PAGE_SIZE=10)
//   - Close-on-result-click (epic #2148)
//   - SPA after-navigate rebind (`zfb:after-swap`)
//   - Double-registration guard (`customElements.get(...)`)
export { SEARCH_WIDGET_SCRIPT } from "./generated-script.js";
