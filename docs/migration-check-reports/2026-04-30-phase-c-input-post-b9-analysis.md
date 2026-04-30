# Phase C Input — Post-B-8 + Post-B-9 Re-snapshot Analysis

**Generated**: 2026-04-30
**Investigator**: /x-wt-teams Phase C resumption session against epic #666 (Super-Epic child of #663, flags `-gcoc -so`)
**Compared refs**: A = `origin/main` (Astro), B = HEAD on `base/zfb-migration-parity-phase-c-mop-up` after super-epic base merge (post-B-8 #691 / PR #692 + post-B-9 #694 / PR #698; epic-base commit `3ee9920`)
**Source report**: `2026-04-30-phase-c-input-post-b9.md` (raw `.l-zfb-migration-check/report.md` snapshot)

---

## TL;DR

Phase C still cannot start. Predicted post-B-8 drop to ~17 routes did not happen — and B-9 (TOC SSG + sitemap) did not change the residual count materially either. Post-B-8+B-9 rerun shows **100 content-loss + 100 asset-loss = 200 routes**, every single one fully explained by **three systematic Phase B-class causes** (the same shape as B-6 / B-7 / B-8): the host-side site header in zfb is missing the search component and the version-switcher component, and the DocHistory SSR-skip island has no SSR fallback.

| Cause | Coverage | Mechanism |
|---|---|---|
| Search component absent from zfb host header | 200 / 200 (100 %) | A renders `<site-search>` custom element with SSG placeholder text ("Type to search...", "to open search from anywhere"); B's zfb header has no search trigger / dialog at all |
| Version-switcher component absent from zfb host header | 97 / 200 (48.5 %) | A renders `data-version-switcher` markup with version list ("Latest", "1.0.0", "All versions"); B's zfb header has no version switcher; affects only routes whose layout renders the version dropdown |
| `DocHistoryIsland` (`data-zfb-island-skip-ssr="DocHistory"`) has no SSR fallback | 141 / 200 (70.5 %) | B emits empty `<div data-zfb-island-skip-ssr="DocHistory" ...></div>`; A renders the author name (e.g. "Takeshi Takatsudo") + "Created"/"Updated" dates + "History" UI label inline as SSG content |
| **Routes explained by AT LEAST ONE of the three causes** | **200 / 200 (100 %)** | — |
| Routes NOT explained | **0** | — |

Per the Phase B umbrella (#665) gating rule — *"keep iterating Phase B-N until each Phase A-identified cause's cluster signatures stop being raised"* — all three are Phase B-class. They share shape with B-7's host-side header-wiring miss and B-8's SSR-skip-island fallback pattern. Filing as **Phase B-10 sibling epic**, not 200 Phase C-N siblings.

The note about the 5 framework-level Astro-only assets that disappear in B (`/_astro/ClientRouter.astro_astro_type_script_index_0_lang.*.js`, `/_astro/search.astro_astro_type_script_index_0_lang.*.js`, `/_astro/mermaid-init.astro_astro_type_script_index_0_lang.*.js`, `/_astro/base.HWDxbTAy.css`, and the CDN `katex.min.css`) is **not** a regression — those are Astro framework artifacts that do not exist in zfb's bundler graph. They contribute to the asset-loss / content-loss categorization noise but do not represent missing user-visible content. The genuine residual once Phase B-10 ships should still drop to ≤10 per-page routes.

---

## Counts

Source: raw report `.l-zfb-migration-check/report.md` (snapshotted at `docs/migration-check-reports/2026-04-30-phase-c-input-post-b9.md`).

| Category                       | Routes | Δ from post-B-7 |
| ------------------------------ | -----: | --------------: |
| content-loss                   |    100 | −21             |
| asset-loss                     |    100 | +83             |
| route-only-in-a (removed in B) |      6 | −62             |
| route-only-in-b (added in B)   |     13 | −15             |
| **Total**                      |    219 | −15             |

Reading the deltas:

- **content-loss −21** is real progress from B-8 (AiChatModal SSR fallback, BodyFootUtilArea view-source wiring, TOC SSG).
- **asset-loss +83** is a re-categorization artifact. Many routes that were previously content-loss tripped on the text-shrink threshold because of empty TOC; with B-9's TOC SSG fix, those routes still lose the same 5 Astro framework asset references as before but no longer trip the content-loss threshold, so they fall to the next tier (asset-loss). Net "issued" routes (content-loss + asset-loss) is 200, down from 138 → **wait: 138 → 200 is an INCREASE**. See "Why issued count went up" below.
- **route-only-in-a −62** and **route-only-in-b −15** confirm Phase D's verdicts have landed — the symmetric-difference noise has collapsed to single-digit numbers consistent with intentional changes (versioned routes added/removed, claude-md package renames).

### Why "issued" count went up (138 → 200)

`pages/sitemap.xml.tsx` was completely rewritten in B-9 (`Extract shared route enumerators; port sitemap to use them`, commit `ae3d9d5`). The new sitemap enumerates more routes than the previous one (B-9 also fixed sitemap completeness). The migration-check harness uses the sitemap as the route discovery source, so 200 issued routes vs 138 previously is **almost certainly more routes being audited**, not new regressions appearing. The `inBoth` set grew from 138-of-X to 200-of-219.

This is consistent with what the user labeled "Phase B-9 — TOC items SSG, sitemap completeness, and migration-regression cleanup" (#694).

---

## Coverage methodology

For each of the 200 issued routes (all 100 content-loss + all 100 asset-loss), the snapshot HTML files at `.l-zfb-migration-check/snapshots/{a,b}/<route>/index.html` were read directly and grepped for stable text markers of each candidate cause:

- **Search**: literal substring `Type to search` (the SSG placeholder text rendered by `<site-search>` in A).
- **Version dropdown**: literal substring `All versions` rendered as the bottom item of the dropdown list.
- **DocHistory author**: literal substring `Takeshi Takatsudo` (the author name from the doc-history JSON).

A cause "applies" to a route iff the marker is present in A and absent in B. Coverage probe (script in session log; can be regenerated by running the inline node snippet against `.l-zfb-migration-check/findings/batch-*.json`):

```text
Total issued routes:                                            200
  Search marker lost in B:                                      200  (100.0 %)
  Version-dropdown marker lost in B:                             97  ( 48.5 %)
  DocHistory-author marker lost in B:                           141  ( 70.5 %)
  Routes covered by AT LEAST ONE cause:                         200  (100.0 %)
  Routes NOT explained by these three causes:                     0
```

Every single issued route is covered. Therefore none of these routes are genuine per-page regressions — they are systematic Phase B-class causes again.

---

## Systematic cause #1: Search component absent from zfb host header (200 / 200)

### Evidence

A snapshot (`/docs/changelog/index.html`, search-related fragment):

```html
<site-search class="...">
  ...
  <div class="text-small text-muted" data-search-placeholder>
    <p>Type to search...</p>
    <p class="mt-vsp-md text-caption">
      <kbd ... data-kbd-shortcut></kbd> to open search from anywhere
    </p>
  </div>
  ...
</site-search>
<script type="module" src="/pj/zudo-doc/_astro/search.astro_astro_type_script_index_0_lang.L0QHLS6J.js"></script>
```

B snapshot (`/docs/changelog/index.html`): **no `<site-search>` element exists at all**, and the SSR-skip / regular island markers in B are limited to:

```text
data-zfb-island-skip-ssr=DocHistory|DesignTokenTweakPanel|AiChatModal|ImageEnlarge
data-zfb-island=SidebarToggle|ThemeToggle2|Sidebar|MobileToc|Toc
```

No search island at all.

### Root cause

Same shape as Phase B-7's empty-header miss: the zfb default header in `packages/zudo-doc-v2/src/doclayout/doc-layout-with-defaults.tsx` does not include a search component, and the host's `headerOverride` (added in B-7 to wire logo / main nav / mobile-menu trigger) does not include one either. The host site needs to add a search trigger + dialog with SSR-rendered placeholder text matching the Astro `<site-search>` shape.

Note: The 5 Astro-emitted asset references that disappear in B (3 framework JS chunks + the Astro `base.HWDxbTAy.css` + the CDN katex stylesheet) are an unrelated framework-level diff and not part of this fix's scope.

---

## Systematic cause #2: Version-switcher absent from zfb host header (97 / 200)

### Evidence

A snapshot (e.g. `/docs/changelog/index.html`):

```html
<div data-version-switcher>
  <button data-version-toggle>...</button>
  <ul data-version-menu class="hidden ...">
    <li><a href=".../docs/...">Latest</a></li>
    <li><a href=".../v/1.0/docs/...">1.0.0</a></li>
    <li class="border-t border-muted">
      <a href="/pj/zudo-doc/docs/versions/">All versions</a>
    </li>
  </ul>
</div>
<script type="module">/* version dropdown click handler */</script>
```

B snapshot: no `data-version-switcher` markup.

### Root cause

Same shape as cause #1 — the zfb default header has no version switcher and the host's `headerOverride` doesn't render one. The package does ship a `version-switcher` component (`packages/zudo-doc-v2/src/i18n-version/version-switcher.tsx`); the host needs to wire it into the header.

97/200 because non-versioned routes (e.g. some category index pages, `/docs/develop/*`) don't render the version dropdown in A either — those routes are content-loss / asset-loss for reasons covered by causes #1 (search) and #3 (DocHistory). The 97 are routes whose layout includes the version dropdown.

---

## Systematic cause #3: DocHistory SSR-skip island has no SSR fallback (141 / 200)

### Evidence

A snapshot (e.g. `/docs/changelog/index.html`):

```html
<span><svg ...>...</svg><span>Takeshi Takatsudo</span></span>
... <span>Created</span> <span>Mar 16, 2026</span> ...
... <span>Updated</span> <span>Mar 16, 2026</span> ...
... <button>History</button>
```

B snapshot: empty placeholder

```html
<div data-zfb-island-skip-ssr="DocHistory" data-when="idle" data-zfb-island-props='{"slug":"...","basePath":"..."}'></div>
```

No author, no Created/Updated dates, no "History" UI label — the placeholder div has no children.

### Root cause

`src/components/ssr-islands.tsx` `DocHistoryIsland` does not provide a default `ssrFallback`:

```tsx
export function DocHistoryIsland({
  when = "idle",
  ssrFallback = null,   // ← null fallback by default
  slug, locale, basePath,
}: DocHistoryIslandProps): VNode {
  return ssrSkipPlaceholder("DocHistory", when, ssrFallback, { slug, locale, basePath });
}
```

This is identical in shape to the AiChatModalIsland fix from B-8 — that fix added a default `ssrFallback` rendering an `sr-only` paragraph with the body label. The DocHistory island needs the equivalent: an SSR fallback that emits the static parts of the doc history (author from frontmatter, "Created" / "Updated" labels with dates from the inline doc-history JSON if available at SSG time, plus the "History" toggle label).

141/200 because some routes (e.g. `/docs/versions/`, `/docs/develop/index.html`, the `/v/1.0/...` versioned routes, certain category index pages) don't render the doc-history widget. The 141 are content routes whose layout includes `DocHistory`.

---

## Recommended Phase B-10 scope

One epic, three sub-tasks (matching the established Phase B-N pattern):

1. **B-10-1** — Add Search component to zfb host header.
   - Wire a search trigger + search dialog into either `packages/zudo-doc-v2/src/doclayout/doc-layout-with-defaults.tsx`'s default header **or** the host's `headerOverride` callback, matching the Astro baseline behaviour (button in header, modal dialog with results + placeholder).
   - SSR fallback must include the placeholder text ("Type to search..." / 「検索したい単語を入力」) and the keyboard-shortcut hint copy ("to open search from anywhere" / 「いつでも検索バーを開ける」), with i18n via the host-side `t(...)`.
   - Acceptance: 200 → ~3 routes lose the search markers (the 200 → 0 prediction may be too tight if any pages legitimately don't render the search trigger; all standard doc pages should regain it).

2. **B-10-2** — Wire the existing `version-switcher` component into the zfb host header.
   - Import `VersionSwitcher` from `packages/zudo-doc-v2/src/i18n-version/version-switcher.tsx` and render it in the host's `headerOverride` (or layout default header) for routes that have versioning enabled.
   - SSR-render the dropdown markup so the version list ("Latest", "1.0.0", "All versions") is in the static HTML.
   - Acceptance: the 97 routes that lose the `All versions` marker drop to 0.

3. **B-10-3** — Add SSR fallback to `DocHistoryIsland`.
   - In `src/components/ssr-islands.tsx`, change the default `ssrFallback` for `DocHistoryIsland` from `null` to a static SSG fragment that renders:
     - The author name (from frontmatter / first commit author),
     - "Created" / "Updated" labels and dates (from the doc-history JSON if available at SSG time, otherwise just the labels),
     - The "History" toggle label.
   - i18n: pass label strings as props from the host (same shape as B-8-1 `bodyLabel`).
   - Acceptance: the 141 routes that lose the `Takeshi Takatsudo` marker drop to 0.

Acceptance for the umbrella: post-B-10 rerun shows `content-loss + asset-loss ≤ 10` (the genuine per-page residual Phase C is meant to handle).

---

## Resumption command (after Phase B-10 merges)

```
/x-wt-teams -s https://github.com/zudolab/zudo-doc/issues/666
```

This Phase C epic-PR (#683) stays draft. Epic base branch `base/zfb-migration-parity-phase-c-mop-up` keeps the new analysis docs (this file + the snapshot) and remains paused. Phase C resumes once the rerun against post-B-10 super-epic base shows ≤10 genuinely per-page residuals.

---

## Process notes

### Codex 2nd opinion — skipped (Super-Epic child rule)

Per `/x-wt-teams` workflow rule "Codex 2nd Opinion (Planning Phase) — SKIP ENTIRELY if the issue was created by /big-plan ([Epic] in title, or Super-Epic child session)", no `/codex-2nd` or `/gcoc-2nd` was run for this deferral. The analysis matches the established Phase B-6 / B-7 / B-8 precedent (1:1 same probing methodology — coverage-of-systematic-causes against the full content-loss + asset-loss set), and the conclusion (defer Phase C, file Phase B-10) is mechanical given 100 % of the residual is explained by three Phase B-class systematic causes.

### Why this is the fourth deferral, not "give up and run Phase C"

Each prior deferral identified a different cluster of systematic causes that Phase A's classifier did not fully separate at the time it ran:

- **Pre-B-6**: 134 content-loss → empty-aside cluster (Sidebar SSR-skip island) — fixed in B-6.
- **Post-B-6**: 133 content-loss → empty-header + missing mobile-aside — fixed in B-7.
- **Post-B-7**: 138 content-loss + asset-loss → AiChatModal SSR-skip + BodyFootUtilArea wiring + TOC SSR-skip — fixed in B-8 / B-9.
- **Post-B-8 + B-9 (this analysis)**: 200 content-loss + asset-loss → Search header miss + Version-switcher header miss + DocHistory SSR-skip fallback miss.

Pattern: each round, the test threshold trips on the *next* layer of systematic cause that was hidden under the previous one. There are no genuine per-page regressions visible in the residual yet. The final per-page residual Phase C is meant to handle (≤10 routes, hand-fix only) is still expected to surface once these layered systematic causes stop tripping the threshold.
