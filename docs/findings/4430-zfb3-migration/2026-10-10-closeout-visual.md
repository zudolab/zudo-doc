# Closeout visual + native 06R acceptance (#4505)

Owners: [#4475](https://github.com/zudolab/zudo-doc/issues/4475) (visual acceptance) and [#4500](https://github.com/zudolab/zudo-doc/issues/4500) (accepted 06R spec). This is a classification record. No product code changed.

## Verdict: the 47 height diffs are intended additions; one deep-nesting overlap defect goes to #4507

All 47 raw `nav`/`sidebarTree` height differences decompose into the 06R toolbar plus three new Guides pages, with **0 px residual**. The paired screenshots show no other sidebar or article change. One 06R defect turned up outside the 47 states, on the twelve-level fixture: the branch-focus control `◎` overlaps category label text at deep nesting. Its fix spec is in [#4507](https://github.com/zudolab/zudo-doc/issues/4507).

## Evidence identity

| Side | Source | Identity |
| --- | --- | --- |
| Capture artifact | `migration-parity-fd0764fbcba9a9a1059fbf142fbeac85b0a0c16b`, run [38030809260](https://github.com/zudolab/zudo-doc/actions/runs/38030809260) | API digest `sha256:b958508b166c8ab0512a9530e7338478a57df5fdd4030c3dca717ada24c22b10` (matches #4505), 65 + 65 PNGs; `baseline-head.txt` = `337b9f110793dccb4759bddd5273eab38cd9d2f0`, `current-head.txt` = `fd0764fbcba9a9a1059fbf142fbeac85b0a0c16b` |
| Baseline measurement | Frozen guarded build of `main@337b9f1` (`$HOME/.cache/zudo-doc-zfb3-parity/v2-337b9f110/dist`, see `scripts/zfb3-parity/README.md`) | Reproduces every artifact baseline height exactly (e.g. 957.781 / 399.781 / 423.781 / 1705.781) |
| Current measurement | https://pr-4477-zudo-doc-preview.takazudo.workers.dev | PR Checks [38030812860](https://github.com/zudolab/zudo-doc/actions/runs/38030812860), Preview Deploy job 114151756734: merge `2032547` = `fd0764f` merged into `337b9f1` (merge-base = `origin/main` = `337b9f1`, so the tree equals `fd0764f`). Worker version `3ef5558c-1adc-4b57-a2b9-f5c0ca03da9e`. It reproduces every artifact current height exactly. |
| Twelve-level / editorial fixture | `E2E_FIXTURES=sidebar` fixture built locally from this worktree at `fd0764f` (guarded) | `e2e/fixtures/sidebar/dist` |

The full screenshot sets, pair sheets and JSON are in cclogs under `zudo-doc/closeout-4505/` (`artifact/`, `pairs/`, `measure-*/`, `decompose.{json,md}`, `scope-current/`, `scope-fixture/`). Every browser run went through `heavy-guard.sh` and passed. None was denied.

## Inspection performed

- I viewed all 47 diff states as baseline|current pairs (12 contact sheets, sidebar region, plus the full article area for the 375px states). I also viewed the full Guides page at 1280 light, the JA 1280 and 1024-breakpoint sidebar crops, and the doc-history and ai-chat states at full width.
- Every pair shows the same two sidebar differences: the toolbar row (`↑ Broaden tree` + hint) between the filter and the tree, and a `◎` branch-focus control on collapsible categories. Header, breadcrumb, article, TOC, footer, dashed connectors, active-row highlight and light/dark treatment are unchanged. In the 375px default states the drawer is closed, so the `nav` delta has no visible effect. The 375px `mobile-drawer` state shows the toolbar inside the drawer.
- The Guides article also gained three cards that match the three new sidebar rows.
- These states are not among the 47 but were looked at anyway. In the baseline `doc-history` and `ai-chat` captures the panel or dialog is *not* open, while the current captures show it open. This is a baseline capture-state difference, not a current regression.

## Height decomposition (`sidebar-decompose.mjs measure` + `compare`)

The toolbar box is 46 px when the hint sits beside the Broaden button and 73 px when `flex-wrap` moves the hint onto its own 27 px caption row. Per-row heights are 38 px for a one-line row, plus 24 px for each extra wrapped line.

| Cluster (raw count) | States | Δ | Decomposition | Classification |
| --- | --- | --- | --- | --- |
| ≈46 px (38) | All EN non-Guides routes at 375/639/640/1023/1279/1280 plus the hover, focus, dialog and enlarge states | +46 | Toolbar 46 (hint inline); 0 rows, 0 residual | **Intended addition** (06R toolbar) |
| ≈73 px (5) | `/ja/docs/getting-started/` ×4 and the 1024 breakpoint | +73 | Toolbar 73: the hint wraps to its own row because the JA labels are longer, or because the 1024 sidebar is narrower; 0 rows, 0 residual | **Intended addition** (scope-hint wrapping, readable, no overflow) |
| 160 px Guides (4) | `/docs/guides/` 375/1280 light/dark | +160 | Toolbar 46 + 3 new rows × 38 (`Agent-readable export`, `Read-only MCP server`, `Migrating to zudo-doc 6`); 0 residual | **Intended**: toolbar plus content added on the base branch, not a layout change |

The extended measurement (60 states: 10 routes × 6 widths) adds JA Guides (+235 = 73 + 3 rows + 2 wrapped lines) and Guides at 1024 (+211 = 73 + 3 rows + 1 wrapped line). Residual is 0 in all 60 states.

## 06R behaviour cases (current side, `sidebar-decompose.mjs scope`)

| Case | Result | Classification |
| --- | --- | --- |
| Guides at 1024 light and 1280 dark | Initial root `Guides` once, hint `Configured tree`. Broaden reaches the configured forest, which is the highest level the showcase has, so the button is disabled with the hint `Highest available tree`. Restore returns to the `Guides` root and its 46 rows. | Intended |
| Japanese (`/ja/docs/guides/`, `/ja/docs/getting-started/`, 1024 and 320 drawer) | JA labels `ツリーを広げる` / `設定されたツリー` / `表示できる最上位のツリーです` / `現在のページのツリーに戻す`. The Restore label wraps to two lines at 1024 and stays readable; no row overflows. | Intended |
| Desktop 1024, narrow 1023 drawer, 390 touch drawer, 320 drawer | Broaden, focus and Restore keep the drawer open (`Close sidebar` stays visible). Following a tree link closes the drawer (`Open sidebar` visible) in all three drawer walks. | Intended |
| Twelve-level fixture, 1024 and 390 drawer | After focusing level 12, each Broaden click moves exactly one editorial level: 12→11→…→1→Guides→forest. The hint names the next level, the root appears once at every step, and the drawer stays open. | Intended |
| Editorial fixture (`/docs/editorial/background`) | Configured forest `Color recipes ; Outline recipes` → `Surfaces & borders` → `Utility reference` (disabled, `Highest available tree`). Restore brings back the authored two-root forest. | Intended |
| Link, disclosure and branch focus as separate actions | On linked categories these are three distinct elements with distinct accessible names (`/docs/guides/` link, `Collapse Guides`, `Show only this branch: Guides`). The focus target is 28×38 px, does not overlap the link or disclosure, and is tabbable. Enter on `◎` keeps the URL. Touch `tap()` on Broaden, `◎` and Restore works in the 390 drawer. | Intended |
| Visible keyboard focus | Tab order from the filter: Broaden → category link → `◎` → disclosure → leaf links. Each stop matches `:focus-visible` with a 2 px solid accent outline (screenshots inspected). | Intended |
| Article and state invariants | Across all 9 site walks and 4 fixture walks, every scope action leaves the URL including the hash (`#basic-usage` entry), `scrollY`, the article `h1` and the right TOC (link count and current item) unchanged. | Intended |
| Root shown once | No step in any walk renders a duplicate root (identity = label + href). The forest legitimately contains two `Skills` and two `Agents` roots (`/docs/claude-skills/…` vs `/docs/codex-skills/…`, `/docs/claude-agents/…` vs `/docs/codex-agents/…`); these are distinct sections. | Intended |
| Restore scroll | Restore scrolls only the sidebar viewport to the active row, so the toolbar can scroll out of view. The article does not move. #4500 allows sidebar-only scrolling. | Intended |
| **Deep nesting: `◎` over label text** | On the twelve-level fixture the `◎` box intersects category label text at levels 6–12 at 1024, 8–12 at 1280 and 9–12 in the 390 drawer. With `◎` hidden, label layout is identical, so the label runs underneath the control rather than reflowing. On the live showcase, which is shallow, the count is 0. | **Defect**, spec in #4507 |
| Deep nesting: label text past the sidebar edge | Text crosses the nav's right edge at levels 9–12 (desktop) and 11–12 (390 drawer) by the same amount with or without `◎`. The cause is the unchanged native `padLeft()` indentation, which is identical to `337b9f1`. | **Needs human taste call**: native indentation limit, not a 06R regression |

Screenshots: `assets/closeout-visual/` contains toolbar-row crops, scope walks, keyboard focus, the twelve-level ladder and the deep overlap pair. In the deep overlap pair the left side has `◎` hidden and the right side shows current.

## Defect repro (for #4507)

```sh
pnpm ensure:workspace-build && E2E_FIXTURES=sidebar bash e2e/setup-fixtures.sh   # via heavy-guard
node scripts/zfb3-parity/sidebar-decompose.mjs scope --dist e2e/fixtures/sidebar/dist --fixture sidebar --output <cclogs dir>
# scope-sidebar.json: steps[].focusOverlapRows must be [] for fixture-deep-{1024,1280,390-drawer} and fixture-ladder-*
```

Current values: `fixture-deep-1024` reports 7 overlapping rows, `fixture-deep-1280` 5 and `fixture-deep-390-drawer` 4. The ladders grow from 0 to 7 rows at 1024 and from 0 to 4 at 390. The site walks report 0.

## Tooling added

`scripts/zfb3-parity/sidebar-decompose.mjs` has three modes. `measure` records toolbar box, hint row, filter→tree offset, per-row heights and wrapped-line counts, tree area, footer, scroll extents, `◎` overlap and text past the nav edge. `compare` attributes Δ to toolbar, rows, wrapping and residual. `scope` runs the 06R walks and invariants. Output must be outside the repository.

## #4507 fix: `◎` no longer covers deep category labels; 60 parity states unchanged

**Source:** `95e1d5048` on `zfb3-closeout/4507-visual-fix` (base `6e92e70da`). All builds and browser runs went through `heavy-guard.sh` and passed.

**Change.** In `CategoryNode` the non-linked row button lost `min-w-0`, so it keeps its min-content width (indent + chevron + longest word). The row is now `flex-wrap`, and `◎` carries `ml-auto`. When the label and `◎` fit on one line nothing changes. When they do not, `◎` drops to its own line at the row's right edge instead of painting over the label. Indentation, connectors, label wrapping, the accessible name, the 28×38 px target and scope behaviour are unchanged. The linked row already kept its link at min-content (no `min-w-0`), so it never overlapped and was left as is.

**Fixture re-measurement** (`sidebar-decompose.mjs scope --dist e2e/fixtures/sidebar/dist --fixture sidebar`, per-step row counts):

| Walk | `focusOverlapRows` before | after | `beyondNavRows` before = after |
| --- | --- | --- | --- |
| `fixture-deep-1024` | 7,7,6,7 (levels 6–12) | 0,0,0,0 | 4,4,3,4 (levels 9–12) |
| `fixture-deep-1280` | 5,5,4,5 (levels 8–12) | 0,0,0,0 | 4,4,3,4 (levels 9–12) |
| `fixture-deep-390-drawer` | 4,4,3,4 (levels 9–12) | 0,0,0,0 | 2,2,1,2 (levels 11–12) |
| `fixture-ladder-1024` | 0 → 7 | 0 at every step | 0 → 4 |
| `fixture-ladder-390` | 0 → 4 | 0 at every step | 0 → 2 |
| `fixture-editorial-1280` | 0 | 0 | 0 |

No walk shows duplicate roots or page errors. Every `◎` measures 28×38 px at 1024, 1280 and 390. The out-of-scope text past the nav edge covers the same rows before and after: the label keeps its min-content width at the same `padLeft()` offset, so the overflow amount does not change.

**Parity states.** A guarded local `pnpm build` of the showcase, `measure` over the 60 states and `compare` against #4505's current-side measurement give Δ 0 in all 60 states. The toolbar stays at 46/73 px, residual is 0, and no showcase row overlaps `◎` or crosses the nav edge.

**Regression spec.** `e2e/sidebar-broader-tree.spec.ts` has the new test `twelve-level tree keeps branch focus clear of category labels at {1024,1280,390}px`. It asserts that no label text rect intersects any `◎`, that every `◎` stays inside the nav, and that Enter on level 12's `◎` focuses the branch without navigating. On the pre-fix build all three cases failed (level 6 at 1024, level 9 at 390). After the fix the whole spec file passes (15/15).

Crops: `assets/closeout-visual/deep-focus-fixed-1024-l6.png`, `deep-focus-fixed-1280-l12.png` (label past the edge is the unchanged out-of-scope case) and `deep-focus-fixed-390-l9.png`. Raw JSON and screenshots are in cclogs under `zudo-doc/closeout-4507/`.
