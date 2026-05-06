# Phase C input — post-B-16 32 content-loss triage

**Generated**: 2026-05-01
**Snapshot**: `.l-zfb-migration-check/` (round 11 — first run after Phase B-17 comparator fix landed via PR #1328)
**Input**: 32 surviving `content-loss` routes / 221 total
**Triage scope**: #1123

---

## TL;DR

The 32 surviving content-loss routes are **NOT a single shared cause**. They span at
least five distinct clusters, two of which are non-regressions (carve-outs) and three
of which are residuals from previously merged Phase B-N systematic causes still
showing up on a small per-route tail.

**Verdict: Branch B (genuinely scattered per-route diffs).** Resume Phase C #666 with
the route grouping below. No new Phase B-18 systematic-fix epic is warranted — every
non-carve-out diff is small enough to handle inline as a per-route mop-up under
Phase C, and the underlying causes have already had Phase B-N epics that landed
their main-cluster fixes.

---

## Diff-field shape — all 32 routes

`(headings.a == headings.b)` and heading-count delta (`b.length - a.length`):

| Route                                              | headings == | Δ heads |
| -------------------------------------------------- | :---------: | :-----: |
| /docs/claude-skills/zudo-doc-design-system         |    false    |   +1    |
| /docs/getting-started/setup-preset-generator       |    false    |   +1    |
| /docs/guides/ai-assistant                          |    false    |   −1    |
| /docs/reference/ai-assistant-api                   |    false    |   −1    |
| /docs/reference/design-system                      |    false    |   +1    |
| /docs/tags/ai                                      |    true     |    0    |
| /docs/tags/cloudflare-worker                       |    true     |    0    |
| /docs/versions                                     |    true     |    0    |
| /ja/docs/changelog                                 |    true     |    0    |
| /ja/docs/claude-skills                             |    false    |   +1    |
| /ja/docs/claude-skills/zudo-doc-design-system      |    false    |   +1    |
| /ja/docs/components/mermaid-diagrams               |    false    |   +1    |
| /ja/docs/develop                                   |    true     |    0    |
| /ja/docs/getting-started/setup-preset-generator    |    false    |   +1    |
| /ja/docs/guides/ai-assistant                       |    false    |   −1    |
| /ja/docs/reference/ai-assistant-api                |    false    |   −1    |
| /ja/docs/reference/design-system                   |    false    |   +1    |
| /ja/docs/tags                                      |    true     |    0    |
| /ja/docs/tags/ai                                   |    true     |    0    |
| /ja/docs/tags/cloudflare-worker                    |    true     |    0    |
| /ja/docs/tags/content                              |    true     |    0    |
| /ja/docs/tags/customization                        |    true     |    0    |
| /ja/docs/tags/design-system                        |    true     |    0    |
| /ja/docs/tags/doc-history                          |    true     |    0    |
| /ja/docs/tags/i18n                                 |    true     |    0    |
| /ja/docs/tags/search                               |    true     |    0    |
| /ja/docs/tags/type:guide                           |    true     |    0    |
| /ja/docs/versions                                  |    true     |    0    |
| /v/1.0/docs/getting-started                        |    true     |    0    |
| /v/1.0/docs/getting-started/installation           |    false    |   +1    |
| /v/1.0/ja/docs/getting-started                     |    true     |    0    |
| /v/1.0/ja/docs/getting-started/installation        |    false    |   +1    |

- **18 routes** with `headings == true` (content-loss is in body text, not headings).
- **10 routes** with B emitting an extra heading vs A (Δ = +1).
- **4 routes** with A having one more heading than B (Δ = −1).

---

## Sample inspections

Sampled 5 representative routes per #1123 (3 ja + 2 non-ja control), plus 2 EN
tag-listing controls and a non-tag JA control to verify cluster boundaries.
HTML compared by extracting `<main>` from
`.l-zfb-migration-check/snapshots/{a,b}/<route>/index.html` and diffing.

### Sample 1 — /ja/docs/tags/i18n (tag listing)

`headings == true`, `Δ = 0`. Diff sources:

1. **DocHistory island incomplete SSR (B)** — A renders the full `<button>` trigger
   + `<dialog>` panel inline (with the visible "History" label). B renders only the
   sr-only stub `<h2 class="sr-only">Revision History</h2>` plus a
   `data-zfb-island-skip-ssr="DocHistory"` placeholder containing only sr-only
   "作成 / 更新 / 履歴" labels. The visible button text is missing in B.
2. `<wbr>` rendered as `&lt;wbr&gt;` (A) vs `&lt;wbr>` (B) — minor entity-encoding
   diff in inline doc text.
3. Heading whitespace `> タグ付きページ: i18n </h1>` (A) vs no surrounding spaces
   (B) — MDX-emit whitespace normalization.

### Sample 2 — /ja/docs/reference/ai-assistant-api (reference)

`headings == false`, `Δ = −1`. **Source drift**, not a migration regression:

- A heads: `Endpoint`, `Request Body`, `Success Response (200)`, `Error Response (400/500)`,
  **`Environment Variables`**, **`Backend Modes` → `Local Mode (AI_CHAT_MODE=local)`,
  `Remote Mode (AI_CHAT_MODE=remote)`**, `Documentation Context`, `Revision History`,
  `AI Assistant`.
- B heads: same prefix, then **`CF Env Bindings`**, **`Security`**, `Documentation Context`,
  `Revision History`, **`目次`** (extra in-content TOC heading), `AI Assistant`.

This pair of EN+JA routes is the documented `ai-assistant` source-drift carve-out
called out in #666 round-9 and round-10 comments — `origin/main` Astro baseline lags
behind HEAD on the CF Worker → SSR refactor of these two articles. NOT a regression.

### Sample 3 — /ja/docs/components/mermaid-diagrams (component)

`headings == false`, `Δ = +1`. B emits an extra `[2, "目次"]` heading inside `<main>`,
between `Revision History` and `AI Assistant`. This is the **zfb DocLayout in-content
TOC heading** cause (one of the four B-15 systematic causes filed via #917 and merged
via #918, then surfaced again on this small ja-route tail). The body diff also includes
a different shape for the `MobileToc` island wrapper (A: `<astro-island>`; B:
`data-zfb-island="MobileToc"` with the menu items inlined).

### Sample 4 — /docs/versions (control, EN)

`headings == true`, `Δ = 0`. Diff is **purely whitespace normalization**:

```
< <h2 …>  Latest Version (Current) </h2>     (A — leading/trailing spaces inside text node)
> <h2 …>Latest Version (Current)</h2>         (B — no surrounding spaces)
```

Same on every cell of the version table and the inline `<a>` "View latest docs". No
DocHistory diff and no version-switcher diff (this page renders as a meta-page without
its own switcher). Pure whitespace, ~38-line diff entirely cosmetic.

### Sample 5 — /docs/reference/design-system (control, EN)

`headings == false`, `Δ = +1`. Two B-15-class causes still firing:

1. **`:underline` heading mangling (Astro `remark-directive` consumes `:underline` as
   a directive token).** A heading text:
   `[3, "hover on link-like elements"]` (A — the `\`hover:underline\`` inline code
   text dropped by remark). B heading: `[3, "Usehover:underlineon link-like elements"]`
   (B — kept the inline-code text but dropped surrounding spaces). Note: A is the
   actually-broken side here; this surfaces as content-loss because the harness compares
   `text(a) > text(b) by N%`. The 4 design-system routes
   (EN+JA × `/docs/reference/design-system` + `/docs/claude-skills/zudo-doc-design-system`)
   share this signature.
2. **Extra `[2, "On this page"]` heading** in B inside `<main>` — same root cause as
   the JA `[2, "目次"]` in Sample 3.

### Sample 6 — /docs/tags/ai (control, tag listing, EN)

`headings == true`, `Δ = 0`. Diff sources:

1. **Symmetric-diff route churn drives a missing tagged-page card.** A's listing
   includes `<a href="/pj/zudo-doc/docs/reference/ai-chat-worker/">AI Chat Worker
   (Cloudflare)</a>` plus the "3 pages" count. B has "2 pages" and the card is gone
   because `/docs/reference/ai-chat-worker/` is in the symmetric-diff "only-in-A"
   list (intentionally removed in HEAD). NOT a regression — driven by intentional
   doc-churn.
2. **DocHistory SSR incompleteness** (same as Sample 1).

`/docs/tags/cloudflare-worker` shows the same shape with "2 pages → 1 page".

### Sample 7 — /ja/docs/develop (control, non-tag JA)

`headings == true`, `Δ = 0`. Diff sources:

1. **DocHistory SSR incompleteness** — A renders the full inline date-block
   `<span>作成 2026年3月20日</span> · <span>更新 2026年4月23日</span> ·
   <span>Takeshi Takatsudo</span>` (visible to both screen and screen-reader) plus
   the trigger button + dialog. B renders only sr-only stubs + skip-ssr placeholder.
2. Heading-text whitespace cosmetic diff.

---

## Cluster summary

| Cluster | Routes affected (rough count) | Cause | Disposition |
| --- | ---: | --- | --- |
| **C-1: ai-assistant source drift carve-out** | 4 | `origin/main` Astro baseline lags HEAD on the CF Worker → SSR refactor of ai-assistant guide + reference EN/JA. | **Carve-out** — not a regression. Document and skip. |
| **C-2: Symmetric-diff route churn (tag listings + changelog)** | ~12 | Tagged-page lists / changelog / ja-tag-index recompute when route-only-in-A pages (`/docs/reference/ai-chat-worker`, `/docs/changelog/010`) and route-only-in-B additions (`concepts/*`, `claude-md`, …) shift the membership. | **Expected churn** — not a regression. Document. |
| **C-3: zfb DocLayout in-content TOC heading residual** | ~5–7 | B emits `<h2>On this page</h2>` / `<h2>目次</h2>` inside `<main>`. B-15 cleared the dominant cluster but left a small per-route tail (mermaid-diagrams ja, claude-skills ja+EN/JA pair, design-system EN/JA, /v/1.0/installation EN/JA). | **Residual mop-up** — fix in zfb DocLayout component or harness strip rule. |
| **C-4: design-system `:underline` heading text mangling** | 4 | Astro's remark-directive consumes `:underline` in heading text, dropping the surrounding inline-code text. Source-side issue on Astro A; B renders correctly but compares as different. | **Source-author fix** — change heading source to avoid `:underline` token, or harness-normalize. |
| **C-5: setup-preset-generator h3 alphabetization** | 2–4 | `<PresetGenerator>` h3 children rendered alphabetically in B vs source-order in A. (Includes /v/1.0 mirrors.) | **Component fix** — host PresetGenerator iteration-order or zfb MDX child-ordering. |
| **C-6: DocHistory island SSR-rendering incompleteness** | shared across most surviving routes (especially lightweight pages where it dominates) | B uses `data-zfb-island-skip-ssr="DocHistory"` placeholder rendering only sr-only stubs; A renders the full visible date-block + trigger button + dialog inline. B-2 (#672) ported the widget but the SSR fallback path is partial — visible content is missing. | **Residual fix** — extend zfb DocHistory island SSR to emit the visible (non-sr-only) date-block and button. |

These six clusters together account for all 32 routes. **C-1 and C-2 (16 of 32 routes,
50%) are non-regressions.** The remaining 16 routes are residuals from previously
merged Phase B-N causes that still surface on a small per-route tail — appropriate
for Phase C mop-up rather than a fresh Phase B-18 systematic epic.

---

## Decision rationale (Branch A vs Branch B per #1123)

Per the lessons skill (`.claude/skills/l-lessons-zfb-migration-parity/SKILL.md`):

> When one harness category dominates 50%+ of routes with the same diff signature,
> default suspicion is upstream zfb feature gap, not zudo-doc regression.

For this 32-route residual:

- The `/ja/docs/*` skew (20 of 32) is largely **driven by per-cluster reasons**, not a
  shared ja-rendering cause:
  - 10 `/ja/docs/tags/*` routes share the symmetric-diff churn cluster (C-2)
    plus DocHistory SSR (C-6).
  - 2 ja routes (`develop`, `versions`, `changelog`) are DocHistory SSR + churn.
  - 2 ja routes (`claude-skills`, `claude-skills/zudo-doc-design-system`) are extra
    TOC heading (C-3).
  - 2 ja routes (`components/mermaid-diagrams`, plus design-system pair) are extra
    TOC heading + `:underline` (C-3, C-4).
  - 2 ja routes (`getting-started/setup-preset-generator`) are alphabetization (C-5).
  - 2 ja routes (`reference/ai-assistant-api`, `guides/ai-assistant`) are source
    drift (C-1).
- No single ja-locale cause covers ≥50% of the ja samples → **does not satisfy the
  Branch A bar.**

**Branch B (genuinely scattered) is the correct path.** Resume Phase C #666 with
the cluster grouping above (C-1 carve-out, C-2 churn, C-3..C-6 mop-up). Per #666
sub-task 2's refinement rule (`N > 10` → batch into Phase C-N siblings), the 16
non-carve-out routes can be split into ~3 Phase C-N batches grouped by cluster.

---

## Files inspected

- `.l-zfb-migration-check/findings/batch-{0000..0006}-detailed.json` — diff JSON for all 221 routes.
- `.l-zfb-migration-check/snapshots/{a,b}/<route>/index.html` for the 9 sampled routes above.
- `.l-zfb-migration-check/report.md` — round-11 summary (32 content-loss + 2 asset-loss).
