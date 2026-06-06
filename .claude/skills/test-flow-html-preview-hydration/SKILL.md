---
name: test-flow-html-preview-hydration
description: "AI-judged verification that the HTML Preview component (`data-zfb-island=\"HtmlPreviewWrapperInner\"`) hydrates into the correct vertical-stack layout — title bar on top, preview iframe below, code toggle beneath — and NOT the broken side-by-side layout caused by Preact island hydration mis-nesting. Use when /verify-ui-ai dispatches a subagent for html-preview hydration verification. Procedure drives a built/served site (default http://localhost:8899/docs/components/html-preview/) via /headless-browser playwright-cli, scrolls to hydrate the `when=\"visible\"` islands, reads the post-hydration DOM tree + computed styles of every preview block, and visually checks a captured screenshot."
---

# Test flow: html-preview island hydration layout

## Background

`@takazudo/zudo-doc/html-preview-wrapper` renders the interactive HTML
Preview component used by the `<HtmlPreview>` MDX tag. It is a zfb island
hydrated with `when="visible"`.

Each preview block has this SSR structure:

```
<div data-zfb-island="HtmlPreviewWrapperInner" ...>     ← island marker
  <div class="border ... rounded-lg overflow-hidden">  ← OUTER CONTAINER
    <div class="flex items-center justify-between ...">  ← TITLE BAR (flex row)
      <span>{title}</span>
      <div class="flex">{Mobile/Tablet/Full buttons}</div>
    </div>
    <div class="bg-surface p-hsp-lg">…<iframe>…</div>     ← PREVIEW AREA (block)
    <div class="border-t ...">…Show code…</div>           ← CODE SECTION (block)
  </div>
</div>
```

The outer container's three children are block `<div>`s that MUST stack
vertically (title bar on top, preview below, code beneath).

**The bug under verification (Astro→zfb migration regression):** the bare
inner component carried the *outer* wrapper's name as its
`displayName` (`"HtmlPreviewWrapper"`) and was not exported, so the SSG
marker resolved to the exported self-wrapping `HtmlPreviewWrapper`. On the
client `hydrate(<HtmlPreviewWrapper/>, markerDiv)` re-emitted another
`data-zfb-island` wrapper and Preact reused the SSR'd children one level
off — re-parenting the preview + code sections INSIDE the flex title bar.
Result: the title bar + buttons squished on the LEFT, preview iframe
floating on the RIGHT (a broken side-by-side / flex-row layout). The fix
gives the bare inner component its OWN name+marker
(`HtmlPreviewWrapperInner`) and exports it, while `HtmlPreviewWrapper`
stays the `<Island>` wrapper that MDX registers — so the bundle hydrates
the bare component in-place.

The raw SSR DOM (JS disabled) was ALWAYS correct — the breakage appears
only AFTER hydration. So the test MUST run with JS enabled and MUST scroll
the page so the `when="visible"` islands actually hydrate before measuring.

## Scenario

Run against the URL in `Inputs.previewUrl` (default
`http://localhost:8899/docs/components/html-preview/`). Use viewport
`1280 x 900`. Use `/headless-browser` (Playwright CLI / a small Playwright
script) — `/verify-ui` single-page computed-style reads are not enough
because this needs scroll-to-hydrate plus per-block DOM-tree walks.

1. Launch chromium (JS enabled), viewport 1280x900, goto previewUrl,
   `waitUntil: networkidle`.
2. Scroll the full page top→bottom in ~400px steps (≈60ms each), then back
   to top, and wait ~1.2s. This triggers the IntersectionObserver that
   hydrates every `when="visible"` island.
3. For EVERY `[data-zfb-island="HtmlPreviewWrapperInner"]` element on the page
   (there are 6 on the default page), locate its outer container
   (`:scope > div`) and measure (see Measurements).
4. Capture a full-page screenshot AND a cropped screenshot of the FIRST
   preview block (`element.screenshot()` on the island).

## Measurements (per preview block, post-hydration)

For each island's outer container `C`:

- `childCount` = number of element children of `C`.
- `child0` = `C.children[0]` (expected: the title bar).
- `child0.display` = `getComputedStyle(child0).display`.
- `child0.height` = `child0.getBoundingClientRect().height`.
- `child1` = `C.children[1]` (expected: the preview area).
- `child1.display`, and `child1.rect.y` (top).
- `titleBarBottom` = `child0.rect.y + child0.rect.height`.

## Verdict criteria (mechanical first, visual second)

A block PASSES when ALL of:

1. `childCount === 3` (the three siblings are NOT collapsed/re-parented).
2. `child0.display === "flex"` AND `child0.height <= 80`
   (the title bar is just a bar — in the bug it absorbs the whole
   component and is 200px+ tall).
3. `child1.display === "block"` AND `child1.rect.y >= titleBarBottom - 2`
   (preview area sits BELOW the title bar — vertical stack, not beside it).

The overall run PASSES only when **every** preview block passes (6/6 on
the default page) AND the visual screenshot check confirms: each block
shows a horizontal title bar on top (title left, Mobile/Tablet/Full pills
right, "Full" highlighted) with the preview area full-width below it — and
NONE show the title bar/buttons squished to the left with the iframe on the
right.

FAIL if any block has `childCount !== 3`, a tall title bar, a side-by-side
arrangement, or the screenshot shows the broken left/right split.

## Output schema

Return a structured result with exactly these fields:

```
{
  blocksTotal: number,            // islands found (expect 6)
  blocksPassed: number,           // blocks meeting all 3 mechanical criteria
  perBlock: [                     // one entry per island
    { index, childCount, child0Display, child0Height, child1Display, child1Y, titleBarBottom, pass }
  ],
  mechanicalVerdict: "PASS" | "FAIL",
  visualVerdict: "PASS" | "FAIL",
  verdict: "PASS" | "FAIL",       // PASS only if BOTH mechanical and visual PASS
  summary: string,                // one-line human verdict
  fullPageScreenshot: string,     // path
  firstBlockScreenshot: string,   // path
  toolUsed: "headless-browser"
}
```

## Notes

- If `blocksTotal` is 0, the page didn't load or the marker changed —
  report FAIL with that detail, do not silently pass.
- Do not measure with JS disabled — the SSR DOM is always correct and would
  produce a false PASS that misses the hydration regression.
