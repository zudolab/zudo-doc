# Phase C input — post-B-7 classification (2026-04-30)

**Source rerun**: `pnpm migration-check --current-only` (rebuilt snapshot B against post-B-7 super-epic base) followed by `pnpm migration-check --rerun`.

**Source report**: `docs/migration-check-reports/2026-04-30-phase-c-input-post-b7.md` (copy of `.l-zfb-migration-check/report.md`).

## Top-line

| Category | Routes |
|---|---|
| `content-loss` | 121 |
| `asset-loss` | 17 |
| `route-only-in-a` | 68 (handled by Phase D — confirmed intentional) |
| `route-only-in-b` | 28 (handled by Phase D — confirmed intentional) |
| `identical` / `cosmetic-only` etc. | 0 reported (everything else clear) |

The relevant residual for Phase C is the 121 + 17 = **138 routes flagged as content-loss or asset-loss**.

## Decision: defer Phase C again — file Phase B-8

The residual is **not** ~17 genuine per-page regressions as the pre-B-7 prediction expected. Diagnostic probing across all 138 routes shows the residual is **fully explained by systematic SSR-skip island and consumer-wiring issues**, exactly the same pattern as B-6 (empty Sidebar) and B-7 (empty header + missing mobile sidebar).

Per #665's gating rule ("keep iterating Phase B-N until each Phase A-identified cause's cluster signatures stop being raised"), this batch is Phase B-class, not Phase C-N siblings. Filing as 138 Phase C-N sibling epics would be process noise; one Phase B-8 epic collapses the entire residual.

## Per-cause breakdown (content-loss, 121 routes)

Coverage check across all 121 content-loss routes:

| Cause | Routes affected | Mechanism |
|---|---|---|
| `AiChatModal` SSR-skip island renders empty `<div>` during SSG | 121 / 121 (100 %) | `src/components/ssr-islands.tsx` `AiChatModalIsland` emits placeholder only — body text "Ask a question about the documentation." never renders during SSG, only after client hydration. |
| `BodyFootUtilArea` view-source link suppressed because consumer doesn't pass `sourceUrl` | 119 / 121 (98 %) | `pages/lib/_doc-history-area.tsx` calls `<BodyFootUtilArea docHistory={docHistory} />` without `sourceUrl`. Per the v2 component contract, when `sourceUrl` is falsy the "View source on GitHub" / "GitHub でソースを見る" link is suppressed. The consumer must compute the URL from `settings.githubUrl + contentDir + entryId` and forward it. |
| TOC island ("On this page" / 目次) renders empty during SSG | 93 / 121 (77 %) | TOC heading text from the legacy `aside-right-column` / TOC component is missing from the SSR output. Likely the same SSR-skip island pattern as Sidebar (B-6) — the package wrapper emits a placeholder marker without rendering the static `<h2>On this page</h2>` heading + nav stub. |
| **Routes explained by ANY of the three causes** | **121 / 121 (100 %)** | — |
| Routes affected by ALL three | 92 / 121 (76 %) | — |
| Routes NOT explained by these three | **0** | — |

Every single content-loss route is fully explained — none are genuine per-page regressions.

## Per-cause breakdown (asset-loss, 17 routes)

All 17 asset-loss routes lose **identical** asset deltas — same systematic root cause:

- 6 distinct `/_astro/HASH.js` chunks (per route)
- 1 `https://cdn.jsdelivr.net/npm/katex@0.16.38/dist/katex.min.css` reference
- 1 `/_astro/HASH.css` chunk

The 17 routes are mostly category index pages and short-prose pages (`/`, `/ja`, `/docs/guides/configuration`, `/docs/components/html-preview`, etc.). They don't trip the content-loss text-shrink threshold because their prose body is short, but they still lose the same chunks. The other 121 content-loss routes also lose these chunks — they just get categorized as `content-loss` first because the categorizer's precedence is `content-loss > asset-loss` (per `scripts/migration-check/compare-routes.mjs:184`).

Likely root cause: zfb's SSR-skip island wrapper bypasses Vite/zfb's lazy-chunk emission for client-only components, so the chunks Astro previously emitted (and the CDN katex stylesheet referenced from the math-equations entry) never end up in the rendered HTML's asset graph. The fix path is the same as the content-loss fixes — render the SSR-skip islands during SSG so their imports are walked by the bundler.

## Recommended Phase B-8 scope

One epic, three sub-tasks (matching the established Phase B-N pattern):

1. **B-8-1** — `AiChatModal` SSR-skip island: render the modal trigger button + its accessible body label ("Ask a question about the documentation.") during SSG so screen readers and SEO get the content. Hydration replaces with the interactive modal.
2. **B-8-2** — `BodyFootUtilArea` view-source wiring: in `pages/lib/_doc-history-area.tsx` (and any sibling consumer), compute `sourceUrl` from `settings.githubUrl + contentDir + entryId` and pass it. Resolve the i18n label via the host-side `t("doc.viewSource")` and pass as `viewSourceLabel`.
3. **B-8-3** — TOC SSR-skip island: render the TOC heading ("On this page" / 目次) + outline list during SSG, matching the Sidebar fix from B-6.

Acceptance: rerun `pnpm migration-check --rerun` post-B-8; expected `content-loss` count drops to 0 and `asset-loss` count drops to 0 (or to a small genuine residual).

## Resumption command (after Phase B-8 merges)

```
/x-wt-teams -s https://github.com/zudolab/zudo-doc/issues/666
```

This Phase C epic-PR (#683) stays draft. Epic base branch `base/zfb-migration-parity-phase-c-mop-up` keeps the new analysis docs (this file + the snapshot) and remains paused. Phase C resumes once the rerun against post-B-8 super-epic base shows ≤10 genuinely per-page residuals.

## Process note — 2nd opinion skipped

Per `/x-wt-teams` workflow rule "Codex 2nd Opinion (Planning Phase) — SKIP ENTIRELY if the issue was created by /big-plan ([Epic] in title, or Super-Epic child session)", no `/codex-2nd` or `/gcoc-2nd` was run for this deferral. The analysis matches the established Phase B-6 / Phase B-7 precedent (1:1 same probing methodology — coverage-of-systematic-causes against the full content-loss set), and the conclusion (defer Phase C, file Phase B-N) is mechanical given 100 % of the residual is explained by Phase B-class systematic causes.
