# Exact local v2 → f1 static parity reconciliation

Read-only diagnosis of `/tmp/zudo-resume-20261009/f1-v2-static.json`, comparing reconstructed exact v2 source `337b9f110793dccb4759bddd5273eab38cd9d2f0` at `/workspace/zudo-doc/worktrees/cloud-v2-baseline/dist` with the unchanged `/tmp/zudo-resume-20261009/f1-dist`. This is the f1 artifact, not final source `ffe8` or its pending build. Raw comparator remains **FAIL: 2,366 hard, zero advisory**. No assertions, fingerprints, source files, or output bytes were edited.

The count is 787 shared routes × three failed inventories (islands, DOM, classes), plus one route-list and four CSS inventory failures. It is not 2,366 independently demonstrated behavioral regressions. Conversely, the comparator records only the first 20 DOM paths per route; those rows cannot establish complete semantic parity.

## Concrete causes and measured bounds

| Layer | Exact finding | Causal disposition |
| --- | --- | --- |
| Routes (1) | Only four added routes: EN/JA `guides/agent-export` and `guides/mcp-server`; no removed routes. | Authorized feature content. Preserve its actual layout effect. |
| Islands (787) | Every ordered `(name, skipSsr)` sequence and count is preserved. Ten DocHistory paths shift after inserted text in five EN/JA documentation pairs. | No lost island identity found; DOM location shifts follow content, not missing mounts. Hydration remains a runtime check. |
| Island props | No-prop `null`→`{}` on ClientRouterBootstrap/ImageEnlarge/MermaidEnlarge (787 each), DesignTokenPanelBootstrap (740), DesktopSidebarToggle (732), DesktopTocToggle (622), ConfiguredDesignTokenPanelBootstrap (47), PresetGenerator (2). Other field changes: SidebarToggle/SidebarTree `nodes` (82 each), SiteTreeNav `tree` (4), Toc/MobileToc `headings` (10 each). All counts match the archived analysis exactly. | Separate transport representation from real added navigation/headings. Count equality alone does not prove value equality; raw props remain in the input report. |
| DOM (787) | Head alternate `/llms.txt` and per-document Markdown links shift stylesheet/module positions. Body inline scripts change on all routes. Native build/protocol/transport metadata and structural comments remain in the emitted bytes. | Added head exports and required owned-runtime representation. Do not strip them to obtain hash equality. Fresh A2 causal measurements are the narrow exhaustive three-page evidence, not an all-site exemption. |
| Classes (787) | Full token inventory retained in JSON: underscore-spaced `calc`, `zd-*` helpers replacing unsupported descendant forms, native `hash-link`, removed marker/inert classes, inherited active-icon ink, and scoped timing/weight repairs. | Tokens require authored or measured explanations. Matching HTML prose alone cannot establish cascade/visual parity. |
| CSS (4) | 226 added/344 removed selector inventory entries; 114/48 custom properties; 3/4 media entries; 4/4 layers. | Native utility/reset/token emission replaces Tailwind internals. Inventory is lexical, not a cascade verdict. |

Fresh independent parsing reads **all 787 shared raw HTML files**, preserving all changed body spans. It finds **687 identical body element/text/entity event sequences, 100 changed routes, 102 distinct changed patterns**. Every one of the 102 before/after event patterns is exactly equal to an archived `static-analysis-all-body.json` pattern; zero newly unclassified body patterns. Only the two old preset fallback heading patterns disappear: the repaired EN/JA fallback now preserves v2. Body scripts, styles, attributes, and comments are separate channels, not silently treated as equivalent. There are zero changed inline-style-content routes; comments total 0→3,799,204, explicitly retained as diagnostic evidence rather than suppressed.

