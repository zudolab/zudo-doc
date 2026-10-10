# Closeout final-head gates (#4510, 2026-10-10)

Evidence file for sub-issue #4510 (epic #4502, owner #4475). This is the central confirm record: base reconcile, independent review and exact final-head checks. It records every failed, skipped, unavailable or accepted-difference result; nothing here is a release PASS.

> **Status pointer (2026-10-11):** PR #4477 has merged and its production deployment succeeded. The owner waived the macOS IME gate for that merge. The PENDING wording below is the pre-merge record and is kept as written. Current status: human ATOK A1/A2 PASS on their original SHAs; A3 PARTIAL/UNVERIFIED; Apple built-in Japanese IME NOT RUN / OWNER WAIVED; A5 NOT RUN. None is a PASS. See [post-merge status](2026-10-11-post-merge-status.md).

## Final candidate head `d4185fb9e` passes every required hosted check

- Candidate: `d4185fb9e4f8555d6edaadb419be49ff694cd3ad` on `base/zfb3-migration` (PR #4477 head).
- `main` is still `337b9f110793dccb4759bddd5273eab38cd9d2f0`. The base is not missing any `main` commit, so no merge from `main` was needed.
- Dependency tuple: `@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-md-wasm` and `@takazudo/zfb-adapter-cloudflare` are exactly 4.3.0, with published peers `^4.3.0`. `@takazudo/zdtp` is 0.8.6 (see the zdtp section below).

## zdtp 0.8.6 adopted on user selection, runtime bytes unchanged

- The user selected 0.8.6, which is also the npm `latest`. Its `dist/` is byte-identical to 0.8.5.
- In 0.8.6, `preact` is zdtp's own dependency. The explicit host and generator `preact` dependencies were removed (`fe4e83d9d`).
- The `@takazudo/zudo-doc` zdtp peer range is unchanged (`^0.5.2 || ^0.6.0 || ^0.7.0 || ^0.8.0`). The `packages/zudo-doc` importer keeps its 0.8.0 supported-floor coverage.
- Details: [closeout dependencies](2026-10-10-closeout-dependencies.md#zdtp-086-selected-2026-10-10-user-instruction).

## PR Checks 28/28 success at `d4185fb9e`

Run [38044654348](https://github.com/zudolab/zudo-doc/actions/runs/38044654348): all 28 jobs succeeded. The jobs include E2E Tests, A2 No-Stub Parity Gate, Type Check, Build Site, Worker Contract Proof, Theme A11y Audit, Package Unit Tests, Root Unit Tests, Slow Unit Tests, Preview Deploy and HTML validation, plus every drift and guard job. The job count and identities match reference run [38030812860](https://github.com/zudolab/zudo-doc/actions/runs/38030812860) at `fd0764f`, which also passed 28/28. No check is new and none fails.

## Migration Hosted Parity: required jobs pass, two diagnostics fail as designed

Run [38044650322](https://github.com/zudolab/zudo-doc/actions/runs/38044650322) at `d4185fb9e`:

| Job | Result | Disposition |
| --- | --- | --- |
| Migration zudo-doc full slow and packed suite | success | Required |
| Migration create-zudo-doc full slow suite | success | Required |
| Published 4.3.0 strict pending activation consumer | success | Required (the upstream #4097 consumer) |
| Exact reviewed 4.2.1 A2 baseline capture | success | Required |
| Complete A2 baseline/current byte differences | failure (intentional diagnostic) | **Accepted difference.** Native build-ID changes plus the islands bundle filename. These were reviewed and accepted; byte equality is not the contract. Normalizer and assertions are unchanged, and the job was not rerun to force equality. |
| Migration baseline/current browser measurement | failure (intentional diagnostic) | **Accepted difference.** There are exactly 47 `nav`/`sidebarTree` height differences: 27 `sidebarTree` and 20 `nav`. [#4505](2026-10-10-closeout-visual.md) classified all of them as intended: the 46 px toolbar ×38, the 73 px wrapped hint ×5, and the 160 px Guides toolbar plus three new pages ×4. |

## A2 references refreshed twice, for build IDs and one intended class

- `bfd7b2373` refreshed the build IDs and recorded the intended #4507 `ml-auto` class on the ◎ button.
- `d4185fb9e` refreshed build IDs only, after the zdtp lockfile change.
- Normalizer and assertions are unchanged in both. Causal diffs: [A2 summary](2026-10-10-a2-comparison-summary.md).

## Local guarded b4push: 33/35 PASS; one stale-fixture failure, one skip

`bash $HOME/.claude/scripts/heavy-guard.sh -- pnpm b4push` was run on `61d52377b`:

- 33 of 35 steps passed.
- **`e2e/` type checking failed.** The cause was stale gitignored hostpanel fixture materializations in the main working tree, not source. A clean checkout at the same HEAD ran `pnpm check:e2e` with exit 0 and 0 errors. Hosted Type Check also passed at `d4185fb9e`.
- **Manual interactive smoke was skipped**, because there was no TTY. The human manual item below covers it.
- The later commits (`bfd7b2373`, `fe4e83d9d`, `e6fbe4814`, `d4185fb9e`) changed test references, the zdtp dependency and docs. Hosted PR Checks and Migration Hosted Parity verified them at the exact head.

## Independent review: 9 findings, 7 fixed, 2 dispositioned

`/code-review medium` was run on `fd0764fbcba9a9a1059fbf142fbeac85b0a0c16b..HEAD`. It reported 9 findings:

- 7 were fixed in `61d52377b`. One of them adds `max-w-full` to the sidebar category toggle.
- The `sidebar-decompose` `act()` re-click is kept as evidence-tool behaviour. The e2e suite independently asserts that each click moves exactly one level.
- The `isDisabled` hang is guarded by a count check.

No finding was dropped without a disposition.

## #4513 fixed: agent export respects `copyPublicWithBase: false`

Fixed in `aaf3e307f`. The non-root mount control passes 8/8 ([installed-consumer record](2026-10-10-closeout-installed-consumer.md#fix-for-4513)).

## Installed three-package acceptance renewed on zdtp 0.8.6

Commit `e6fbe4814` records the renewal.

- Barebone passed 12/12.
- All-feature passed 19/19, including the full Design Token Panel lifecycle.
- The generated `package.json` has no `preact` key. On disk there is a single zdtp 0.8.6 copy and a single preact copy.
- Teardown was proven: no surviving processes, and the ports were free.

Details: [installed-consumer record](2026-10-10-closeout-installed-consumer.md#renewed-after-zdtp-086-fe4e83d9d).

## Preview machine smoke at `d4185fb9e`: 13/13 PASS

- `scripts/zfb3-parity/closeout-preview-smoke.mjs` ran against https://pr-4477-zudo-doc-preview.takazudo.workers.dev after it was deployed from `d4185fb9e`.
- All 13 lines passed, including 0 console errors.
- The AI-chat composition line is **synthetic** (scripted composition events). It is not real IME evidence.

## Base reference sweep has no live `_temp-resource` links

`git grep "_temp-resource/4430"` outside the directory still shows only historical mentions. There are no executable references and no live links ([relocation record](2026-10-10-closeout-evidence.md#reference-inventory)).

## macOS Japanese IME and manual smoke still PENDING

These checks need a human on macOS and cannot run on the Linux host:

- real Japanese IME composition in site search and the AI chat;
- the AI chat rule that the conversion-confirming Enter does not submit, while the next ordinary Enter submits exactly once;
- the combined visual smoke.

The procedure and the ready-to-paste template are in [closeout manual](2026-10-10-closeout-manual.md). This is the only remaining required acceptance item.

## Not gates for this closeout

- #4485 (real ChatGPT account connection) stays open and out of scope.
- On the twelve-level fixture, label text at levels 9–12 runs past the sidebar edge. This comes from the pre-existing native `padLeft()` indentation and is not a 06R regression. Whether to change it is a design call for the user.
