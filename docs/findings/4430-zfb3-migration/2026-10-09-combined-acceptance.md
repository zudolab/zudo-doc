# Combined migration and 06R acceptance — 2026-10-09

Status: **BLOCKED; not merged or released.** The user explicitly authorized
accepted #4500 in this same #4477 migration PR and a conditional coordinated
6.0.0 release. This supersedes the earlier separate-main/no-merge handoff.
The remaining acceptance conditions are unchanged.

## Source and ownership

One Cloud integration owner resumed `base/zfb3-migration` from
`f1c3d727bb7a0bb53e286935d803091b22be0eb6`. Main remains the reconstructed
baseline `337b9f110793dccb4759bddd5273eab38cd9d2f0`. Isolated workers owned
coupled sidebar implementation, gates, bilingual examples, migration guidance,
focused packed QA and independent review. Completed work was merged into the
existing PR; no competing feature branch or direct main push was used.

Product source `ffe8e4b129904b1f6fa54c869f652cc71c10c7b3` contains all accepted
implementation corrections. `8e70ab58222296bc1d2e241e18438bab5651d530` additionally
reconciles the same-tree retained-filter test and reviewed external A2 hashes.
Independent final source review passes at that head. It found and resolved five
P2 issues: empty-root slug handling, authored dated-tray collapse restoration,
external-reference CI triggering, complete A2 assertion selection, and an extra
no-op broadening step at a sole canonical root. Review is not runtime acceptance.

## Included work

All four zfb family packages remain deliberately pinned to published **4.2.1**:
zfb, zfb-runtime, zfb-md-wasm and zfb-adapter-cloudflare. Fresh registry evidence
at 2026-10-09 16:44 UTC confirms these latest stable versions. The installed
binary reports 4.2.1 with embedded esbuild 0.25.12. zdtp 0.8.5 retains its isolated
Preact dependency; no owned Preact runtime import or patched upstream dependency
was introduced. Internal candidate tarballs remain version 5.28.2 pending the
actual release workflow; packing them is not publication.

06R adds provenance/occurrence identities before clipping/filtering, additive
explicit authored context, one-real-editorial-level broadening, truthful terminal
state, exact configured-forest Restore and separate branch focus. It preserves
native dashed recursive rendering, authored order, duplicate entries, categories
without pages, unlimited nesting, current-page styling, links/disclosures,
resizing, themes, desktop/mobile behavior, same-tree scope/filter retention and
locale/version context isolation. Twelve-level, custom-forest and browser history
fixtures cover the accepted contracts. EN/JA labels/sidebar guides and applicable
public/template/config surfaces are updated. No 09R/10R or prototype redesign.

Gate work adds actual native Wind error enforcement, current public compatibility
rules, measured stronger CSS size/media floors and exact native output controls.
A2 references live outside the linked package source digest; CI watches them and
runs the complete semantic/transport/fingerprint suite. The unchanged normalizer
and assertion scope remain intact. See [gate evidence](v4.2.1-gates.md).

Bilingual examples and migration guides use actual published exports and native
SSR/hydration semantics. Existing agent-export/MCP, native heading/search,
locale/version and public package contracts remain part of acceptance.

## Reproducible environment and evidence

Node 24.19.0; pinned pnpm 10.30.3. All heavy local suites use the shared heavy
queue; browser runs additionally use the browser guard. Local browser evidence
uses system Chromium 151.0.7922.173 because the supported Playwright browser
download returned HTTP403. Hosted CI uses its configured pinned browser.
No downloaded binary workaround or infrastructure change was made.

Managed startup loaded and consumed the full installed personal snapshot once.
The workspace AGENTS bridge was delivered and restored through the supported
step; this does not prove independent saved-field/native catalog delivery.
The optional Library reference ZIP could not be materialized through the
supported consumer-local transfer and bounded retry. The handoff text and full
issue #4500 supplied reconstructible requirements. No prototype screenshot
comparison is claimed.

Evidence root: `/tmp/zudo-resume-20261009` on this executor. Important logs:
`v2-parity-build.log`, `f1-parity-build.log`, `final-parity-build.log`,
`integrated-b4push.log`, `final-full-e2e.log`, `final-generator-slow.log`,
`final-package-slow.log`, `upstream4097-rerun.log` and `independent-review.md`.
Large screenshots/builds stay local, outside Git; Git LFS is not used.

## Validation ledger

| Check | Recorded outcome |
| --- | --- |
| Exact main build | PASS, 789 pages |
| Initial unchanged migration build | PASS, 793 pages |
| Final integrated site build | PASS, 795 pages, 122.62 seconds |
| Workspace/package/generator builds and final root types | PASS |
| Focused integrated native browser run | PASS, 25 tests, no skips/retries |
| Full local six-fixture E2E | 465 PASS / 10 FAIL; not passing overall |
| Hosted E2E at ffe8e4b | 474 PASS / 1 FAIL; obsolete filter-reset assertion corrected afterward |
| Hosted PR jobs at ffe8e4b | 26 PASS / 2 FAIL (E2E old assertion, A2 old fingerprints) |
| Full generator slow suite | PASS, all seven suites / 24 tests |
| Full package slow suite | PASS, all four suites / 133 tests, 296.22 seconds |
| Exact-head CI at 8e70ab58 | PASS, all28 jobs in run37962422644, including A2 and475 E2E cases |
| Final isolated triple tarballs | Pack PASS; hashes/metadata/exports verified; installed-consumer stages blocked below |
| Upstream native pending-visible repro | 2 PASS / 1 FAIL; blocking |