| Distinct body patterns | Exact archived cause |
| ---: | --- |
| 21 | Authorized export/MCP entries in sidebar/category/home navigation. |
| 4 | DocPager Previous/Next neighbors change when those guides are inserted. |
| 66 | Six EN/JA authored documentation pairs, TOCs, and git-derived update labels (configuration, llms-txt, search, create-zudo-doc, design-token-panel, host-chrome-bindings). |
| 1 | Generated create-zudo-doc CLAUDE handbook reflects authored migration wording. |
| 8 | Mermaid `>` versus `&gt;` serialization; complete decoded text remains identical. This does not prove diagram rendering/enlargement. |
| 2 | SiteTreeNav rotation-owner span wrappers around unchanged SVGs. Prior archived intermediate-motion probes establish bounded 150ms/ease, orientation/color/bounds equivalence; no blanket wrapper acceptance. |

Fresh anchors census exactly reproduces the archive: zero changed unresolved same-document fragment sets; ten pages gain IDs, none lose IDs; no new `_blank` links missing `noopener noreferrer`. This does not cover cross-route/runtime links.

## Differences from the historical pre-repair analysis

Custom-property, media, and layer deltas are exactly the archived delta. Selector changes since archived source `2926b1da` are only added `.duration-0`, removed formerly-inert `.ease-in-out`, and the repaired heading-hover selector replacing the prior `::after`/heading-hover presentation. Actual f1 CSS emits `.duration-0 { transition-duration: 0ms; }` and retains `@media (prefers-reduced-motion: reduce)`; losing the compact whitespace spelling in the inventory is not losing that block. `:where(li::marker)`→`:where()` remains the archived invalid-selector finding: both reject in Chromium, not authorization to activate a new marker rule.

Class-count changes since that archive are concentrated in 17,819 explicit `duration-0` additions, 1,370 `ease-in-out` removals, 70 additional font-medium→font-semibold details terms, and disappearance of two preset-fallback heading changes. These trace to the scoped measured repairs in `v4.2.1-css-repairs.md` and `v4.2.1-preset-fallback.md`; they are not broad token normalization.

Four distinct inline-script pairs each occur on all 787 routes (tabs appears at index 7 or 8 depending on page). Their full diffs are saved:

- Search: existing excerpt decoration helper, plus new one-time placeholder snapshot after shortcut-label population and case-insensitive macOS detection. These additional behavioral changes trace to commits `05c35801` and `dab099db`, with explicit intentional-fix disposition and negative/positive tests in `round2-search-kbd.md`. They are not serializer noise. That finding records 12/12 manager browser passes at its own source/spec, not final integrated acceptance.
- Language/version switchers: emitted local identifier renaming; control flow and expressions in the saved diffs remain unchanged.
- Tabs: only `duration-0` added to BASE_BTN, consistent with measured zero-duration preservation in both SSR and runtime class constants.

## Meaningful remaining acceptance work

The f1 browser comparison independently retains **four differences**, all Guides navigation/sidebar height +76px in light/dark at 375/1280 widths. All other supplied computed fields match. Actual node evidence adds only the two guide items, without removals; this supports feature-content causality, but requires explicit feature/layout disposition rather than hiding height or calling strict parity PASS.

Local Mermaid enlargement is missing because the baseline external module request fails with `ERR_TUNNEL_CONNECTION_FAILED`; it remains unverified locally. Historical hosted 65-state evidence at `eaa9dd5d` includes Mermaid with the same four height differences, but cannot attest final code. Earlier reset/timing/chevron controls have exact source/browser bounds and retained raw differences; they do not prove every token, breakpoint, reduced-motion state, keyboard branch, or full-site visual rendering. Human macOS IME and released upstream #4097 are separate remaining gates.

No newly unexplained **body-event** regression appears in this f1 census. This is deliberately narrower than full attribute, accessibility, styling, hydration, or artifact acceptance. The 20-path DOM cap plus body-event analysis does not exhaustively classify every attribute on every page. Final `ffe8` adds 06R sidebar behavior and further documentation beyond f1; its rebuilt static/browser/runtime checks and any remaining meaningful differences must be reconciled independently. This report grants no blanket structural/hash acceptance and leaves the original strict result unchanged.

