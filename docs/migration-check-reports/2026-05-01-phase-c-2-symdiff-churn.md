# Phase C-2 — Symmetric-diff route churn (carve-out)

**Generated**: 2026-05-01
**Source triage**: `docs/migration-check-reports/2026-05-01-phase-c-input-post-b16-analysis.md` (round-11, C-2 cluster)
**Epic**: #666

---

## Summary

13 routes in the round-11 content-loss set show diffs that are entirely driven by
membership changes in tag-listing pages, the ja-tag index, and the ja changelog page.
These are **not regressions** — they are expected churn caused by intentional
doc-content changes between the A snapshot (origin/main baseline) and the B snapshot
(HEAD). This document records the carve-out decision so the routes can be excluded from
mop-up work without further investigation.

---

## Affected routes (C-2 cluster — 13 routes)

| Route |
| --- |
| /docs/tags/ai |
| /docs/tags/cloudflare-worker |
| /ja/docs/changelog |
| /ja/docs/tags |
| /ja/docs/tags/ai |
| /ja/docs/tags/cloudflare-worker |
| /ja/docs/tags/content |
| /ja/docs/tags/customization |
| /ja/docs/tags/design-system |
| /ja/docs/tags/doc-history |
| /ja/docs/tags/i18n |
| /ja/docs/tags/search |
| /ja/docs/tags/type:guide |

---

## Root cause

Tag-listing pages, the ja-tag index, and the changelog page are **dynamically composed
at build time** from the current set of published docs. They enumerate every page that
carries a given tag (or every changelog entry) and render one card per member. Their
HTML output is therefore a direct function of the full doc inventory at the time of the
build.

The A snapshot (origin/main) and the B snapshot (HEAD) have diverged doc inventories:

- **Only-in-A pages** (removed in HEAD): `/docs/reference/ai-chat-worker`,
  `/docs/changelog/010`, and others. These pages were live in origin/main but have been
  intentionally removed from HEAD. Every tag-listing page that referenced them in A
  now shows a missing card when diffed against B.
- **Only-in-B pages** (added in HEAD): `/docs/concepts/*`, `/docs/claude-md`, and other
  new articles added in HEAD that do not yet exist in origin/main.

Every tag and changelog page whose membership overlaps these additions or removals
produces a "content-loss" hit in the harness: the B-side card list is shorter or
different, and the aggregate count string changes (e.g. "3 pages" → "2 pages").
This affects both the EN tag pages and the full ja-tag index, accounting for all 13
routes in this cluster.

---

## Diff sample — /docs/tags/ai (Sample 6 from round-11 triage)

From `2026-05-01-phase-c-input-post-b16-analysis.md` §Sample 6:

> **Symmetric-diff route churn drives a missing tagged-page card.** A's listing
> includes `<a href="/pj/zudo-doc/docs/reference/ai-chat-worker/">AI Chat Worker
> (Cloudflare)</a>` plus the "3 pages" count. B has "2 pages" and the card is gone
> because `/docs/reference/ai-chat-worker/` is in the symmetric-diff "only-in-A"
> list (intentionally removed in HEAD). NOT a regression — driven by intentional
> doc-churn.

`/docs/tags/cloudflare-worker` shows the same shape: "2 pages → 1 page".

---

## Disposition

**Not a regression.** The diffs are a mechanical consequence of the doc inventory
divergence between origin/main (A) and HEAD (B). No migration code path is broken.
The mismatches will resolve naturally once origin/main catches up to HEAD's doc state
(i.e. once the removed pages are absent from origin/main and the new pages are merged
into origin/main).

No source change is required in this PR or in any mop-up epic. These 13 routes are
**carved out** from Phase C action items.

---

## Action

None. Document only. Carve-out confirmed.
