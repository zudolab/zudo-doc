# zudo-doc 6.0.0 publication record (2026-10-11)

The coordinated 6.0.0 release for #4512 is published. All three packages are on npm at 6.0.0, each with `latest` = 6.0.0. Package publication, documentation deployment and published-consumer checks are recorded separately below.

## Release commit, tags and publication

- Release PR [#4524](https://github.com/zudolab/zudo-doc/pull/4524) merged regularly as `875af5f23cb257a675a9dfe98719c66bcb7b4bfd`. Its tree `8ba7f4e3` is identical to the reviewed head, so the merge introduced no changes.
- All three tags (`zudo-doc-history-server-6.0.0`, `zudo-doc-v6.0.0`, `v6.0.0`) point at the reviewed release commit `b4f974598b27064a092eeadb5b2e5559078a8bb9`.
- The preceding commit `3fabb05fc` refreshed the two scaffold pins that failed the release preflight `check:scaffold-pin-freshness`: `@modelcontextprotocol/sdk` 1.31.0 → 1.32.1 and `wrangler` 4.111.0 → 4.149.0. The zfb 4.3.1 / `^4.3.1` and zdtp 0.8.6 tuple is unchanged.
- The packages were published in order, each only after the previous one was live on npm:

| Package | Publish workflow | npm |
| --- | --- | --- |
| `@takazudo/zudo-doc-history-server` | [38128094747](https://github.com/zudolab/zudo-doc/actions/runs/38128094747) success | 6.0.0, `latest` |
| `@takazudo/zudo-doc` | [38128398311](https://github.com/zudolab/zudo-doc/actions/runs/38128398311) success | 6.0.0, `latest` |
| `create-zudo-doc` | [38128678272](https://github.com/zudolab/zudo-doc/actions/runs/38128678272) success, Safeguard 4/5 passed | 6.0.0, `latest` |

## Candidate checks: executed vs not run

- [PR Checks 38127062531](https://github.com/zudolab/zudo-doc/actions/runs/38127062531) on `b4f974598`: 28/28 jobs succeeded, including E2E 482 passed. **Not run:** the A2 gate's test steps were skipped by changed-file gating.
- Local `B4PUSH_SKIP_PIN_PUBLISHED=1 pnpm b4push`: 33 steps passed and 2 were skipped (the pin-published window, and manual smoke, which needs a TTY).
- Local slow suites on `3fabb05fc`: create-zudo-doc 26/26; zudo-doc 130/133 (A2 build identity, below).

## Documentation deployment succeeded

The automatic [Production Deploy 38128051473](https://github.com/zudolab/zudo-doc/actions/runs/38128051473) on `875af5f23` succeeded in all five jobs. This is a workflow result only.

## Published consumers build and pass browser checks

Consumers were created outside the repository with the registry initializer `pnpm dlx create-zudo-doc@6.0.0` and plain registry installs, with no tarballs or links. In every lockfile, the `@takazudo/zudo-doc@6.0.0` and `@takazudo/zudo-doc-history-server@6.0.0` integrities equal npm's `dist.integrity`. Tools: zfb 4.3.1, Node 24.13.1, pnpm 10.30.3, Chromium 145.0.7632.6. The browser runs use `scripts/zfb3-parity/installed-consumer/run.mjs`; only its nested-sidebar content fixture was added, with no dependency changes.

| Consumer | Install / build | Browser |
| --- | --- | --- |
| Barebone (every feature off) | PASS, 16 pages | [12/12 PASS](barebone-browser.json) |
| All-feature (ja, search, DTP, transitions; MCP/Tauri off) | PASS, 48 pages | [19/19 PASS](allfeat-browser.json) |
| MCP/Cloudflare (`--mcp --mcp-deploy cloudflare`; SDK 1.32.1, wrangler 4.149.0) | PASS, 6 pages | Not run |

The first browser attempt ([barebone](attempt1-barebone-browser.json) 11/12, [all-feature](attempt1-allfeat-browser.json) 18/19) failed only its teardown probe. The probe counted the launching `bash -c` wrapper, whose arguments contained the consumer path; the process group was empty and the port was free. Rerunning through a script file passed every check. Both attempts are retained.

## Post-publication Nightly Exam found two test-only defects; both fixed

[Nightly Exam 38128867046](https://github.com/zudolab/zudo-doc/actions/runs/38128867046) on `875af5f23`: scaffold-pin-published, Full E2E and Theme A11y succeeded. Two jobs failed:

- **create-zudo-doc slow, 24/26.** This was the #4522 adoption scenario's first hosted run. It edits an existing consumer's manifest and reinstalls, and CI's default `--frozen-lockfile` rejected the reinstall. Fix: `--no-frozen-lockfile` for those two reinstalls only, as `pnpm add`/`remove` would do. Under `CI=true` locally the scenario went from 2 FAIL to 2 PASS.
- **zudo-doc slow, 130/133 (A2).** The release changed the linked package bytes that zfb's native zudo-react build token hashes. The reference now holds the exam-observed hashes. The PR A2 gate on the fixture change executed and passed. Its captured HTML [reproduces every old reference hash when only the old token is substituted back](a2-comparison.json), and it equals the local candidate except for the token.

## Limits are unchanged

Apple IME was cancelled by the owner; it remains NOT RUN, not PASS. A3 is PARTIAL / UNVERIFIED and A5 is NOT RUN. Browser evidence is Linux Chromium only. Optional ChatGPT account acceptance (#4485) was not attempted.