## Reproduction and retained evidence

Run `python3 /tmp/zudo-resume-20261009/static-parity-body-analysis.py`, then `python3 /tmp/zudo-resume-20261009/static-parity-anchors.py`, then executable `static-parity-reconcile.py`. These read original artifacts and write diagnostics only under `/tmp`.

- `static-parity-reconciliation.json`: full layer/property/class inventories, exact archived pattern matching, head/body/script limitations, and complete inline script diffs.
- `static-parity-body/all-body-raw.json`: all route records and every exact before/after body span, separate script/style/comment inventories.
- `static-parity-anchors.json`: all fresh ID additions and fragment/security census.
- Historical sources: `_temp-resource/4430-zfb3-migration/parity/4.2.1/static-analysis*.json`; durable causes: `docs/findings/4430-zfb3-migration/{v4.2.1-parity,v4.2.1-css-repairs,v4.2.1-preset-fallback,v4.2.1-gates,round2-search-kbd}.md`.

Foreground self-review complete: verified all 102 exact pattern payloads (not just keys), kept scripts/attributes/comments explicitly separate, confirmed freshly measured selectors/reduced-motion spelling, and retained every raw failure and source-bound limitation. Repository worktree remains clean; no heavy runs performed.

## Final built artifact extension: source ffe8

Read-only comparison now includes `/workspace/zudo-doc/dist`, built at `ffe8e4b129904b1f6fa54c869f652cc71c10c7b3` (manager reports 795 pages). Later source `8e70ab58` changes only tests/external references/findings, without changing the package digest. This extension does not silently transfer f1's strict static result to final output.

Final versus f1 has **791 shared HTML files**, two added files (EN/JA `guides/migrating-to-zudo-doc-6`), and no removed files. Full body census retains 744 changed event sequences, 47 unchanged, and 591 distinct spans. All body inline scripts and inline-style contents are exactly unchanged. Unlike the v2→f1 archive match, these new spans include intentional 06R tree structure and authored documentation; they must not be called serializer-only differences. The diagnostic SequenceMatcher uses its default alignment heuristic for this large structural comparison, preserves every non-equal span, and does not supply any gate verdict.

An independent exact-byte localization removes only the explicit SidebarToggle/SidebarTree source ranges from each input, applies the **existing three asset-filename substitutions**, and substitutes only the observed exact metadata identity `5e74ee14a7b99a0f`→`aea974781513fd80` (site builds, distinct from A2 fixture identities). It proves **701/791 files have no remaining changed bytes outside those sidebar subtrees**. The remaining 90 files are:

- 58 authored source pages: the 56 bilingual migration-reference edits plus two sidebar-guide edits.
- 22 generated pages: EN/JA copies of four CLAUDE handbooks and seven skills, reflecting their updated repository sources.
- Ten dependent pages: EN/JA home, components index, guides index, guides/layout-demos, and guides/mcp-server. Category/home inventories reflect updated descriptions/new guide; pager neighbors reflect the inserted migration guide.

These exact locations are preserved in `static-parity-final-localization.json`; they are evidence of bounded locality, not permission to discard the subtrees. Changed transported prop names are SidebarToggle/SidebarTree on 742 files each, Toc/MobileToc on 20 each, and SiteTreeNav on four. Other transported prop names are unchanged.

### Navigation topology and actual Guides addition

Actual final Guides local nodes go **43→44**. Only `guides/migrating-to-zudo-doc-6` is added (label “Migrating to zudo-doc 6”, position80, rank38, actual route href); no old slug is removed. Existing nodes gain occurrence IDs and one existing rank shifts with insertion. EN/JA Getting Started remain **7→7**, no added/removed nodes, with occurrence IDs the only existing-node field change.

