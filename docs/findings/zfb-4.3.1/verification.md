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

## Verification is in progress

- Pinned pnpm 10.30.3 install completed. A first b4push run was stopped because child processes selected fallback pnpm 11.19.0; it is not counted. A temporary Corepack shim directory ensures all later subprocesses use 10.30.3.
- `pnpm check:pin-parity`: PASS.
- `pnpm exec vitest run --project scripts scripts/__tests__/zfb-md-wasm-release.test.ts`: 18 PASS.
- `B4PUSH_SKIP_MANUAL_SMOKE=1 pnpm b4push`: running, self-guarded. Only the operator-driven smoke is omitted.
- Browser regressions use the existing smoke router-race fixture to inject rejected push/replace URL writes, verify old URL/DOM/index at rejection, no swap, and exactly one document load to the destination. This is Linux Chromium evidence, not a native macOS WebKit quota test.

Upstream https://github.com/Takazudo/zudo-front-builder/issues/4133 records an initial 1800-second native test guard timeout and a retry with 1354 PASS / 5 ignored in 270 seconds. Cause remains unknown; this is not clean first-attempt evidence and is retained as an upstream caveat, not an automatic consumer blocker.

Prior human ATOK evidence keeps its original SHAs and limits; built-in Apple IME remains owner-waived / NOT RUN. No repetitive human IME gate is requested. Native macOS WebKit is not tested on this Linux host.

Live protection endpoint returned HTTP 403 (`Resource not accessible by integration`). The stale `Package Safelist Check` report from PR #4515 is therefore not independently confirmed through that endpoint; final PR merge state will be inspected. No protection/settings change is made.
