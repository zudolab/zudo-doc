---
name: test-flow-sidebar-width-restore
description: "AI-judged verification that the docs-page sidebar's persisted drag-width is restored on page reload before first paint, with no visible flash to the CSS-default width. Use when /verify-ui-ai dispatches a subagent for sidebar-resizer width-restore verification. Procedure drives the local dev server at http://localhost:3000/docs/guides/i18n/ via /headless-browser playwright-cli, mutates `localStorage[\"zudo-doc-sidebar-width\"]`, reloads, measures `#desktop-sidebar` via `getBoundingClientRect()` plus computed `--zd-sidebar-w`, and visually checks the captured screenshot."
---

# Test flow: sidebar-resizer width restore on reload

## Background

`@takazudo/zudo-doc/sidebar-resizer` writes the user-chosen sidebar width
to `localStorage["zudo-doc-sidebar-width"]`. A sibling
`SidebarResizerRestore` component emits a pre-paint inline `<script>` in
`<head>` that reads the persisted value, validates and clamps it to
`[192, 448]`, and sets `--zd-sidebar-w` on `:root.style` before first
paint. The docs layout consumes `--zd-sidebar-w` via the sidebar's
`w-[var(--zd-sidebar-w)]` and the content wrapper's
`ml-[var(--zd-sidebar-w)]` classes.

The bug under verification: prior to the fix, reload after a drag
showed the CSS-default width (`clamp(14rem, 20vw, 22rem)`) instead of
the persisted value — the value existed in localStorage but nothing
applied it.

## Scenario

All steps run against the local dev server at the URL passed in
`Inputs.previewUrl` (default
`http://localhost:3000/docs/guides/i18n/`). The page must include the
desktop sidebar (it does on `/docs/...` routes at viewport widths
≥ Tailwind `lg` ≥ 1024px). Use viewport `1400 x 900` (or the size in
`Inputs.viewport`).

For each scenario below, capture a screenshot AND measure the live DOM
right after reload settles.

### Scenario A — baseline (no persisted value)

1. Open `previewUrl` at the configured viewport.
2. Clear: `localStorage.removeItem("zudo-doc-sidebar-width")`.
3. Reload the page; wait for `domcontentloaded` plus a 200 ms settle.
4. Capture screenshot to `baselineScreenshot`.
5. Measure:
   - `inline = document.documentElement.style.getPropertyValue("--zd-sidebar-w")`
   - `computed = getComputedStyle(document.documentElement).getPropertyValue("--zd-sidebar-w").trim()`
   - `rectWidth = document.getElementById("desktop-sidebar").getBoundingClientRect().width`

### Scenario B — restored to 400 px

1. Set: `localStorage.setItem("zudo-doc-sidebar-width", "400")`.
2. Reload; wait as above.
3. Capture screenshot to `restored400Screenshot`.
4. Measure the same three fields as Scenario A; record into the
   `restored400` block of the output.

### Scenario C — out-of-range clamp (`99999`)

1. Set: `localStorage.setItem("zudo-doc-sidebar-width", "99999")`.
2. Reload; wait as above.
3. Capture screenshot to `clamp448Screenshot`.
4. Measure the same three fields; record into `clamp448`.

### Scenario D — garbage value falls through (`NaN-garbage`)

1. Set: `localStorage.setItem("zudo-doc-sidebar-width", "NaN-garbage")`.
2. Reload; wait as above.
3. Capture screenshot to `garbageFallbackScreenshot`.
4. Measure the same three fields; record into `garbageFallback`.

After all scenarios, restore a clean state with
`localStorage.removeItem("zudo-doc-sidebar-width")` and close the
browser session.

## Verdict criteria

All four scenarios must pass. Each scenario is a mechanical-plus-visual
check; the mechanical numbers are the source of truth, the screenshot
is the human-verifiable confirmation.

### Scenario A (baseline)

- Mechanical: `inline === ""` AND `computed === "clamp(14rem, 20vw, 22rem)"`
  AND `rectWidth ∈ [224, 352]` (the clamp's resolved band at any
  reasonable viewport).
- Visual: the sidebar fills a clearly NARROW column relative to the
  Scenario B screenshot; the Guides nav items wrap into the column at
  the default width.

### Scenario B (restored 400 px) — THE PRIMARY ASSERTION

- Mechanical: `inline === "400px"` AND `computed === "400px"` AND
  `|rectWidth − 400| ≤ 1` (one-pixel sub-pixel tolerance).
- Visual: the sidebar is VISIBLY WIDER than in Scenario A. The
  restored width must look the same as what the user got immediately
  after dragging to 400 px, NOT the narrower default.

### Scenario C (clamp to MAX_W = 448)

- Mechanical: `inline === "448px"` AND `computed === "448px"` AND
  `|rectWidth − 448| ≤ 1`.
- Visual: the sidebar is the widest of all four scenarios.

### Scenario D (garbage falls through to default)

- Mechanical: same as Scenario A (inline empty, computed is the clamp
  string, rectWidth in `[224, 352]`).
- Visual: indistinguishable from Scenario A — the script silently no-ops
  on a non-numeric value, so the page renders exactly the default.

### Overall verdict

`PASS` if all four scenarios pass their own criteria. `FAIL` otherwise.
Include in `summary` a one-line human-readable result, e.g.
`"PASS: 400/448 px persisted widths visually restored on reload;
baseline + garbage values fall through to the CSS default"` or, for a
fail, `"FAIL: Scenario B rectWidth=224 (expected 400) — restore script
did not apply"`.

## Tools

- Primary: `/headless-browser` — Playwright CLI for `goto`, `eval`,
  `reload`, `screenshot`, `resize`, `close-all`. This task is
  multi-step interactive so `/verify-ui` (single-page computed-style
  reads) does not fit.
- The Playwright CLI does NOT accept a `--viewport-size` flag on
  `open` — use the `resize <w> <h>` subcommand AFTER `open`.

## Inputs (passed from the parent agent)

- `previewUrl` — full URL to drive (default
  `http://localhost:3000/docs/guides/i18n/`).
- `viewport` — `WxH` (default `1400x900`).
- `screenshotDir` — directory to write screenshots into (default
  `$HOME/cclogs/zudo-doc/headless-screenshots/`).

## Output schema

Return a single structured result with EXACTLY these fields:

```
{
  baseline: { inline, computed, rectWidth, screenshot },
  restored400: { inline, computed, rectWidth, screenshot },
  clamp448: { inline, computed, rectWidth, screenshot },
  garbageFallback: { inline, computed, rectWidth, screenshot },
  verdict: "PASS" | "FAIL",
  summary: "<one-line verdict>",
  toolUsed: "headless-browser"
}
```

`screenshot` is the absolute file path written by `npx
@playwright/cli@latest screenshot --filename <path>`. The four paths
should be distinct.

## Don'ts

- Don't change the verdict tolerance numbers — they are locked here.
- Don't skip scenarios — all four are required for a PASS verdict.
- Don't restart the dev server — assume it is already running at the
  URL provided in `Inputs.previewUrl`.
- Don't post anywhere — return the structured result to the parent;
  the parent decides how to surface it.