Hosted ffe8e4b successes include root/package tests, all types, prepack, all drift
and compatibility gates, complete theme-a11y matrix, strict site links/images,
HTML validation, Worker contract and preview deployment. Final-head reruns remain
necessary after the documentation-anchor repair. The corrected retained-filter assertion follows accepted #4500's
same-scope navigation requirement and preserves document/aside/tree identity,
input replacement, URL/current link, expansion and View Transition assertions;
it adds clearing/reapplying the retained query.

The full local b4push was not a pass: unchanged registry fetch initially failed
without Node's supported proxy setting (same gate passed with NODE_USE_ENV_PROXY=1),
a shared guard type needed correction (fixed and final types pass), and four
run-parallel unit tests exposed the Cloud PID1 zombie reaping behavior. Baseline
and candidate use byte-identical affected CLI/tests and fail identically locally;
hosted package tests pass. Existing root skips and non-TTY manual-smoke skip are
not counted as passed. No process assertion or security gate was weakened.

All nine other local browser failures concern Mermaid's esm.sh import blocked by
ERR_TUNNEL_CONNECTION_FAILED; the corresponding hosted cases pass. Both local
baseline and candidate omit the required Mermaid capture state and retain errors.
See [deferred-verification #4501](https://github.com/zudolab/zudo-doc/issues/4501).

## Blocking upstream and release gates

[Upstream #4097](https://github.com/Takazudo/zudo-front-builder/issues/4097)
still reproduces on latest published 4.2.1 using only public native APIs in an
isolated registry install. A never-activated visible child under a persisted
island activates before entering the viewport after changed props. The fresh
run has two passing direct/non-persisted controls and one failing persisted
control (child top 2097.875, viewport720, scroll0, activation expected0/actual1,
same document/timeOrigin, one document request, no browser errors). Evidence was
posted in upstream comment6084679682. Earlier #4059/#4060 are closed; this separate
repro remains unresolved. No upstream implementation or consumer workaround.

Automatic approval review rejected final packed-consumer preparation through
`$HOME/.codex/scripts/heavy-guard.sh`, citing a TPP CCA executor restriction on
executing `/root/.codex/scripts/heavy-guard.sh`. Earlier manager guard launches
were approved; this later denial was not bypassed. A permission request to retry
the exact guarded local command remains pending. Triple tarball audit alone does
not prove fresh installed consumers. Previously approved suites continue.

Actual macOS IME/manual smoke and other unavailable platform evidence remain
unverified. Complete final parity/packed acceptance, exact-head required checks,
independent review and base reconciliation are mandatory. Preserve temporary
repro sources under #4476 until #4475 passes.

There is no actual merge SHA, post-merge workflow result or new publication.
`/l-make-release` was read: it requires clean main and coordinated history-server,
zudo-doc and create-zudo-doc release steps. The authorized 6.0.0 release must wait
for these prerequisites; no release or version bump was attempted.

## Final native screenshot and static disposition

The final built-site browser capture has64 states, with the Mermaid-enlargement
state unavailable through the same proxy failure as the baseline. Raw comparison
against v2 and f1 each reports46 differences, all navigation/sidebarTree height
only; no other measured property differs. The new toolbar/wrapping and inserted
migration guide account for the bounded changed area. Exact per-element height
attribution remains unmeasured; the raw comparator remains FAIL. Final desktop
light and mobile dark Getting Started pixels were inspected directly. These are
native baseline/final screenshots, not a comparison to the unavailable prototype.

A separate16-state editorial scope screenshot harness failed before producing
images: it incorrectly waited for the native display-contents island wrapper to
be visible. Its readiness selector was repaired to wait for attachment, with the
actual visible toolbar checked afterward. Syntax passes; rerun requires the
already-requested guard permission. This is a harness failure, not evidence of a
product failure. The12 actual scope interaction cases passed in full E2E.

[Full static reconciliation](2026-10-09-static-reconciliation.md) preserves all
2366 initial raw failures and their causal categories. Final localization proves
701/791 shared HTML files differ only within SidebarToggle/SidebarTree, existing
asset-hash substitutions and the exact observed native build-ID change. Other
changes map to authored docs, generated handbooks and dependent category/pager
pages. Final CSS adds exactly five control-state selectors (+488bytes), changing
no existing declaration. The audit found30 removed old heading targets on12
routes; commit `1373b8c801641e4025d2888ab7caa458a23b2a47` restores all30 targets with26 source aliases across10 files. Exact census, duplicate checks, resource-transform preservation, native intrinsic rendering and all eight MDX parser checks pass. Full rebuilt-route verification remains required; no generated output was patched.
