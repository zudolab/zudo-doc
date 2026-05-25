# Phase C Input — Classification Analysis

**Generated**: 2026-04-30
**Investigator**: /x-wt-teams Phase C session against epic #666
**Compared refs**: A = `origin/main` (Astro), B = `HEAD = base/zfb-migration-parity` (post Phase B-1..B-5)
**Source report**: `2026-04-29-phase-c-input.md` (raw `.l-zfb-migration-check/report.md` snapshot)

---

## TL;DR

Phase C cannot start as planned. The migration-check rerun after Phase B-1..B-5 still surfaces **134 content-loss routes**, but they are not 134 genuine per-page regressions. **All 134 share one systematic cause**: zfb's Sidebar island emits an empty SSG marker, so every route's `<aside>` has zero rendered content. **118 of those 134 have no other regression** — text shrink alone trips the >5% content-loss threshold.

Per the umbrella's gating rule (#665, "keep iterating Phase B-N until each Phase A-identified cause's cluster signatures stop being raised"), this is a **new systematic cause Phase A did not identify** and belongs in Phase B as a **Phase B-6** sibling epic, not in Phase C.

The genuine per-page residual (after subtracting the systematic cause) is **17 routes**: 16 with missing MDX headings, 1 with a missing landmark role on a versioned route. Phase C should resume against this list **only after Phase B-6 lands and a fresh rerun confirms the systematic cluster is gone**.

---

## Counts

Source: raw report `.l-zfb-migration-check/report.md` (snapshotted at `docs/migration-check-reports/2026-04-29-phase-c-input.md`).

| Category | Routes |
| --- | --- |
| content-loss | 134 |
| asset-loss | 4 |
| route-only-in-a (removed in B) | 68 |
| route-only-in-b (added in B) | 28 |
| **Total** | **234** |

