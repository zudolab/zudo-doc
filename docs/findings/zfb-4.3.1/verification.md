# ZFB 4.3.1 consumer upgrade

Base: `b9dd43b0da81a3d426fee325736c2dc79d37fc1a` (merged PR #4477).
This bounded dependency PR is separate from the docs-only PR #4515; its release handoff remains owned there. No zudo-doc version, release, publication, merge or production deployment is authorized here.

## Published 4.3.1 bytes verified

Official stable release: https://github.com/Takazudo/zudo-front-builder/releases/tag/v4.3.1 at `c14ea1fcebee4fed892aeaef6559c9446496ea58`. Release workflow https://github.com/Takazudo/zudo-front-builder/actions/runs/38083459460 independently returned `completed / success` during this session.

All ten exact-version package metadata and tarballs returned HTTP 200; downloaded tarballs matched registry SHA-512 integrity. [Publication proof](publication.json) records URLs, SHA-512 and actual tarball SHA-256. The installed Linux native/slugify family and both lockfiles resolve coherently to 4.3.1. macOS and Windows binaries were downloaded and integrity-checked, not executed.

Published runtime tarballs were compared from 4.3.0 to 4.3.1. Changes are History rejection classification, commit-only bookkeeping, swap veto before teardown, GET document recovery, final-target form writes without POST replay, srcdoc-fragment handling and unsettled-location recovery. Public config/exports and adapter contract require no consumer API migration. Exact root/package/scaffold pins move together. ZFB peers move to `^4.3.1` under the existing canonical root-pin floor contract in `check-pin-parity.mjs`; this delivers the fixed runtime as the supported minimum. History-server `^5.17.2` and zdtp union floors remain unchanged, as does zdtp 0.8.6.

MD/WASM has unchanged compiled code but embeds `ZFB_RELEASE_VERSION`. Actual bytes of all four downloaded WASM files matched the shipped manifest, with unchanged byte sizes and new SHA-256 digests:

| Entry | Bytes | SHA-256 |
| --- | ---: | --- |
| default | 3390113 | `80cb151e47926ef553ade40b1e6f4b466b6f1b14a73ea8144610c42f9948159c` |
| highlight | 1537593 | `47b7619a5e860896cebbbec3ef7969b7590b0fc32d4ead86b5e6c899d4feaf0e` |
| render | 2197301 | `78ccf16f881fbc81339ae328f1e7dcc18928a984449467a09f5514ae4116e467` |
| parse | 700375 | `6a08f4d8883dad9cf985639401dfa1639b6fd1b56cc3503cedaf1777227b92e7` |

The release-contract test compares the installed manifest to the reviewed JSON and hashes every installed WASM file. No old digests were copied. Historical evidence and fixtures under `docs/findings/4430-zfb3-migration` and `_temp-resource` remain unchanged; the active registry-only pending-activation consumer fixture now installs 4.3.1.

## Verification and attribution

Implementation head before the external reference/harness/evidence follow-up: `808273460098989ff13ca39345be5aae6dfc2ebc`. Package source and packed package bytes are unchanged by that follow-up. Final PR head and exact-head CI links are recorded on PR #4516; this file cannot embed its own future commit SHA.

All local package-manager commands ultimately used pnpm 10.30.3 through an explicit temporary `corepack pnpm@10.30.3` shim. Native Node registry requests on this host require `NODE_USE_ENV_PROXY=1`. Initial runs that selected a newer Corepack default outside the repository were discarded and disposable consumers reinstalled with 10.30.3. Generated consumer lockfiles confirm candidate `file:` tarballs/overrides and published SDK/runtime/MD-WASM/native/slugify 4.3.1; zdtp remains 0.8.6.

| Check / command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile --ignore-scripts`; `pnpm check:pin-parity` | PASS |
| `pnpm exec vitest run --project scripts scripts/__tests__/zfb-md-wasm-release.test.ts` | 18 PASS; installed manifest and actual WASM hashes checked |
| `pnpm exec tsc --noEmit -p e2e/tsconfig.json` | PASS |
| Guarded `E2E_FIXTURES=smoke pnpm test:e2e:ci -- e2e/smoke-client-router-history-rejection.spec.ts e2e/smoke-client-router-back-race.spec.ts e2e/smoke-migration-parity-runtime.spec.ts` | 9 PASS, zero retries; guard PASS |
| `migration-4097.mjs prepare`, independent frozen registry install, `verify-install`; guarded consumer `tsc --noEmit -p tsconfig.json`, spec compile and Playwright, `verify-report` | 3 PASS, zero failures/skips/retries; guard PASS |
| `B4PUSH_SKIP_MANUAL_SMOKE=1 pnpm b4push` | All 35 steps attempted. Two initial failures resolved below; no blanket claim that this invocation was green. Automated preview smoke 19/19 PASS; only operator-driven smoke omitted |
| `NODE_USE_ENV_PROXY=1 pnpm check:scaffold-pin-published` | PASS after initial registry fetch failure without proxy environment |
| Package affected tests with a Linux child subreaper: `pnpm exec vitest run --config vitest.config.ts src/__tests__/run-parallel-cli.test.ts src/__tests__/route-context-payload-types.test.ts` | 12 PASS unchanged assertions. Four process-liveness failures reproduce on untouched base (6 PASS / 4 FAIL); PID 1 retains dead orphan processes as zombies on this host. Subreaper reaps them. Two emitted-type failures occurred while packing rebuilt dist concurrently; isolated rerun after packaging PASS |
| `pnpm --filter @takazudo/zudo-doc test:plugin-resolution` | PASS all current plugin exports, obsolete export rejection and lifecycle smoke |
| Guarded A2 on rebuilt untouched base; guarded A2 after narrow external-reference update | 20 PASS each. See [byte comparison](a2-comparison.json) |
| Build initializer; `pnpm pack --pack-destination` for all three packages; install packed initializer and generate barebone / all-feature with `--yes --no-install --git`; `prepare-consumer.mjs`; pinned consumer install; `GEN_DOC_HISTORY=1 pnpm build` from each consumer directory | PASS. 16 / 48 pages; all-feature history resolves its own 33 default + 8 Japanese files |
| Guarded `run.mjs preview <consumer> <kind> <report>`, with child subreaper | [Barebone](barebone-browser.json) 12/12 PASS; [all-feature](allfeat-browser.json) 19/19 PASS. Chromium 145.0.7632.6; zero console/page errors or failed same-origin requests; no surviving server processes, ports free |

[Candidate tarball sizes and hashes](candidate-tarballs.json) record the exact local 5.28.2 artifacts tested; no version/release/publication was performed. The all-feature fixture leaves MCP/Tauri off and includes Japanese locale, search, DTP and native transitions. Registry-only pending activation and linked smoke fixtures cover the runtime separately.

Browser rejection regressions inject rejected push/replace URL writes into the existing router-race fixture, verify old URL/DOM/index at rejection, no swap, and exactly one destination document load. This is Linux Chromium evidence, not a native macOS WebKit quota test.

A2 attribution: untouched main reproduces all three old hashes. Replacing only `data-zfb-build=d1558350bc4d59a9` with `data-zfb-build=7a3c4ecac4f7f7f3` makes every normalized byte identical (1 / 2 / 4 occurrences). The three updated hashes match the first hosted exam exactly. Normalizer, package test source, content and other assertions are unchanged; native identities/comments stay in the strict fingerprint. Independent fresh-context review verified retained captures and the narrow reference update.

The installed-consumer harness still expected pre-R6 disabled Broaden/visible Restore at the highest tree. The product correctly hid that toolbar and widened the forest. Existing [accepted R6 attribution](../4430-zfb3-migration/r6-cloud-ci-attribution.md) and `e2e/sidebar-broader-tree.spec.ts` prove this contract already on base. The harness now asserts toolbar absence, refocuses the exact initial nested branch, then verifies Restore and original node count. Branch narrowing, article/URL, search, theme, DTP, error and teardown checks remain. No product/CSS change, skip or broad rebaseline. Fresh-context review found no actionable findings.

Hosted first-head [PR Checks](https://github.com/zudolab/zudo-doc/actions/runs/38085830892) completed SUCCESS. Explicit expanded [Nightly Exam](https://github.com/zudolab/zudo-doc/actions/runs/38085938743) ran 482 E2E tests PASS, scaffold published guard PASS, accessibility PASS and initializer slow tests PASS; package slow lane had only the three now-attributed A2 hash failures (130 PASS / 3 FAIL). Final exact-head reruns and ordinary preview are followed on PR #4516, not represented by this initial failure as green.

Upstream https://github.com/Takazudo/zudo-front-builder/issues/4133 records an initial 1800-second native test guard timeout and a retry with 1354 PASS / 5 ignored in 270 seconds. Cause remains unknown; this is not clean first-attempt evidence and is retained as an upstream caveat, not an automatic consumer blocker.

Prior human ATOK evidence keeps its original SHAs and limits; built-in Apple IME remains owner-waived / NOT RUN. No repetitive human IME gate is requested. Native macOS WebKit is not tested on this Linux host.

The full protection endpoint returned HTTP 403, but the ordinary branch API independently returned required contexts including stale `Package Safelist Check`. Actual CI emits successful `Package Wind Manifest Check`, and the draft PR remains BLOCKED after the first PR run is green. No branch-protection/settings change is authorized or made. Owner/maintainer must resolve that stale requirement before merge; the new PR remains open for review. PR #4515 is untouched.
