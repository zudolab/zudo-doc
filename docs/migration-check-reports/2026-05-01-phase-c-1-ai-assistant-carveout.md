# Phase C-1 — ai-assistant source-drift carve-out

**Date**: 2026-05-01
**Cluster**: C-1 (of six Phase C clusters identified in round-11 triage)
**Triage source**: `docs/migration-check-reports/2026-05-01-phase-c-input-post-b16-analysis.md`
**Epic**: #666

---

## Affected routes (4)

| Route | headings == | Δ heads |
| --- | :-: | :-: |
| /docs/guides/ai-assistant | false | −1 |
| /docs/reference/ai-assistant-api | false | −1 |
| /ja/docs/guides/ai-assistant | false | −1 |
| /ja/docs/reference/ai-assistant-api | false | −1 |

---

## Cause: source drift, not a migration regression

The migration-check harness compares the **B build** (HEAD of this branch — the zfb migration target) against the **A build** (origin/main — the Astro baseline). For these four routes, `origin/main` still contains the older Astro implementation of the ai-assistant guide and reference articles. HEAD contains a refactored version that reflects a CF Worker → SSR redesign of those articles, introducing different section groupings.

Because the harness compares HEAD (B) against the lagging origin/main baseline (A), the changed headings register as "content-loss" even though nothing was lost from B — the source simply diverged between the two sides.

The heading sets for `/ja/docs/reference/ai-assistant-api` illustrate this clearly:

- **A headings** (origin/main, older Astro version):
  `Endpoint`, `Request Body`, `Success Response (200)`, `Error Response (400/500)`,
  **`Environment Variables`**, **`Backend Modes`** → `Local Mode (AI_CHAT_MODE=local)`,
  `Remote Mode (AI_CHAT_MODE=remote)`, `Documentation Context`, `Revision History`, `AI Assistant`
- **B headings** (HEAD, refactored version):
  same leading headings, then **`CF Env Bindings`**, **`Security`**, `Documentation Context`,
  `Revision History`, `目次` (extra in-content TOC heading), `AI Assistant`

The delta of −1 comes from `Environment Variables` + two `Backend Modes` sub-headings (3 headings on A) being replaced by `CF Env Bindings` + `Security` (2 headings on B) in the refactored implementation. The same structural substitution applies to the EN pair and the guides variant.

---

## Disposition: NOT a regression — carve-out

These four routes are a **source-drift carve-out**, not a migration regression. The zfb migration faithfully carried the ai-assistant refactor into the B build. The A baseline on `origin/main` has simply not received the same refactor yet.

These routes will reconcile automatically when the ai-assistant CF Worker → SSR refactor lands on `origin/main` and the A build baseline advances to include those articles.

**No comparator change is warranted.** Per the project lessons skill, patching the comparator to suppress a carve-out requires explicit justification and carries risk of masking real regressions. Source drift is the documented exception — the correct action is to record and skip.

---

## Action

- **No source change in this PR.** No MDX, component, or harness script modifications.
- The harness will continue to surface these four routes as content-loss until `origin/main` catches up with the ai-assistant refactor.
- When that refactor lands on main, re-run the migration check; these four routes should drop out of the content-loss list automatically.

---

## References

- Round-11 triage analysis: `docs/migration-check-reports/2026-05-01-phase-c-input-post-b16-analysis.md` — Cluster summary table (C-1 row) and Sample 2
- Cluster context: this carve-out was anticipated in #666 round-9 and round-10 comments
