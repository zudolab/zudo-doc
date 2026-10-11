# Post-merge status and next zudo-doc 6 release handoff (2026-10-11)

This is the current-status record for the zfb 4 migration (#4430) after PR #4477 merged. It replaces the pre-merge leads of the [README](README.md) and [release readiness](release-readiness.md) as the live instruction. Dated findings in this directory are historical evidence: they keep their original SHAs, failures, skips, accepted differences and owner decisions, and are not rewritten. Source issue: [#4514](https://github.com/zudolab/zudo-doc/issues/4514).

## #4477 merged and deployed; coordinated 6.0.0 is unreleased

- [PR #4477](https://github.com/zudolab/zudo-doc/pull/4477) was regular-merged on 2026-10-11 03:06:19 JST (2026-10-10 18:06:19 UTC).
  - Merge commit on `main`: `b9dd43b0da81a3d426fee325736c2dc79d37fc1a`.
  - Final PR head: `68ad9623c312e8faec8524e5135d16ae56d52f8b`.
  - Both have the same Git tree, `dc27379e43b18f12a4133d8f84310e8a06780583`, so the merge introduced no untested source delta.
  - `base/zfb3-migration` and the old candidate SHAs (`d4185fb9e`, `79f60b78e`) are history. Do not reopen, re-merge or reuse #4477 or its base.
- The merge followed the [owner-reviewed merge checkpoint](https://github.com/zudolab/zudo-doc/pull/4477#issuecomment-6100575225). That checkpoint authorized the regular merge and its disclosed automatic Cloudflare Workers documentation deployment **only**. It did not authorize `_temp-resource` cleanup, a version bump, a release, npm publication, a future zfb upgrade, a manual production deployment, or blanket issue closure.
- [PR Checks 38072632998](https://github.com/zudolab/zudo-doc/actions/runs/38072632998) at the final head: 28 jobs succeeded, including the 480-test E2E run.
- [Migration Hosted Parity 38072630281](https://github.com/zudolab/zudo-doc/actions/runs/38072630281) at the final head:
  - The four required acceptance jobs succeeded.
  - Two historical comparison diagnostics stay **failed with explicitly accepted differences**: `Migration baseline/current browser measurement` and `Complete A2 baseline/current byte differences`. They are not passes, and bytes and pixels are not claimed identical. The causes are attributed in the owner checkpoint and in [R6 cloud CI attribution](r6-cloud-ci-attribution.md).
- [Production Deploy 38074440930](https://github.com/zudolab/zudo-doc/actions/runs/38074440930) on the merge SHA succeeded. All five jobs succeeded: Build Doc History, Build Site, Deploy to Cloudflare Workers, HTML validate and Deploy Notification. This is a workflow result. No new manual live-site or browser acceptance was run after the merge.

## Pins match npm `latest`: zfb family 4.3.1, zdtp 0.8.6, release packages 5.28.2 (2026-10-11 JST)

| Item | Repository | npm `latest` observed |
| --- | --- | --- |
| Root, `@takazudo/zudo-doc-history-server`, `@takazudo/zudo-doc`, `create-zudo-doc` | 5.28.2 | 5.28.2 (the three release packages) |
| `@takazudo/zfb`, `zfb-runtime`, `zfb-md-wasm`, `zfb-adapter-cloudflare` | exactly 4.3.1, peers `^4.3.1` | 4.3.1 ([upstream v4.3.1](https://github.com/Takazudo/zudo-front-builder/releases/tag/v4.3.1)) |
| `@takazudo/zdtp` | 0.8.6 | 0.8.6 |

Coordinated 6.0.0 is unreleased (npm `latest` 5.28.2). The audited release records show no completed 6.0.0 publication. Do not infer that consumers can install 6.0.0 just because the showcase is merged and deployed. Upstream [Takazudo/zudo-front-builder#4097](https://github.com/Takazudo/zudo-front-builder/issues/4097) closed on 2026-10-10 and is no longer a blocker.

The zfb family moved from 4.3.0 to the published 4.3.1 on 2026-10-11 through [PR #4516](https://github.com/zudolab/zudo-doc/pull/4516) (`deps/zfb-4.3.1`, final head `8dbbbcedb`), whose branch was merged into this documentation PR (#4515) so the two post-merge PRs land as one. Its evidence (published-byte verification, MD/WASM hashes, History-rejection smoke regressions, A2 attribution, installed barebone/all-feature consumers, exact-head PR Checks and Nightly Exam) is in [zfb 4.3.1 verification](../zfb-4.3.1/verification.md). A `@takazudo/*` registry bump dry run on the combined tree (2026-10-11) reported every live pin up-to-date; the only remaining "bump" rows were historical fixture manifests under evidence directories, which are kept as-is, and the history-server peer floor `^5.17.2`, which moves only in the 6.0.0 release commit.

## Manual IME evidence keeps its limits; the Apple IME gate is owner-waived

The extra macOS IME gate in [closeout manual](2026-10-10-closeout-manual.md) was waived by the owner for the accepted merge. It is not a release PASS. Sources: the [prior owner record](https://github.com/zudolab/zudo-doc/pull/4477#issuecomment-6100228862) and the [merge checkpoint](https://github.com/zudolab/zudo-doc/pull/4477#issuecomment-6100575225).

| Item | Status |
| --- | --- |
| A1 search, real human ATOK input (ATOK 35.0.3) | PASS on `7070a396`; focused retest on `79f60b78`. Earlier observations keep their original SHA. The whole sequence is not claimed repeated on the latest head. |
| A2 AI chat Enter rule, ATOK | PASS. The conversion-confirming Enter sends 0 requests; the next Enter sends exactly 1, on both the full run and the focused retest. Cancel/recompose was confirmed on `7070a396` only. |
| A3 value/model/focus/caret | PARTIAL / UNVERIFIED. Human focus/caret checks passed with no console errors. Post-composition DOM-value/model agreement is not fully verified, and the retained post-human A3 model snapshot is unavailable. Automated ordinary-input checks do not reconstruct that state. |
| Apple built-in Japanese IME | NOT RUN / OWNER WAIVED. Apple IME behavior is not claimed PASS. A problem found later is fixed when found. |
| A5 upstream packed-SDK fixture ([zudo-front-builder#3330](https://github.com/Takazudo/zudo-front-builder/issues/3330)) | NOT RUN. No upstream SHA or packed-SDK acceptance is claimed. |

None of these becomes a PASS through this record.

## Required-check name mismatch: `Package Safelist Check` vs `Package Wind Manifest Check`

- The workflow (`.github/workflows/pr-checks.yml`) and `.required-checks-manifest` name the job `Package Wind Manifest Check`. That check passed on the final head `68ad9623`. No check named `Package Safelist Check` was emitted on that head.
- The sweep's observation (2026-10-11 JST, issue #4514): the read-only `branches/main` summary still listed `Package Safelist Check`. The dedicated `branches/main/protection` endpoint returned `403 Resource not accessible by integration`.
- A later owner-authenticated read (2026-10-11 JST) of `GET repos/zudolab/zudo-doc/branches/main/protection` returned:
  - `required_status_checks.strict`: `false`.
  - The required contexts still include `Package Safelist Check` (app_id 15368) and do not include `Package Wind Manifest Check`.
  - `enforce_admins.enabled`: `false`.
  - The repository rulesets on `main` contain only `deletion` and `non_fast_forward`.
- Observation limits: this read shows the configured settings at that time. It does not show how #4477's merge satisfied or bypassed the stale context. Do not infer a bypass, or a blocked merge, from `enforce_admins=false`.
- Follow-up for the next PR or release owner: before attempting a merge, inspect the effective protection. Reconcile the stale required context only through an explicitly authorized settings action. Do not rename the passing CI job to match. This does not block independent documentation work.
- **Resolved 2026-10-11 JST (owner-directed merge/release run).** `PATCH repos/zudolab/zudo-doc/branches/main/protection/required_status_checks` replaced the contexts with the 26 names in `.required-checks-manifest` (`strict` stays `false`). Net change: `Package Safelist Check` removed; `Chrome Bindings Fixture Drift Check`, `Theme A11y Audit`, `Package Wind Manifest Check` and `Bash 3.2 Compatibility Lint` added. No other protection field or ruleset was touched. PR #4515 went from `BLOCKED` to `CLEAN` without any new check run.

## Next release: zfb 4.3.1 is adopted and verified; the 6.0.0 release itself remains

These are recorded next actions. Steps 1–3 were completed on 2026-10-11 by #4516 (combined into #4515). Steps 4–6 remain and run under the owner's release direction.

1. **Select the next published zfb target. Done: 4.3.1.** Upstream [v4.3.1](https://github.com/Takazudo/zudo-front-builder/releases/tag/v4.3.1) published on 2026-10-11 and the four npm `latest` tags resolve to it. The pins are not stale.
2. **Adopt that exact tuple in a separate bounded update. Done in #4516.** Root, package and scaffold pins moved together to exactly 4.3.1 with `^4.3.1` peers; zdtp stays 0.8.6; the history-server peer floor is unchanged until the major release commit.
3. **Verify the resulting candidate. Done in #4516.** Exact-head PR Checks (28 jobs) and the expanded Nightly Exam (482 E2E, slow lanes, scaffold published guard, a11y) succeeded; installed barebone (12/12) and all-feature (19/19) consumers passed browser checks; the three strict A2 fingerprints changed only through the native `data-zfb-build` identity. Limits: Linux Chromium evidence, no native macOS WebKit; operator-driven manual smoke omitted; the IME table above is unchanged. Details: [zfb 4.3.1 verification](../zfb-4.3.1/verification.md).
4. **Prepare and deliver coordinated 6.0.0 through the existing #4512 / #4502 / #4430.** Follow `RELEASE.md` (normally via `l-make-release`):
   - After #4518 merges, the release commit (`l-make-release major`: versions, scaffold pins, history-server peer floor and `approvedBaseline` to `^6.0.0`, six EN/JA notes, changelogs) is the only remaining pre-publication step.
   - #3328 pre-publication report URL (manager fills after posting): COMMENT_URL. The report and final matrix land on `main` via [PR #4521](https://github.com/zudolab/zudo-doc/pull/4521).
   - Publish in the order history-server → zudo-doc → create-zudo-doc, with synchronized release versions.
   - Write six EN/JA package notes, plus the generated changelogs and redirects.
   - Update the history-server peer floor and the `approvedBaseline` in `check-pin-parity.mjs` together to `^6.0.0`.
   - Use `B4PUSH_SKIP_PIN_PUBLISHED=1` only for the unpublished lockstep-pin window.
   - Run the publication checks and the installed-consumer checks.
   - Re-read the runbook when executing; this outline does not replace its staged bootstrap.
   - Deleting `_temp-resource/4430-zfb3-migration/` is owned by #4476 and runs only inside #4512's gated completion. The lasting evidence was already relocated by #4508. Done on 2026-10-11 in this epic's PR (#4518); the lasting summaries were copied first.
5. **Finish the bookkeeping at the matching delivery boundary.** Report the published versions and validation results on [ZFB #3328](https://github.com/Takazudo/zudo-front-builder/issues/3328) and add the "Dogfood results" section to the #4430 body, as #4512 requires. Reconcile the implemented migration children one by one. Close their parents only when each parent's own remaining scope is complete. #4501 explicitly closes through #4512. Do not bulk-close protected trackers.
6. **Downstream adoption follows actual publication.** [ZFB #3329](https://github.com/Takazudo/zudo-front-builder/issues/3329) owns the docs-host migration, and [ZFB #4099](https://github.com/Takazudo/zudo-front-builder/issues/4099) owns the later 06R host adoption. Both keep their published-compatible-release prerequisites.

## Existing issues keep their owners; no new hierarchy

| Issues | Disposition |
| --- | --- |
| #4428, #4478, #4500 | Fixed on `main` by #4477. Their closures are evidence-backed and are not an npm-release claim. |
| #4484 | Deliberately open canonical agent-docs specification. Implementation children rely on it; do not recreate it, or close it as a generic duplicate. |
| #4485 | Protected agent-docs epic. Its remaining acceptance is one real ChatGPT account connection: discover search/fetch, search in EN and JA, fetch a returned ID, and confirm a cited human documentation URL. This is not a migration or release gate. |
| #4501 | All four verification rows are satisfied. The issue stays open and closes through #4512's completion order. |
| #4476 | Epic #4518 / PR #4521 preserves the lasting summaries, deletes the migration temp resources, finalizes the matrix and prepares the #3328 pre-publication report; pending merge. The #3328 published-versions follow-up and #4430 “Dogfood results” section remain with the release step. |
| #4475 | Epic #4518 / PR #4521 records visual and installed-consumer acceptance plus current-documentation cleanup. Readiness/cleanup stays pending merge; human/platform limits stay explicit; final integration/release preparation remains with the release step. |
| #4430; #4467–#4474; #4482–#4483; #4502; #4512 | Existing migration epic and sub-issue coordination. Many implementation clauses are on `main`, but the release and evidence bookkeeping must be reconciled against each full body. #4512's SKIP line was removed under the owner-approved merge gate; its release and cleanup work stays separately gated. |
