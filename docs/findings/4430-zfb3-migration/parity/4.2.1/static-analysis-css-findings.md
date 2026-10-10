# #4469 actual CSS findings, 4.2.1 versus exact v2 baseline

Read-only diagnosis. No product edits or baseline approvals. Initial observed report: `/tmp/zudo421-parity/locked-css/report-initial.json` (44 captures per variant, 38 property differences, four absent-TOC-route errors). Baseline source is `337b9f110793dccb4759bddd5273eab38cd9d2f0`; actual dist provenance is managed by the migration manager. Revised measurements must record the current source/build separately.

## Confirmed repair candidates

1. **Asset details definition-term weight: 600 → 500**, both color schemes, `/files/demo/spec.pdf/`.
   - Actual baseline stylesheet has `.font-medium { font-weight: var(--font-weight-medium) }` before `.zd-content :where(dt) { font-weight: var(--font-weight-semibold) }`. Equal specificity; authored rule wins with 600.
   - Current stylesheet places emitted `.font-medium { font-weight: var(--zw-font-weight-medium) }` after the unchanged authored dt rule; utility wins with 500. This is the locked utility-after-authored cascade difference, not a serializer or token rename.
   - Owner: `packages/zudo-doc/src/asset-page/components.tsx:158`. Narrow repair candidate: make these details terms explicitly semibold, preserving the measured baseline result. Avoid globally strengthening every prose selector or altering Wind defaults. Existing dt/dd zero-margin/padding reset still matches; do not remove it.
   - Measured label/value widths also change (~59.98/214.02 → 56.88/217.13px). Remeasure after font readiness and the justified weight repair before attributing all geometry changes solely to weight.

2. **Desktop sidebar transition timing: ease → cubic-bezier(0.4,0,0.2,1)**, both schemes, `/docs/getting-started/`.
   - Baseline `.transition-[left,color]` uses `var(--tw-ease, ease)`; all baseline CSS has no emitted `.ease-in-out` declaration. Current emits `.ease-in-out` using configured `--zw-ease-in-out`, backed by `--ease-in-out` in `theme.css:116`.
   - Duration remains 200ms. Presence of a supported class does not authorize activating a previously inert baseline effect.
   - Owner: `packages/zudo-doc/src/desktop-sidebar-toggle-island/island.tsx:36`. Narrow repair candidate: remove this conflicting formerly inert utility, retaining the transition utility's `ease` default. Keep the public easing token contract. A scoped authored override is an alternative if class retention is required.
   - Related owners with the same class: `desktop-toc-toggle-island/island.tsx:36` and `asset-page/components.tsx:197`. Measure them before extending the repair; the first probe did not establish their timing. The revised TOC route is `/docs/blog/sixteen-rem-drawer/`, where both actual builds contain the toggle.

## Unresolved measurements, not repair authorization

- SiteTreeNav first probe compares baseline SVG with current rotation span. Different inherited color/display/vertical-align and transform representation are real raw differences but do not establish a painted SVG regression. Revised probe separately captures the actual SVG color/stroke/bounds and `getScreenCTM()` orientation, plus expanded state before/after; preserve raw wrapper evidence.
- Home hr width differed and varied by scheme. Authored `.zd-home-rule` CSS is identical. Revised probe waits for fonts and viewport-transition settling. No causal conclusion or product repair yet.
- First probe confirms no sampled peer/group/default-state differences, inert 18px icons at 1280/1536/1600, token spacing edit/revert, and sampled control properties. These are bounded findings, not acceptance of every reset or every one of 51 tokens.

## Probe artifacts and remaining inventory

- Real routes: `/tmp/zudo421-parity/locked-css-probe.mjs`, output `locked-css/report.json`. Missing states and raw computed differences stay failures. AI's actual message control is `input[type=text]`, not textarea; revised probe adds its placeholder/focus and native dialog backdrop without submitting a request.
- Separate identical-markup public stylesheet fixture: `/tmp/zudo421-parity/reset-control-probe.mjs`, output `reset-controls/report.json` plus exact generated HTML and stylesheet SHA256 provenance. Fixture endpoint links each build's original unmodified stylesheets and serves original assets. It contains absent tags (abbr/small/sub/sup, textarea, file input), standard controls, native dialog/backdrop, and keyboard focus under both schemes. It is **not actual-route parity, native-renderer proof, or application hydration proof**. No dependency patch, CSS override, network stub, or asset mirror is used.
- Both scripts were syntax-checked only after revision; manager must run through the shared heavy guard. Raw property differences are retained even when they need later semantic interpretation. Font glyph rendering and touch-platform tap behavior cannot be proven solely by matching computed properties in desktop Chromium.

## Completed guarded follow-up (manager execution, unchanged product 2926b1da)

Actual-route follow-up: 64 captures per build, 50 raw property differences, four AI keyboard-next gaps (`:focus` absent in both schemes/builds). Home hr width now matches after font readiness/viewport settling; no hr repair justified. Effective chevrons match: 12×12px, same muted color/stroke, 90° expanded and 0° collapsed. The actual moving SVG (v2) / span (current) both retain 0.15s/ease; raw element-level differences remain recorded, but sampled endpoint geometry/color/orientation and transition declaration behavior agree. This does not measure every intermediate animation frame. Sidebar AND TOC timing differences are confirmed; asset-toggle timing remains pending (the probe now contains an additional capture added after this report). AI input and painted backdrop color match; backdrop box sizing and border-style differences share the reset omission below. The failed keyboard-next attempt is unverified, not a matching-focus success.

Public stylesheet fixture: 46 states per build, zero gaps, 18 raw property differences (nine per scheme). All differences are:

- File selector button retains native 2px outset border and 1px 6px padding instead of baseline 0px solid border/zero padding. Button width increases 16px and height 6px; enclosing file input height also increases 6px.
- Generic dialog backdrop changes border-box → content-box, solid → none, and rgba(0,0,0,0.1) → rgba(0,0,0,0.5).

**Owned reset repair, not demonstrated upstream defect:** v4.2.1 [owned-v1 source](https://github.com/Takazudo/zudo-front-builder/blob/v4.2.1/crates/zudo-wind/assets/reset/owned-v1.css) explicitly resets `*`, `*::before`, `*::after`, without file-button/backdrop pseudo-elements. The [published cascade/reset contract](https://github.com/Takazudo/zudo-front-builder/blob/v4.2.1/docs/src/content/docs/zudo-wind/cascade-and-reset.mdx) documents its compact reset and retained native appearance. This matches the emitted stylesheet. zudo-doc already owns the additional baseline patch at `packages/zudo-doc/src/theme.css:220–240`.

Concrete #4469 repair owner: **theme.css authored base patch**. Complete the missing pseudo-element box model reset for `::backdrop`/`::file-selector-button` (baseline border-box, zero margin/padding, zero solid border); preserve baseline file-button inline-end margin/control inheritance after resetting margins. Remove or correct the authored `::backdrop { background-color: rgb(0 0 0 / 0.5) }` at line232: the baseline generic backdrop uses the browser's 0.1 default, while this new rule explicitly paints 0.5. Do not overwrite component-specific backdrop utilities/colors. Recheck both generic fixture and actual AI/image/Mermaid/dialog states after repair. Native reset omission alone is not grounds for a zfb bug; file an upstream issue only if a minimal authored pseudo-element patch fails to compile or violates the documented selector/layer contract. No upstream implementation or issue write performed here.

This follow-up supersedes the earlier pending-measurement statements above without deleting their historical evidence. Initial and revised reports are both preserved. All full-report raw differences remain strict; these causal classifications are review inputs, not accepted regressions or snapshot updates.
