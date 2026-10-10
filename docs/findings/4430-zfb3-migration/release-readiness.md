# Release readiness — published zfb 4.3.0

> **Canonical copy:** `docs/findings/4430-zfb3-migration/release-readiness.md` is canonical from now on (relocated by #4508). The copy under `_temp-resource/4430-zfb3-migration/` is a frozen duplicate kept only until #4476 deletes that directory; edit this file, not the temporary one.

**Verdict: BLOCKED/PENDING. Do not merge PR4477, publish 6.0.0, or delete temporary resources until the closeout disposition task.**

Updated 2026-10-10 for the published 4.3.0 family. Permanent evidence: `docs/findings/4430-zfb3-migration/2026-10-10-zfb-4.3.0-resume.md` and `2026-10-10-closeout-dependencies.md`. The 4.2.0 checkpoint below is preserved as history.

- Published family: zfb/runtime/md-wasm/Cloudflare adapter all 4.3.0, exact pins and ^4.3.0 peer floor. Actual Linux native CLI 4.3.0, esbuild 0.25.12.
- Former blockers resolved: #4059, #4060 and #4109 are closed; the strict published #4097 consumer passes 3/3 (hosted run 38030809260 at head `fd0764f`). PR Checks 38030812860 passed 28/28 (475 E2E); generator slow 24/24; package slow/packed 133/133; built bookmarks 30 targets / 12 routes.
- A2: required gate and full slow gates pass. The historical byte diagnostic deliberately keeps its inequality (seven native build IDs plus the islands filename); assertions and normalizer are unchanged.
- zdtp stays at 0.8.5 (upgrade handled elsewhere); no floor change, no global dedupe.

### Remaining gates

- Visual 06R: 47 aggregate `nav`/`sidebarTree` height differences need paired-pixel classification (accept intended additions or fix regressions).
- Installed three-package browser acceptance (packed history-server, zudo-doc, create-zudo-doc; barebone and all-feature; outside the workspace).
- macOS Japanese IME / manual smoke (Takazudo/zudo-front-builder#3330); unavailable on this host.
- #4476 cleanup of `_temp-resource/4430-zfb3-migration/` after acceptance PASS.
- Final-head gates: exact-head required checks, review, and #4501 deferred-verification rows.

## History — published zfb 4.2.0 checkpoint (2026-10-08)

**Verdict: BLOCKED. Do not merge PR4477, publish 6.0.0, or delete temporary resources.**

This records the October8 continuation of #4430/#4467/#4475, not a completed release. Permanent evidence: `docs/findings/4430-zfb3-migration/v4.2-integration.md`.

- Published family: zfb/runtime/md-wasm/Cloudflare adapter all4.2.0, exact pins and ^4.2.0 peer floor. Actual Linux native CLI4.2.0, esbuild0.25.12.
- Original factory-discovery blocker cleared: full793-page build passes after fixed-target server-boundary migration. All six fixture hydration probes pass.
- b4push checkpoint passes33 automated steps; interactive manual smoke skipped. Worker17tests and dry-run pass. Final browser-fix rerun and exact-head CI are recorded in permanent findings/PR.
- Packed all-features/barebone build/hydrate/interact acceptance is **blocked**, not passed: published-native minimal controls reproduce upstream #4059 compiled/staged duplicate identity and #4060 nested unused-eject resolution. Package/generator slow failures retain their original assertions.
- Browser embed is **blocked** on upstream #4077 public standalone browser SSR/Island contract. Native scanner metadata is not fabricated.
- Entering-sidebar View Transition has a reviewed local helper fix (11focusedtests pass); final browser recheck is recorded on PR4477. Measured parity remains open. A2 hashes unchanged. Heading permalink affordance is a measured #4469 difference requiring explicit disposition; #4482/#4483 late intentional-fix acceptance remains independently tracked.
- Initial local full browser435pass19fail; affected smoke/i18n61pass and theme6pass after fixes. Local Mermaid CDN blocked on both baselines; matching CI tests individually pass. Aggregate cancelled CI is not a pass.
- Survivor scan over package.json, pnpm-lock.yaml, packages and src found no patchedDependencies or `workaround for …zudo-front-builder` matches. This lexical scan does not replace the remaining native-path/packed/parity gates or assert a universal no-shim audit.
- v2 baseline reconstructed from exact main337b9f110793dccb4759bddd5273eab38cd9d2f0; original sealed cache absent. Compact parity reports remain under parity/4.2; no oversized raw reports or Git LFS.

## Authorized release sequence after all gates pass

User explicitly authorizes normal repository `l-make-release` actions after merging this existing PR. Planned major6.0.0, lockstep history-server → zudo-doc → create-zudo-doc, npm and GitHub release destinations under the actual skill. Set history-server peer floor^6.0.0 and approvedBaseline as RELEASE.md requires, with B4PUSH_SKIP_PIN_PUBLISHED=1 for unpublished lockstep pins. Keep5.x frozen. Verify main/release CI and all npm publications, then report exact versions to upstream #3328 and unblock #3329. No release step has been executed.

## Resume

Continue the existing PR4477 on base/zfb3-migration; fetch and compare the remote head before editing. Read current PR/issue comments and permanent v4.2 findings, then check npm publication for all four packages. Re-run #4059/#4060 controls and the real packed all-features/barebone build/hydration/interactions; run package/generator slow suites with unchanged A2 snapshots. Resolve #4077 standalone browser composition and the entering-sidebar regression, recheck #4468/#4469 measured parity and #4482/#4483 final cases, then guarded b4push and exact-head CI. Use Node22/pnpm10.30.3 and the supported environment bootstrap; do not modify codex-settings or install replacement infrastructure to work around denial. Keep all failed/deferred evidence. Merge and perform the authorized6.0.0 release only after every gate passes.
