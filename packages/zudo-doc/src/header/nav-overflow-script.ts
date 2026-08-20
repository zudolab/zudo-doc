// Inline-script source for the desktop-nav overflow controller.
//
// In the original `header` template the script lived directly
// inside a `<script>` tag (which Astro pipes through the bundler). For
// the JSX port we emit the same logic verbatim via
// `dangerouslySetInnerHTML`, so the value below is plain ECMAScript —
// any TypeScript-only constructs (generic params, type casts, parameter
// type annotations) have been dropped so the browser can parse it
// directly.
//
// The behaviour matches the original modulo lifecycle vocabulary:
//   1. Locate the `[data-header-nav]` flex container, its `[data-nav-more]`
//      overflow trigger, and its dropdown menu.
//   2. Measure each top-level nav item, then greedily hide items that
//      would overflow and rebuild the "..." dropdown to mirror them
//      (including the bold-parent + indented-children pattern for
//      `[data-nav-item-dropdown]` entries).
//   3. Wire toggle / outside-click / Escape handlers to the overflow
//      menu and aria-expanded state to the in-place dropdowns.
//   4. Re-run on the v2 after-navigate event so the overflow stays
//      correct after an SPA body-swap navigation. The event name is
//      pulled from `AFTER_NAVIGATE_EVENT` in
//      `transitions/page-events.ts` (today: `zfb:after-swap`) rather
//      than a hard-coded `astro:*` literal — see that module for the
//      vocabulary rationale. The first-paint init relies on the
//      top-level `initNavOverflow()` call further down (after-swap
//      does NOT fire on the initial page load).
//
// Kept as a separate module (rather than inlined in `header.tsx`) so
// the JSX file stays focused on markup and so future edits to the
// script can be reviewed in isolation.
//
// FROZEN (zudolab/zudo-doc#3534, epic #3533): the script body used to be
// assembled here, at module-eval time, from three `Function.prototype.toString()`
// embeddings (`CURRENT_PATH_SCRIPT_PRELUDE`, `pathMatchesNavPath`,
// `computeActiveNavPath`) plus splice formatters over the twelve
// `nav-class-tokens.ts` arrays. That made the emitted bytes depend on the
// CONSUMING bundler (zudolab/zudo-doc#3502), so no CSP hash could be pinned
// against a stable value. The assembly logic now lives in
// `scripts/gen-nav-overflow-script.mjs`, which freezes it ONCE at package
// build time into the committed `./nav-overflow-generated-script.ts` literal
// re-exported below. Regenerate via
// `pnpm --filter @takazudo/zudo-doc gen:nav-overflow-script` after editing
// any of the four source files it reads from (see the generator's header
// comment for the list); the vitest guard at
// `src/header/__tests__/nav-overflow-script.test.ts` proves the committed
// literal still matches a fresh regeneration.
//
// EJECTED COPIES (`zudo-doc eject header`): the payload ships
// `./gen-nav-overflow-script.mjs`. After editing the local `./nav-active.ts`
// or `./nav-class-tokens.ts`, run:
//
//   node ./src/components/zudo-doc/header/gen-nav-overflow-script.mjs
//
// The generator reads those two local customization inputs and the installed
// package's current-path/page-event inputs, then rewrites the local
// `./nav-overflow-generated-script.ts`. Commit that generated file with the
// edits. Do not edit its string literal by hand: regeneration preserves the
// frozen, consumer-bundler-independent bytes required for stable CSP hashes.
export { NAV_OVERFLOW_SCRIPT } from "./nav-overflow-generated-script.js";