For Guides and EN/JA Getting Started, independently traversing the actual serialized canonical snapshot establishes 376 canonical nodes in 19 roots, no duplicate occurrence IDs, and a parent map exactly matching tree edges. Every local node is byte-structure equal to its corresponding canonical node. **Canonical `navigation.roots` deliberately differs from the local `nodes` subset**: it supplies the broader tree while the initial section view remains local. It would be incorrect to claim their equality here from the two-node A2 fixture. Parentage/snapshot integrity is measured on these three actual pages; broader navigation/focus/filter/terminal-root behavior requires the separate 06R runtime controls.

### Final CSS and measured geometry

Final stylesheet is **230,982 bytes**, SHA256 `516cc02a01fb1c186fa764176996e80d7f401479c777a0241abb3317ee4b77d9`. Against f1's230,494bytes, the exact diff is +488bytes, **five added selectors only**: `hover:bg-bg/10`, `focus-visible:text-fg`, `focus-visible:bg-bg/10`, `focus-visible:bg-surface`, and `disabled:text-muted`. No existing CSS declaration changes. These are the new branch/scope-control hover/focus/disabled styles, not a token or reset rewrite. Full diff: `static-parity-final-css.diff`.

Manager's fresh 64-state reports `final-f1-browser.json` and `final-v2-browser.json` each retain **46 raw differences, all exclusively nav/sidebarTree height**; independent field comparison confirms no other supplied computed property differs. Against f1, 37 rows gain46px, five gain approximately73px (four Japanese Getting Started rows plus English1024 breakpoint), and four Guides rows gain108px. Against v2 the same Guides rows gain184px, incorporating f1's previous76px feature additions. The new scope toolbar and wrapping explain the general added space; the longer new migration-guide row contributes additional Guides height. **Exact 46+62px attribution of Guides'108px is a causal candidate until toolbar and new-row boxes are directly measured**, not established solely by subtracting totals. All raw geometry differences stay FAIL and need explicit 06R/content-layout disposition. No height override or comparator exclusion is proposed.

Local Mermaid remains missing/unverified. Final 16-state scope capture and full browser/runtime checks are manager-owned and pending in this report. No all-site attribute/accessibility or screenshot-pixel equivalence is claimed; no new broad normalizer was introduced.

Final supporting artifacts: `static-parity-final-body-analysis.py` and `static-parity-final-body/all-body-raw.json`, `static-parity-final-localization.{py,json}`, `static-parity-final-guide-nodes.{py,json}`, `static-parity-final-topology.json`, and `static-parity-final-css.diff`. All are diagnostics under `/tmp`; repository worktree remains clean.

### Concrete final backward-anchor compatibility finding

Fresh final-versus-f1 anchors census still has zero changed unresolved same-document fragment sets and zero new unsafe `_blank` links. However **20 pages change IDs; 12 pages remove 30 old heading IDs and add 42 new IDs overall**. Eight affected authored routes are EN/JA guides/custom-components, guides/development-workflow, reference/component-first, and reference/design-system (22 removed IDs). Four generated routes are EN/JA claude-md/packages--zudo-doc and claude-skills/zudo-doc-design-system (eight removed IDs, mirrored from updated source handbooks). These are concrete removed public targets even though current internal links pass. Old external or cross-route backlinks are not established safe. Preserve alias targets where appropriate; manager has the exact route/ID inventory for the docs owner.

Exact list: `static-parity-final-removed-ids.md`; complete positive/negative census: `static-parity-final-anchors.{py,json}`. This finding supersedes any implication that final inherits f1's no-ID-removal property. No output/source edit or alias implementation was performed by this read-only worker.

### Source repair after the census

Commit `1373b8c801641e4025d2888ab7caa458a23b2a47` restores all30 removed
targets with26 intrinsic span aliases in10 authored files (the two handbook
sources each feed both locales). Accurate new headings and all other content
remain byte-identical after removing the added aliases. The source census,
duplicate checks, existing resource transform, published4.2.1 intrinsic HTML
render and all eight MDX parser checks pass. No generator output was patched.
Full rebuilt-route/browser verification is still required; this source repair
does not retroactively alter the retained pre-repair artifacts or raw verdicts.
