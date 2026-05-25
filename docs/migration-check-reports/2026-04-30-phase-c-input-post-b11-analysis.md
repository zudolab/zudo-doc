# Phase C Input — Post-B-11 Re-snapshot Analysis (round 6)

**Generated**: 2026-04-30
**Investigator**: `/x-wt-teams` Phase C resumption session against epic [#666](https://github.com/zudolab/zudo-doc/issues/666) (Super-Epic child of [#663](https://github.com/zudolab/zudo-doc/issues/663), flags `-s -so -gcoc`)
**Compared refs**: A = `origin/main` (Astro), B = HEAD on `base/zfb-migration-parity-phase-c-mop-up` after super-epic base merge (post-B-11 [#704](https://github.com/zudolab/zudo-doc/issues/704) / PR #705 merged 2026-04-30)
**Source report**: [`2026-04-30-phase-c-input-post-b11.md`](./2026-04-30-phase-c-input-post-b11.md) (raw `.l-zfb-migration-check/report.md` snapshot)

---

## TL;DR

Phase C still cannot start. Predicted post-B-11 drop to ≤ 10 routes did not happen — post-B-11 rerun shows **71 content-loss + 129 asset-loss = 200 routes**. B-11 worked (DocHistory SSR fallback now renders author/dates statically; tag-listing and versioned-snapshot routes now wire `<DocHistoryArea>`), but coverage probing across the residual reveals four further systematic Phase B-class causes that were masked behind the B-7..B-10 systematic issues:

| Cause | Coverage | Class |
|---|---|---|
| **MDX component stubs render `null`** — `pages/_mdx-components.ts` binds `<CategoryNav>`, `<CategoryTreeNav>`, `<SiteTreeNav>`, `<SiteTreeNavDemo>`, `<Details>`, `<Island>`, `<PresetGenerator>`, `<SmartBreak>`, `<Avatar>`, `<Button>`, `<Card>`, `<MyComponent>`, `<PageLayout>` to `MdxStub` (returns `null`). The MDX corpus uses `<CategoryNav>` 26×, `<Details>` 11×, `<CategoryTreeNav>` 5×, etc. — A renders real cards, B renders nothing. | **8 routes** with B main < 50 % of A's main (`/docs/getting-started/setup-preset-generator`, `/docs/reference/ai-assistant-api`, `/docs/reference/component-first`, `/docs/reference/design-system`, `/docs/claude` JA mirror, etc.). Plus partial coverage of the **30 "extra TOC heading"** routes (their MDX uses `<CategoryNav>` to fill auto-index lists; missing cards correlate with the apparent content-loss flag). | **Phase B-class.** Real Preact bindings already exist in `@zudo-doc/zudo-doc-v2/nav-indexing` (`CategoryNav`, `CategoryTreeNav`, `SiteTreeNavDemo`, `NavCardGrid`, `DocCardGrid`, `TagNav`) and `@zudo-doc/zudo-doc-v2/details` — they need data-prop wrapping in `pages/lib/` (same pattern as `_doc-history-area.tsx`) and a swap of the `MdxStub` references in `pages/_mdx-components.ts`. |
| **math-equations zfb content bridge fallback** — both `/docs/components/math-equations` and `/ja/docs/components/math-equations` render with `<pre data-zfb-content-fallback>[zfb fallback render]…</pre>` instead of compiled MDX. Heading list collapses to just `2:On this page`. | 2 / 200 (1 %). | **Phase B-class.** The bridge falls back when the MDX module specifier can't be resolved — likely tied to KaTeX (`remark-math` / `rehype-katex`) emitting AST shapes the bridge or the zfb MDX pipeline doesn't handle. Investigation needed: either fix the bridge or carve out a math-equations-specific render path. |
| **Tag-listing pages (`/docs/tags/<tag>` and JA) lose sidebar tree HTML in B** — A renders the sidebar tree even when `hideSidebar={true}` is set on the layout (DOM hidden via CSS); B's zfb DocLayout omits the tree when `hideSidebar` is set. 21 routes affected. | 18 / 200 (9 %) flagged content-loss; further routes likely contribute to the 30 "extra TOC noise" group. | **Phase B-class** (DocLayout behavior parity). Either match A's "render-but-CSS-hide" pattern or accept as a deliberate B improvement and update the harness to ignore. |
| **`<DocHistoryArea>` not wired on tag-INDEX pages (`/docs/tags`, `/ja/docs/tags`)** — B-11-3 wired `<DocHistoryArea>` onto tag-LISTING (`[tag].tsx`) and versioned-snapshot routes, but the tag-INDEX page module (`pages/docs/tags/index.tsx` and `pages/[locale]/docs/tags/index.tsx`) was missed. A's tag-index renders the `region:Document utilities` landmark + `h2:Revision History`. | 2 / 200 (1 %). | **Phase B-class** (cousin of B-11-3 — same fix shape, different file). Single-file edit per page module. |

The **129 asset-loss routes** remain Astro-framework-only-asset noise per [#701](https://github.com/zudolab/zudo-doc/issues/701)'s explicit carve-out (zfb-vs-Astro bundler-graph differences with no missing user-visible content).

Per #665's gating rule — *"keep iterating Phase B-N until each Phase A-identified cause's cluster signatures stop being raised"* — all four causes are Phase B-class. Filing as **Phase B-12 sibling epic**, not Phase C-N siblings.

The genuine per-page residual that Phase C #666 will eventually mop up (apostrophe encoding, `&quot;` HTML entities in headings, `hover` → `hover:underline` text edits, `/docs/guides/ai-assistant` content drift, `/docs/versions` ~5 % text drift) appears to be **~6–10 routes** once Phase B-12 ships.

---

## Counts

Source: raw report `.l-zfb-migration-check/report.md` (snapshotted at `2026-04-30-phase-c-input-post-b11.md`).

| Category                       | Routes | Δ from post-B-10 |
| ------------------------------ | -----: | ---------------: |
| content-loss                   |     71 | −12              |
| asset-loss                     |    129 | +12              |
| route-only-in-a (removed in B) |      6 |  0               |
| route-only-in-b (added in B)   |     13 |  0               |
| **Total**                      |    219 |  0               |

Reading the deltas:

- **content-loss −12, asset-loss +12**: B-11's DocHistory SSR fallback (b11-2) and tag/versioned wiring (b11-3) lifted 12 routes out of the content-loss bucket. They now only fail the asset-loss tier (Astro framework noise), which is expected and out of scope per #701.
- **content-loss + asset-loss = 200** is unchanged — every issued route is still flagged because of the four remaining systematic causes above.
- **Symmetric-difference unchanged** — Phase D verdicts still hold; no new add/remove drift.

---

## Coverage methodology

For each of the 200 issued routes (all 71 content-loss + all 129 asset-loss), the snapshot HTML files at `.l-zfb-migration-check/snapshots/{a,b}/<route>/index.html` were read directly and probed with a Node script. Three signals:

1. `<pre data-zfb-content-fallback>` marker — means the bridge fell back to raw markdown.
2. Ratio `bMain.length / aMain.length` (how much main content B has vs A).
3. Heading-list diffs from the harness's existing `route.diff.headings` JSON.

### Content-loss classification

| Bucket | Count | Trigger |
|---|---:|---|
| zfb content fallback (`[zfb fallback render]`) | **2** | math-equations EN + JA |
| Tag-listing sidebar DOM-only diff (no headings lost) | 18 | `/docs/tags/<tag>` and JA mirrors |
| Tag-index missing Revision History h2 | 2 | `/docs/tags`, `/ja/docs/tags` |
| Extra TOC heading + slug + Astro view-transitions noise (B has ≥ A's headings) | 30 | `/docs/changelog`, `/docs/claude`, `/docs/components`, etc. |
| MDX-component-stub-driven (B main < 50 % of A) | 8 | `setup-preset-generator`, `reference/ai-assistant-api`, `reference/design-system`, etc. |
| Per-page genuine drift / encoding | 11 | apostrophe encoding (4), `&quot;` HTML entity (2), `hover` → `hover:underline` (2), `ai-assistant` content drift (2), `versions` 95 % ratio (2) |
| **Total content-loss** | **71** | |

The 30 "extra TOC noise" group also partly reflects the MDX-stub issue — many of those pages document or use `<CategoryNav>` / `<Details>`. Once Phase B-12 ships, expect this group to drop substantially.

### Asset-loss classification

All 129 asset-loss routes lose the same 5 Astro framework assets: 3 Astro `<script>` chunks (`/_astro/ClientRouter.*.js`, `/_astro/search.*.js`, `/_astro/mermaid-init.*.js`), `_astro/base.*.css`, and CDN katex CSS. Per [#701](https://github.com/zudolab/zudo-doc/issues/701)'s explicit carve-out: framework-level differences, not regressions, no missing user-visible content. Out of scope for Phase B/C — if ever pursued, would be a separate "harness-level filter for Astro framework-only assets" epic, not a content fix.

---

## B-12 fix-locus (each cause, one fix)

### Cause 1 — MDX component stubs

**Files to edit:**

- `pages/_mdx-components.ts` — replace `MdxStub` references for `CategoryNav`, `CategoryTreeNav`, `SiteTreeNav`, `SiteTreeNavDemo`, `Details`, `PresetGenerator` (and others as scope dictates) with real wrapper imports from `pages/lib/`.
- New wrapper files in `pages/lib/`:
  - `_category-nav.tsx` — wrap `CategoryNav` from `@zudo-doc/zudo-doc-v2/nav-indexing`. Reads `category` prop, calls `buildNavTree()` + `findNode()` host-side, passes resolved children as data props.
  - `_category-tree-nav.tsx` — same shape for `CategoryTreeNav`.
  - `_site-tree-nav-demo.tsx` — same shape for `SiteTreeNavDemo`.
  - `_details.tsx` — wrap `Details` from `@zudo-doc/zudo-doc-v2/details`. Likely no host-side data needed; just forward children + props.
  - `_preset-generator.tsx` — port the Astro `PresetGenerator` Island to a Preact component. Renders the h3 sections (Header right items, Color Scheme, Color Scheme Mode, Default Language, Features, Markdown Options, Package Manager, Project Name) statically so SSG matches A.

**Astro reference**: `git show origin/main:src/components/category-nav.astro` and the parallel `category-tree-nav.astro`, `site-tree-nav-demo.astro`, `details.astro`, `preset-generator.astro` show the data-resolution shape each Astro component used. Mirror that resolution host-side, then forward to the v2 component.

### Cause 2 — math-equations bridge fallback

**Files to investigate:**

- `pages/lib/_zfb-content-bridge.ts` (or whichever module hosts the bridge) — find the fallback path and instrument it for the math-equations module.
- `astro.config.ts` and `package.json` `remark-math` / `rehype-katex` deps — verify the zfb MDX pipeline applies the same plugin chain.
- Likely fix: either (a) add the math plugins to zfb's MDX config so KaTeX AST nodes compile, or (b) special-case the math-equations MDX render to use a different bridge entry.

### Cause 3 — Tag-listing sidebar DOM diff

**Decision needed**: match A's "render-and-hide-via-CSS" or accept B's "don't render". If matching A, the fix is in `@zudo-doc/zudo-doc-v2/doclayout` — when `hideSidebar` is true, still emit the sidebar HTML but with `hidden` / `aria-hidden` attributes. If accepting, update the migration-check harness to subtract sidebar HTML from B's text length when `hideSidebar` is true on the route.

Recommendation: accept as a deliberate B improvement (less DOM noise on tag pages, no user-visible regression) and document in B-12's epic body. Update harness in a follow-up if the noise becomes an obstacle to Phase E.

### Cause 4 — `<DocHistoryArea>` on tag-INDEX pages

**Files to edit:**

- `pages/docs/tags/index.tsx` — import `DocHistoryArea` from `../../lib/_doc-history-area` and render it inside the layout, mirroring B-11-3's pattern in `pages/[locale]/docs/tags/[tag].tsx`. Pass `slug="tags"`, `locale=defaultLocale`. No `entrySlug` (no MDX file behind tag-index).
- `pages/[locale]/docs/tags/index.tsx` — same edit, with `locale` resolved from the route params.

Single-line additions to two files. Should be a topic on its own under B-12.

---

## Per-page residual NOT covered by B-12 (genuine Phase C input — handle after B-12 ships)

These will become Phase C topics in a future round:

| Route | Issue | Likely fix |
|---|---|---|
| `/docs/guides/layout-demos/hide-both`, `hide-sidebar`, `hide-toc` (and JA mirrors) | Curly apostrophe `'` (A) vs straight `'` (B) in `2:What's Happening` | Edit MDX source to use straight apostrophe consistently. |
| `/docs/claude-md/root` (+ JA) | `3:Terminology: "Update docs"` rendered with `&quot;` HTML entity in B vs curly quote in A | Likely a remark/rehype plugin difference. Either match A's smartypants behavior or normalize source MDX. |
| `/docs/guides/tags` (+ JA) | `3:Homepage "All Tags" Section` — same `&quot;` issue | Same as above. |
| `/docs/claude-skills/zudo-doc-design-system` (+ JA) | `hover` (A) vs `hover:underline` (B) in heading text | Source MDX edit (the heading was renamed; A snapshot is stale; B is correct). May resolve naturally on next A snapshot. |
| `/docs/guides/ai-assistant` (+ JA) | A: `Cloudflare Worker (Standalone API)` h2 + `Local Mode` / `Remote Mode` h3. B: `Required CF bindings` h3 (no `Cloudflare Worker` h2). | Real content drift — investigate which one is current. Possibly resolve naturally on A re-snapshot if A is stale. |
| `/docs/versions` (+ JA) | Text shrunk to 95 % of A (just over the 5 % threshold) | Likely Astro framework noise leaking into the visible-text count. Investigate; may merge into the asset-loss carve-out. |

Total: **~6–10 routes** as predicted after B-12 ships. Within the `5 < N ≤ 10` band of the Phase C epic's refinement rule — handle inline as Phase C sub-tasks 3–N.

---

## What this round did

1. Re-confirmed Super-Epic child mode for `/x-wt-teams` (epic body `**Super-epic:** #663` markers present).
2. Merged post-B-11 super-epic base (`origin/base/zfb-migration-parity` after PR #705) into the epic base `base/zfb-migration-parity-phase-c-mop-up`. Resolved one conflict in `pages/lib/_doc-history-area.tsx` by taking the B-11 version (the round-5 hotfix that suppressed SSR author/dates is now superseded by b11-2's build-time manifest).
3. Wiped stale `.l-zfb-migration-check/snapshots/b/` and re-ran `pnpm migration-check --current-only --raise-issues` against the post-B-11 epic base. A snapshot reused (origin/main unchanged).
4. Probed all 200 issued routes (71 content-loss + 129 asset-loss) for the four candidate Phase B-class causes documented above.
5. Wrote this analysis. Snapshotted the raw report at `2026-04-30-phase-c-input-post-b11.md`.
6. Will file Phase B-12 sibling epic with the four causes as B-12-1 through B-12-4 (or fewer/more topics depending on how the new epic batches them).
7. Will update PR #683 body + title to reflect round-6 pause.
8. Will comment on issue #666 with this round's result and the resumption command.

Phase C remains paused. PR #683 stays draft.
