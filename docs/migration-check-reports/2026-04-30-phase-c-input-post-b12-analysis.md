# Phase C — round 7 — post-B-12 residual classification

**Date**: 2026-04-30
**Phase C epic**: #666
**Super-epic**: #663
**Super-epic base** (post-B-12): `base/zfb-migration-parity` (HEAD `08d0f9b`)
**Epic base** (post-merge): `base/zfb-migration-parity-phase-c-mop-up` (HEAD `ea8672e`)
**Phase B-12 epic**: #907 (PR #908 merged 2026-04-30)
**Snapshot rebuild**: `pnpm migration-check` (full rebuild, NOT `--rerun`)
**Report**: `.l-zfb-migration-check/report.md` (timestamp 2026-04-30T11:07:20Z)

## Executive summary

Phase C round 7 fails the user's inline-acceptance gate. Residual is **55 content-loss + 145 asset-loss = 200 routes**, far above the `≤ 10` threshold. B-12 worked partially: it cleared the math-equations bridge fallback, the tag-INDEX `<DocHistoryArea>` gap, and the MDX-stub `<CategoryNav>`/`<CategoryTreeNav>`/`<SiteTreeNav>`/`<PresetGenerator>` losses. But three NEW systematic Phase B-class causes now dominate the residual, plus one new asset-loss regression on the image-enlarge demo. Filing as **Phase B-13 sibling epic** per #665's gating rule.

## Acceptance gate evaluation

User's gate (from round-7 invocation):

