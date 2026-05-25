# Phase C Input — Post-B-10 Re-snapshot Analysis (round 5)

**Generated**: 2026-04-30
**Investigator**: `/x-wt-teams` Phase C resumption session against epic [#666](https://github.com/zudolab/zudo-doc/issues/666) (Super-Epic child of [#663](https://github.com/zudolab/zudo-doc/issues/663), flags `-s -so -gcoc`)
**Compared refs**: A = `origin/main` (Astro), B = HEAD on `base/zfb-migration-parity-phase-c-mop-up` after super-epic base merge (post-B-10 [#701](https://github.com/zudolab/zudo-doc/issues/701) / PR #702; epic-base commit `dbf456a` after hotfix)
**Source report**: [`2026-04-30-phase-c-input-post-b10.md`](./2026-04-30-phase-c-input-post-b10.md) (raw `.l-zfb-migration-check/report.md` snapshot)

---

## TL;DR

Phase C still cannot start. Predicted post-B-10 drop to ≤ 10 routes did not happen — post-B-10+hotfix rerun shows **83 content-loss + 117 asset-loss = 200 routes**. Coverage probing shows three findings:

| Finding | Coverage | Class |
|---|---|---|
| **B-10 introduced two build-breaking bugs** that were never gated by CI (PR #702 had no checks). The `_search-widget-script.ts` regex literal lived inside a template literal containing an unescaped `${}` — the TS parser crashed with `Unexpected }`. The `_doc-history-area.tsx` b10-3 enrichment imported `getFileCommits` / `getCommitInfo` from `@/utils/doc-history`, which transitively pulls in `gray-matter` (Node-only `fs`); zfb's bundler dragged the page tree into the client graph and the build failed with `Could not resolve "fs"`. | **`pnpm build` was failing on `base/zfb-migration-parity` itself** — every downstream session (Phase E, Phase B-11+) would have hit the same wall. | Hotfix already committed inline (commit `dbf456a`) so the rerun could proceed. The Phase B-11 epic includes cherry-picking this hotfix back into the super-epic base as its first step, so other epic sessions also unblock. |
| **DocHistory SSR fallback (author + Created/Updated dates) absent** because the b10-3 helper that called git was removed by the hotfix. | 141 / 200 (70.5 %) — every doc page that A renders with a static-HTML author. | **Phase B-class.** Same shape as B-8-1 / b10-3 — needs an SSR-time author/dates render that does NOT drag Node-only utilities into the client bundle. Filing as Phase B-11. |
| **DocHistory area absent on tag-listing pages and versioned snapshot routes.** 20 tag listings (10 EN + 10 JA) and 4 versioned routes lose the `<section aria-label="Document utilities">` landmark and its `h2:Revision History` heading because those routes do not render `<DocHistoryArea>` at all. | 24 / 200 (12 %). | **Phase B-class** (single layout-level fix → many routes). Bundling under Phase B-11 alongside the SSR fallback work. |
| 5 framework-level Astro-only assets (`/_astro/ClientRouter*.js`, `/_astro/search*.js`, `/_astro/mermaid-init*.js`, `/_astro/base.*.css`, CDN katex CSS) on 200 / 200 routes. | 200 / 200 (100 %). | **Out of scope** per [#701](https://github.com/zudolab/zudo-doc/issues/701)'s explicit framework-noise carve-out. These are zfb-vs-Astro bundler-graph differences that contribute to the asset-loss / content-loss categorization but represent no missing user-visible content. |

Per #665's gating rule — *"keep iterating Phase B-N until each Phase A-identified cause's cluster signatures stop being raised"* — the residual is once again Phase B-class, not 200 Phase C-N siblings. Filing as **Phase B-11**.

The genuine per-page residual that Phase C #666 will eventually mop up is currently masked under the SSR-fallback / tag-page DocHistory issue; once Phase B-11 ships, the rerun should drop close to the originally predicted ≤ 10 routes.

---

## Counts

Source: raw report `.l-zfb-migration-check/report.md` (snapshotted at `2026-04-30-phase-c-input-post-b10.md`).

| Category                       | Routes | Δ from post-B-9 |
| ------------------------------ | -----: | --------------: |
| content-loss                   |     83 | −17             |
| asset-loss                     |    117 | +17             |
| route-only-in-a (removed in B) |      6 | 0               |
| route-only-in-b (added in B)   |     13 | 0               |
| **Total**                      |    219 | 0               |

Reading the deltas:

- **content-loss −17, asset-loss +17**: B-10's b10-2 (version-switcher) lifted 17 versioned routes out of content-loss. They now only fail the asset-loss tier (still missing the 5 Astro framework asset references), which is expected noise.
- **content-loss + asset-loss = 200** is unchanged — every issued route is still flagged because of the two remaining systematic causes.
- **Symmetric-difference unchanged** — Phase D verdicts still hold; no new add/remove drift.

---

## Coverage methodology

For each of the 200 issued routes (all 83 content-loss + all 117 asset-loss), the snapshot HTML files at `.l-zfb-migration-check/snapshots/{a,b}/<route>/index.html` were read directly and grepped for stable text / aria-label markers of each candidate cause:

- **Search**: `Type to search` (EN) or `検索したい単語を入力` (JA) — the SSG placeholder text rendered by the search widget. Locale-aware probe.
- **Version dropdown**: `All versions` — bottom item of the version dropdown list.
- **DocHistory author**: `Takeshi Takatsudo` — author name from the doc-history JSON.
- **Document utilities region**: `region:Document utilities` from the diff.landmarks list (presence in A, absence in B).
- **Revision History h2**: `h2:Revision History` from the diff.headings list.
- **Category navigation**: `aria-label="Category navigation"`.
- **Site index**: `aria-label="Site index"`.

Coverage probe:

```text
Total issued routes:                                            200
  Search marker missing in B (locale-aware):                      0  (  0.0 %)  ← B-10 b10-1 fully fixed
  Version-switcher marker missing in B:                            0  (  0.0 %)  ← B-10 b10-2 fully fixed
  DocHistory author marker missing in B:                         141  ( 70.5 %)  ← b10-3 reverted by hotfix
  region:Document utilities lost in B:                            24  ( 12.0 %)  ← tag pages + versioned snapshots
  h2:Revision History lost in B:                                  24  ( 12.0 %)  ← same 24 routes
  aria-label="Category navigation" lost in B:                      3  (  1.5 %)
  aria-label="Site index" lost in B:                               4  (  2.0 %)
```

Search and version-switcher are at zero — B-10 b10-1 and b10-2 fully landed. The remaining residual splits cleanly into (a) the 141 routes losing only the SSR-fallback DocHistory author marker (they still render the `<DocHistoryArea>` landmark, just without the author/dates static HTML), and (b) the 24 routes losing the `<DocHistoryArea>` landmark entirely (because tag-listing layout and versioned-snapshot layout don't import it).

---

## Build-breaking bugs in B-10 (hotfix landed inline, commit `dbf456a`)

PR #702 had **no CI checks configured** on its branch — `gh pr checks 702` returns `no checks reported`. Both bugs slipped through.

### Bug 1: `pages/lib/_search-widget-script.ts:32` — template-literal `${}` interpolation

The IIFE source string emitted via `dangerouslySetInnerHTML` is a tagged template literal. Inside that template, the regex literal `/[.*+?^${}()|[\\]\\\\]/g` contains the substring `${}` which the TS parser interprets as an **empty template-substitution expression**, failing with `Unexpected "}"`.

Fix: escape the `$` so the template literal contains the literal `${}` in the resulting JS source:

```diff
-    return text.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
+    return text.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&");
```

### Bug 2: `pages/lib/_doc-history-area.tsx` b10-3 enrichment — Node-only utility leak

The b10-3 sub-task added a `getHistoryMeta()` helper that reads git metadata for the SSR fallback:

```ts
import { getFileCommits, getCommitInfo } from "@/utils/doc-history";
```

The chain is `pages/lib/_doc-history-area.tsx` → `@/utils/doc-history` → `./content-files` → `gray-matter` (Node-only, `require('fs')`). zfb's bundler treats files imported from `pages/` as part of the page tree, which gets bundled for both server and client. esbuild fails with `Could not resolve "fs"`.

Fix: removed the `getHistoryMeta()` helper and the spread that populated `author / createdDate / updatedDate` on the `docHistory` prop. Phase B-11 will re-add SSR-time author/dates via a route that does not drag Node-only utilities into the client bundle.

The DocHistoryIsland still hydrates author + dates client-side from `/doc-history/{slug}.json`, so the user experience after JS hydration is unchanged.

---

## Systematic cause #1: DocHistory SSR fallback absent (author + Created/Updated)

**Coverage**: 141 / 200 (70.5 %) — every doc page that A renders with a static-HTML author marker (the union of routes that DO render `<DocHistoryArea>` but lack the b10-3 enrichment after hotfix).

**Mechanism**: Pre-hotfix, b10-3 called git utilities at component render time to populate `author`, `createdDate`, `updatedDate` on the `docHistory` prop passed to `<BodyFootUtilArea>`. Post-hotfix, those props are absent → `<DocHistoryIsland>` emits its empty `<div data-zfb-island-skip-ssr="DocHistory">` shell with only the static labels (`Created`, `Updated`, `History`), no author name or dates. A's static HTML has the full author/date strings inline.

**Fix locus** — Phase B-11 sub-task 1 (the b10-3 redo):

The fix needs to render author + dates as SSG-time HTML **without importing `@/utils/doc-history` into any file under `pages/`**. Three reasonable approaches, in order of preference:

1. **Read pre-generated doc-history JSON files at build time.** The zfb postbuild step generates `/doc-history/{slug}.json` (and locale variants). If the build is restructured so postbuild runs **before** SSG (or a build-time pre-step generates a slimmer manifest of author + dates that SSG can read), the page modules can read those JSON files synchronously via `fs` — but the page modules themselves still get bundled, so this also leaks `fs`.
2. **Move the lookup to a build-time data step.** Add a pre-SSG script (similar to `scripts/zfb-prebuild.mjs`) that emits a `dist/doc-history-meta.json` manifest of `{slug → {author, createdDate, updatedDate}}`. The page modules import this JSON via the resolver's JSON loader (esbuild handles JSON imports without `fs` calls in client code). This keeps the page tree free of Node-only imports.
3. **Move the page-level git lookup into the framework.** Have zfb's adapter call into a server-only data-fetcher hook that runs once per build, with results threaded into the SSG render context. Most invasive — out of scope for B-11.

Approach **2 (build-time JSON manifest)** is the closest match to existing patterns and what B-11 should pursue. Acceptance: the 141 routes that lose the `Takeshi Takatsudo` marker drop to 0 AND `pnpm build` continues to succeed on a clean checkout.

---

## Systematic cause #2: DocHistory area absent on tag listings + versioned snapshots

**Coverage**: 24 / 200 (12.0 %).

| Route family | Count |
|---|--:|
| Tag listing pages — `/docs/tags/<tag>` | 10 |
| Tag listing pages — `/ja/docs/tags/<tag>` | 10 |
| Versioned snapshot — `/v/1.0/docs/getting-started/...` | 2 |
| Versioned snapshot — `/v/1.0/ja/docs/getting-started/...` | 2 |
| **Total** | **24** |

**Mechanism**: These routes use a different page module than the regular doc layout. The regular `pages/docs/[...slug].tsx` and `pages/[locale]/docs/[...slug].tsx` import `<DocHistoryArea>` from `pages/lib/_doc-history-area.tsx`. The tag-listing and versioned-snapshot page modules do not — so the `<section aria-label="Document utilities">` landmark and its `h2:Revision History` heading don't appear in their static HTML at all.

A (Astro) renders the same `body-foot-util-area.astro` shell on these page types. The migration-check sees the entire landmark missing in B, plus the `Revision History` heading.

**Fix locus** — Phase B-11 sub-task 2:

The tag-listing page module(s) and the versioned-snapshot page module(s) should also import `<DocHistoryArea>` (with `entrySlug` / `contentDir` set appropriately, or omitted to suppress the view-source link). The DocHistory area should render at minimum the static labels (`Created`, `Updated`, `History`) and — after sub-task 1 lands — the author/dates resolved from the build-time manifest.

If a versioned-snapshot route legitimately should not show DocHistory (because the version is a frozen point-in-time snapshot), gate `<DocHistoryArea>` rendering on a per-route flag instead of dropping the area entirely; this preserves the landmark structure while suppressing the contents.

Acceptance: the 24 routes that lose the `region:Document utilities` landmark + `h2:Revision History` heading drop to ≤ 4 (the 4 versioned routes can legitimately render an empty area or be exempted by frontmatter flag).

---

## Note on Astro framework asset references (out of scope per #701)

Each issued route also "loses" 5 Astro-framework-emitted assets:

- `/_astro/ClientRouter.astro_astro_type_script_index_0_lang.*.js`
- `/_astro/search.astro_astro_type_script_index_0_lang.*.js`
- `/_astro/mermaid-init.astro_astro_type_script_index_0_lang.*.js`
- `/_astro/base.HWDxbTAy.css`
- `https://cdn.jsdelivr.net/npm/katex@0.16.38/dist/katex.min.css`

These are framework-level differences (zfb has its own bundler graph and chunk hashing) and are **not in scope** for B-10 or B-11 per the explicit carve-out in [#701](https://github.com/zudolab/zudo-doc/issues/701). They contribute to the asset-loss / content-loss categorization noise but represent no missing user-visible content. The genuine residual once Phase B-11 ships should drop close to the originally predicted ≤ 10 per-page routes; if that prediction is met, Phase D may wish to add an explicit "framework-asset whitelist" to the migration-check harness so the asset-loss count drops to its true value.

---

## Auto-Suggest hand-off

After the snapshot + analysis commits land on `base/zfb-migration-parity-phase-c-mop-up` and PR #683 is updated, file Phase B-11 and resume from there:

```
/x-wt-teams https://github.com/zudolab/zudo-doc/issues/<phase-b-11-number>
```

Once Phase B-11 merges into the super-epic base, resume Phase C with:

```
/x-wt-teams -s https://github.com/zudolab/zudo-doc/issues/666
```