Asset-loss and symmetric-difference routes are out of scope here — Phase E (#668) covers asset diffs, Phase D (#667) covers symmetric-difference audit.

---

## Classification of the 134 content-loss routes

Methodology: per-route check using `/tmp/scan-residual.mjs` (committed nowhere — recreate via the recipe in the appendix). For each route:

1. Recompute heading set delta (texts in A absent from B at any level).
2. Recompute landmark role-set delta (roles in A absent from B).
3. Measure visible-text shrink % across the full HTML.
4. Measure visible text inside every `<aside>` element on each side.

| Bucket | Routes | Definition |
| --- | --- | --- |
| Empty `<aside>` in B (systematic) | **134 / 134** | A has aside content > 0; B has 0 |
| Only-empty-aside (no heading/role regression) | **118 / 134** | the empty aside is the *sole* trigger |
| Missing MDX headings (per-page, real) | **16 / 134** | one or more heading texts in A absent from B |
| Missing landmark roles (per-page, real) | **1 / 134** | `note`, `region` missing on a single versioned route |
| Unexplained (no predicate fires) | 0 / 134 | sanity check — every route has at least one cause |

Buckets overlap: every route is in the empty-aside bucket; the 16 heading-loss routes are also in the empty-aside bucket; the 1 role-loss route overlaps with both.

---

## Systematic cause: empty Sidebar island in B

### Evidence

In every B snapshot, the desktop sidebar `<aside>` looks like this (verbatim from `/docs/claude-md/root`):

```html
<aside id="desktop-sidebar"
       aria-label="Documentation sidebar"
       class="hidden lg:block fixed top-[3.5rem] left-0 ...">
  <div data-zfb-island="Sidebar" data-when="load"></div>
</aside>
```

The `<div data-zfb-island="Sidebar" data-when="load">` has **zero children**. The corresponding A site renders the full Preact tree inside an `<astro-island>` wrapper (32,519 chars on the same route, with all menu/category/page links visible).

Across the 10 sampled empty-aside routes, A's aside contains 1,064 chars of visible text on each route in `claude-md/*` and `claude-skills/*`; B contains 0.

### Root cause (best read)

Astro's `client:load` directive renders the Preact island server-side and wraps the SSR output in `<astro-island>` so the runtime can hydrate. zfb's `<Island>` wrapper in `packages/zudo-doc-v2/src/sidebar/sidebar.tsx` emits only the `data-zfb-island="Sidebar"` marker. Either the `<Island>` helper from `@takazudo/zfb` is opting out of SSG for this island, or the data-prep host that supplies `treeComponent`/`nodes` is feeding it nothing during the SSG pass. The marker shape matches what zfb's hydration runtime expects, but the SSG body — the whole reason migration-check sees this as content-loss — is missing.

A short follow-up investigation in Phase B-6 will determine whether the fix lives in:

- the host wrapper that calls `<Sidebar treeComponent={SidebarTree} ... />` during SSG,
- the v2 `Sidebar` shell (forcing a server render before wrapping in `<Island>`),
- or zfb's `<Island>` helper itself (it should be running its child during SSG and emitting the result inside the marker div).

### Why this is Phase B, not Phase C

The umbrella for Phase B (#665) explicitly says:

> The gating signal is whether systematic clusters are gone, not a fixed numeric threshold — keep iterating Phase B-N until each Phase A-identified cause's cluster signatures stop being raised.

Phase A identified five causes; B-1..B-5 fixed each. The empty-sidebar pattern was not on Phase A's list, but it is **structurally the same kind of finding** — one source-level defect with N=134 fan-out. Filing it as Phase C-1..C-N siblings (per the umbrella's `N > 10` clause in #666) would be process noise: ten epics would all converge on the same one-line fix, and the 118 single-cause routes would clear themselves once that fix lands. The cleaner course is a sibling Phase B-6 epic with the same shape as B-1..B-5: one cause, one fix, one rerun, then iterate.

---

## Genuine per-page residual (Phase C real input — after B-6 lands)

These are the 17 routes that will *still* show up in the report once Phase B-6 fixes the empty sidebar. They cluster naturally by family:

### Heading regressions on specific MDX pages (16 routes, ≈6 batches)

| Cluster | Routes | Missing heading text(s) |
| --- | --- | --- |
| `claude-md/root` | `/docs/claude-md/root` | `Terminology: "Update docs"` |
| design-system "hover/Don't" | `/docs/reference/design-system`, `/ja/docs/reference/design-system`, `/docs/claude-skills/zudo-doc-design-system` | `Don't`, `hover on link-like elements`, `リンクには hover` |
| math-equations | `/docs/components/math-equations`, `/ja/docs/components/math-equations` | `Inline Math`, `Block Math`, `Fenced Code Block` (+ JA mirror) |
| setup-preset-generator | `/docs/getting-started/setup-preset-generator`, `/ja/docs/getting-started/setup-preset-generator` | `Project Name`, `Default Language`, `Color Scheme Mode` |
| ai-assistant config sections | `/docs/guides/ai-assistant`, `/docs/reference/ai-assistant-api` | `Local Mode`, `Remote Mode`, `Cloudflare Worker (Standalone API)`, `Environment Variables`, `Backend Modes` |
| layout-demos "What's Happening" | `/docs/guides/layout-demos/hide-both`, `/docs/guides/layout-demos/hide-sidebar`, `/docs/guides/layout-demos/hide-toc` | `What's Happening` |
| guides/tags | `/docs/guides/tags` | `Homepage "All Tags" Section` |
| reference/component-first | `/docs/reference/component-first` | `Using zudo-doc's Design Tokens` |

### Landmark regression on a versioned route (1 route)

| Route | Missing roles | Missing heading |
| --- | --- | --- |
| `/v/1.0/docs/getting-started/installation` | `note`, `region` | `Revision History` |

This is the only versioned-route hit in the residual. Likely a separate fix path (per-version layout) — a small Phase C-2 batch of one.

### Refinement-rule application

Per the umbrella step 2 in #666:

- N = 17 ⇒ falls in the `N > 10` bucket
- Suggested split: **Phase C-1** for the 16 heading regressions (~6 family batches) + **Phase C-2** for the single versioned-route landmark+heading regression. Or fold C-2 into C-1 as one route family — equally valid.

This split is recorded here for whoever resumes Phase C after Phase B-6 merges.

---

## Asset-loss (4 routes — defer to Phase E)

Routes flagged as `asset-loss`:

- `/`
- `/docs/components/html-preview`
- `/ja`
- `/ja/docs/components/html-preview`

Mostly the homepage og:image / view-transitions assets and the `<HtmlPreview>` component's iframe asset references. Proper home for this is Phase E (#668 — Verify non-HTML artifact diffs). Out of scope for both Phase C and Phase B-6.

---

## Recommendation

1. **Pause Phase C on epic #666**. Do not create a `base/zfb-migration-parity-phase-c-mop-up` branch, do not spawn worktree teams.
2. **Open Phase B-6 sibling epic**: "Render SidebarTree island content during SSG in zfb". Branch: `base/zfb-migration-parity-phase-b-6-sidebar-ssg`. Acceptance: after the fix, the residual content-loss count drops from 134 to ≈17.
3. **Resume Phase C** in a fresh /x-wt-teams session against #666 once B-6 merges and a rerun confirms the empty-aside cluster is gone. Phase C will then split into Phase C-1 (16 heading regressions, batched by family) and optionally Phase C-2 (the single versioned-route landmark/heading regression).

This sequencing matches what Phase A predicted ("a small tail of genuine per-page losses for Phase C — typically <30 routes, often <10") — that prediction was sound; Phase B simply missed one cause.

---

## Appendix — recreating the classification

The classifier is a one-shot Node script over the on-disk `.l-zfb-migration-check/findings/*-detailed.json` plus the snapshot HTMLs:

```bash
# 1. Run the migration check (heavy: builds two snapshots, compares 234 routes)
pnpm migration-check

# 2. Recreate /tmp/scan-residual.mjs from the analysis logic above
#    (route classification: missing-headings ∪ missing-roles ∪ empty-aside ∪ shrink %)

# 3. Run it
node /tmp/scan-residual.mjs
```

Outputs match the bucket counts above: 134 / 16 / 1 / 118 / 0.