> If residual content-loss + asset-loss ≤ 10 (with #701's 129 asset-loss carve-out still in scope), proceed inline; otherwise file Phase B-13.

Result:

| Metric | Round 6 (pre-B-12) | Round 7 (post-B-12) | Δ |
|---|---|---|---|
| content-loss | 71 | **55** | −16 |
| asset-loss | 129 | **145** | +16 |
| regression-class total | 200 | **200** | 0 |
| route-only-in-a (sym-diff) | 6 | 6 | 0 |
| route-only-in-b (sym-diff) | 13 | 13 | 0 |

The 16-route shift from content-loss → asset-loss matches what B-10/B-11 also did: previously some routes had BOTH content-loss AND asset-loss; once content was restored, only the asset-loss tier remained, moving the route into the asset-loss bucket. Net regression-class total is unchanged.

**Per-cluster B-12 acceptance**:

| Predicted | Pre-B-12 | Post-B-12 | Status |
|---|---|---|---|
| MDX-stub-driven content-loss | 8 | 0 | ✅ B-12-1 effective |
| math-equations bridge fallback | 2 | 0 | ✅ B-12-3 effective |
| tag-listing sidebar harness | 18 | (now group C, harness-side issue) | ⚠️ harness symmetry broken |
| tag-index Revision History | 2 | 0 | ✅ B-12-4 effective |
| 30-route extra-TOC-noise | 30 | (now ~28 across groups B / B2 / G) | ⚠️ no drop — different surface |

Carve-out structure (post-B-12 asset-loss):

- **143 routes** match the #701 framework-only carve-out exactly (5 Astro-emitted assets: ClientRouter, base.HWDxbTAy.css, mermaid-init, search.astro, katex CDN). No B-side counterparts. This is unchanged framework noise — out of scope.
- **2 routes** (`/docs/components/image-enlarge`, `/ja/docs/components/image-enlarge`) carry the framework noise PLUS lose 3 optimized `.webp` images — A serves `/_astro/image-{small,wide,opt-out}.*.webp`, B serves `./image-*.png`. **NEW non-carve-out asset-loss regression** — 2 routes.

Effective non-carve-out residual: **55 content-loss + 2 asset-loss = 57 routes** ≫ 10. **Gate fails. Filing Phase B-13.**

## Content-loss classification (55 routes)

Probed every route's `aMissing` / `bExtra` headings, `lmMissing` / `lmExtra` landmarks, and B-side HTML for the `data-zfb-content-fallback` marker. Six clusters:

| Cluster | Count | % | Type |
|---|---|---|---|
| C — missing complementary/navigation landmarks (harness strip-hidden-sidebar A-side asymmetry) | 24 | 44 % | Harness fix (Phase B-class) |
| B2 — extra "On this page" / "目次" heading + smart-quote/typography drift / source drift | 20 | 36 % | Mixed (Phase B + source noise) |
| B — extra TOC island + `navigation:Table of contents` landmark on no-heading index pages | 7 | 13 % | Phase B-class |
| E — apostrophe encoding (`'` vs `'`) on layout-demo pages | 2 | 4 % | Phase C-class (genuine) |
| G — extra-TOC + missing `note:` landmark on versioned snapshot installation page | 1 | 2 % | Phase B-class |
| Z — text-shrink with no heading/landmark diff (`/ja/docs/claude`) | 1 | 2 % | Phase C-class (genuine, small) |

### Cluster C — harness strip-hidden-sidebar A-side asymmetry (24 routes)

**Sample routes**: `/`, `/docs/tags`, `/docs/tags/ai`, `/docs/tags/cloudflare-worker`, …, `/docs/versions`, `/ja/docs/tags`, `/ja/docs/tags/ai`, …, `/ja/docs/versions`, `/ja`.

**Mechanism**: All 24 routes set `hideSidebar=true`. B-12-5 added `scripts/migration-check/lib/strip-hidden-sidebar.mjs` which strips `<aside id="desktop-sidebar" class="sr-only">` from BOTH sides before signal extraction so the hidden-sidebar landmarks fall out of the diff symmetrically.

The strip works on B (zfb DocLayout emits exactly `<aside id="desktop-sidebar" aria-label="Documentation sidebar" class="sr-only">`), but A (Astro DocLayout) renders a DIFFERENT aside on `hideSidebar=true` routes:

```
<aside class="
  fixed top-[3.5rem] left-0 z-40 h-[calc(100vh-3.5rem)] w-[16rem] flex flex-col
  border-r border-muted bg-bg transition-transform duration-200
  lg:hidden
  -translate-x-full
">
```

This is the mobile-drawer aside — `lg:hidden` (hidden on desktop) + `-translate-x-full` (hidden on mobile when drawer is closed, the default state). It is hidden on every viewport at first paint. It has NO `id="desktop-sidebar"` and NO `sr-only` class — so the strip regex doesn't match.

**Impact**: A's mobile drawer contributes:

- `complementary` landmark (the `<aside>` itself)
- `navigation` landmark (empty, the inner `<nav>`)
- `navigation:Site index` landmark on the homepage (an inner labelled nav)
- A non-trivial chunk of nav-link text → drives the content-loss classification

**Fix-locus** (Phase B-13-X — harness fix only):

- `scripts/migration-check/lib/strip-hidden-sidebar.mjs` — extend `hasHiddenSidebar` and `stripDesktopSidebarAside` to also match the Astro mobile-drawer pattern: `<aside ... class="...lg:hidden...-translate-x-full...">`. The trigger conditions are (a) `lg:hidden` (always hidden on desktop) AND (b) `-translate-x-full` (hidden on mobile in default state).
- Update `__tests__/strip-hidden-sidebar.test.ts` with both A and B fixtures.
- Re-run `pnpm migration-check` and confirm cluster C drops to 0.

### Cluster B + B2 + G — extra TOC island / heading on no-heading & hide_toc pages (~28 routes)

**Sample routes** (cluster B — 7 routes, full TOC island AND landmark in B):

- `/docs/reference`, `/ja/docs/changelog`, `/ja/docs/develop`, `/ja/docs/getting-started`, `/ja/docs/reference`, `/v/1.0/docs/getting-started`, `/v/1.0/ja/docs/getting-started`

**Sample routes** (cluster B2 — 20 routes, "On this page" / "目次" heading extra but no landmark diff):

- `/docs/claude-md/root`, `/docs/claude-skills/zudo-doc-design-system`, `/docs/getting-started/setup-preset-generator`, `/docs/guides/ai-assistant`, `/docs/guides/layout-demos/hide-sidebar`, `/docs/guides/tags`, `/docs/reference/{ai-assistant-api,component-first,design-system}`, `/ja/docs/{claude-agents,claude-md,claude-skills,components/category-nav,components/mermaid-diagrams,reference/component-first}`, `/v/1.0/ja/docs/getting-started/installation`

**Sample routes** (cluster G — 1 route): `/v/1.0/docs/getting-started/installation`

**Mechanism**: zfb's DocLayout emits the `Toc` island (and `MobileToc` island) on every doc route, even when the page has no body headings (category-index pages with only an h1 + description) or `hide_toc=true` was requested. The island's SSR placeholder includes the literal "On this page" / "目次" h2 and an empty `<nav aria-label="Table of contents">`. Astro's DocLayout omits the TOC entirely when there are no h2-h6 in the body OR when `hide_toc=true`.

Verified on `/docs/components` index (no body headings):

- A side: `<main>...</main>` with no TOC-related markup
- B side: `<div data-zfb-island="MobileToc">...</div>` and `<div data-zfb-island="Toc"><nav aria-label="Table of contents"><h2>On this page</h2><ul></ul></nav></div>`

**Sub-clusters within B2**:

- **B2a — smart-quote / HTML-entity over-escape** (~5-7 routes): zfb renders `"` as the literal `&quot;` HTML entity in headings, and renders the curly apostrophe `'` (U+2019) as the straight ASCII apostrophe `'`. Astro's MDX pipeline applies smartypants and yields the proper Unicode glyphs. Examples: `Terminology: "Update docs"` → `Terminology: &quot;Update docs&quot;` (claude-md/root); `Don't` → `Don't` (reference/design-system); `What's Happening` → `What's Happening` (layout-demos/hide-sidebar). This is a real B-side regression in addition to the extra-TOC heading.
- **B2b — pure source drift between origin/main and HEAD** (~5-7 routes): the MDX file has been edited on the current branch (or its ancestors) but not on origin/main. A-side build sees old MDX with old headings; B-side build sees new MDX with new headings. Examples: `/docs/guides/ai-assistant` (refactored from `Local Mode`/`Remote Mode`/`Cloudflare Worker` → `Required CF bindings` by commit `0ace1a9`); `/docs/reference/ai-assistant-api` (matching refactor). NOT regressions — they vanish when the harness baseline catches up to current main.
- **B2c — pure extra `目次` (Japanese) heading without other diffs** (~6 routes): the JA versions of the no-heading index pages — same root cause as cluster B but the harness sometimes places them in B2 rather than B based on whether the empty TOC nav contributes to the landmark count.

**Fix-locus** (Phase B-13-Y — TOC island gating):

- zfb host-side: `pages/lib/_doc-layout-with-defaults.tsx` (or wherever the `Toc` / `MobileToc` islands are wired) — gate them on `hideToc !== true && tocItems.length > 0`. Match Astro's DocLayout behavior.
- TOC items list is computed at SSR time from the page's `headings` array; if empty, omit both islands.

**Fix-locus** (Phase B-13-Z — typography / smart-quote conversion, optional):

- zfb's MDX pipeline → ensure smartypants (or equivalent) runs on prose content. May overlap with a zfb-upstream concern. If zfb cannot apply smartypants, document the residual as a known-typography-divergence and exclude from the harness via a normalization step.

### Cluster E — genuine Phase C apostrophe encoding (2 routes)

- `/docs/guides/layout-demos/hide-both`: A renders curly `'`, B renders straight `'`
- `/docs/guides/layout-demos/hide-toc`: same

These are the same B2a typography pattern but on routes that DON'T have an extra-TOC issue. Folded into the B-13-Z smart-quote fix above.

### Cluster Z — `/ja/docs/claude` text shrink with no heading/landmark diff (1 route)

`/ja/docs/claude`: `aMissing=[]`, `bExtra=[]`, `lmMissing=[]`, `lmExtra=[]`. The harness flags content-loss because text length shrank but no structural element is missing. Likely a small text edit between origin/main and HEAD on the JA `claude.mdx` source. Either source drift or a tiny prose edit that's not a regression. Defer to Phase C as a one-route mop-up.

## Asset-loss classification (145 routes — 2 patterns)

| Pattern | Routes | Status |
|---|---|---|
| Astro framework-only (5 assets: ClientRouter, base.HWDxbTAy.css, mermaid-init, search.astro, katex CDN) — A-only, no B counterparts | **143** | #701 carve-out — out of scope for B/C |
| 5 framework assets + 3 optimized `.webp` → 3 raw `.png` | **2** | NEW image-optimization regression — needs B-13-W |

The 2-route image-optimization regression is on `/docs/components/image-enlarge` (EN + JA). A serves `/_astro/image-{small,wide,opt-out}.*.webp` (Astro's image optimization), B serves `./image-{small,wide,opt-out}.png` (raw PNGs). This is a parity miss for the image-enlarge component demo. **Fix-locus** (Phase B-13-W): identify whether zfb has an image-optimization pipeline; either wire it up or document as known parity gap on this single component.

## Phase B-13 sub-epic proposal

Filing **Phase B-13** with four sub-epics matching the four systematic causes:

1. **B-13-1 — strip-hidden-sidebar A-side asymmetry** — extend the harness strip to also match the Astro mobile-drawer aside pattern (`lg:hidden -translate-x-full`). Coverage: 24 routes.
2. **B-13-2 — TOC island gating on no-heading / hide_toc pages** — omit `Toc`/`MobileToc` islands when there are no body headings or `hide_toc=true`. Coverage: ~28 routes (clusters B + B2c + G).
3. **B-13-3 — smart-quote / HTML-entity typography parity** — ensure zfb's MDX pipeline applies smartypants-equivalent transformations OR document as known divergence with harness normalization. Coverage: ~5-7 routes (B2a) + 2 routes (E) = ~7-9 routes.
4. **B-13-4 — image-optimization parity for image-enlarge demo** — wire up zfb's image optimization OR ship matching pre-optimized `.webp` artifacts. Coverage: 2 routes (asset-loss).

Plus deferred Phase C work: ~5-7 routes of source drift between origin/main and HEAD (vanish when harness baseline updates) + 1-2 small genuine prose drifts (cluster Z + part of B2b that are real edits) — handle inline once B-13 ships.

## Reproduction

```bash
git checkout base/zfb-migration-parity-phase-c-mop-up
git pull origin base/zfb-migration-parity-phase-c-mop-up
git merge origin/base/zfb-migration-parity   # post-B-12 super-epic base
node scripts/zfb-link.mjs                    # required to fix `zfb: not found`
pnpm migration-check                          # full rebuild, NOT --rerun
```

The `pnpm migration-check --rerun` flag explicitly skips the build phase and reuses on-disk snapshots. After merging post-B-12 super-epic base into the epic base, the snapshots are stale relative to source — a full rebuild is required to validate the merged state.

## Notes on the `zfb: not found` CI infra gap

PR #908 (Phase B-12) merged with the same pre-existing CI infra gap that PR #705 (Phase B-11) did: B-side `pnpm build` fails with `sh: 1: zfb: not found` because `node_modules/.bin/zfb` (a symlink wrapper to the Rust binary at `/home/takazudo/repos/myoss/zfb/target/release/zfb`) is not regenerated by pnpm install in the migration-check baseline worktree. Fix locally by running `node scripts/zfb-link.mjs` (the package.json `postinstall` script) before invoking `pnpm migration-check`. This is unrelated to Phase C scope and was flagged but not blocking per the user's round-7 instructions.
