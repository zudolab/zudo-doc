# Closeout dependency tuple and #4501 reconciliation draft (2026-10-10)

Evidence file for sub-issue #4503 (epic #4502, owners #4475 / #4501). Read from `base/zfb3-migration` at head `fd0764fbc`. Documentation only: nothing here changes a pin, a peer range or a lockfile.

## zfb family is 4.3.0 everywhere

- `pnpm exec zfb --version` printed `zfb 4.3.0` and `embedded esbuild: 0.25.12`.
- `npm view @takazudo/zfb version` and `dist-tags.latest` both returned `4.3.0` on 2026-10-10.
- The lockfile importers resolve `@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-md-wasm` and the Cloudflare adapter at 4.3.0 (exact pins, `^4.3.0` published peers); see [the resume record](2026-10-10-zfb-4.3.0-resume.md).

## zdtp 0.8.5 is the selected runtime, no upgrade in this closeout

The user deferred any zdtp upgrade because it is handled elsewhere. This closeout records the actual resolution only. It makes no floor change, no global dedupe, and does not touch zdtp #1002, #1003 or PR #1011. The explicit Preact dependency is kept because zdtp 0.8.5 still declares and ships Preact.

Registry observation on 2026-10-10 (`npm view @takazudo/zdtp version`): `0.8.6`. The Closeout plan recorded `latest` as 0.8.5 earlier the same day; 0.8.6 is therefore newer than the selected runtime and is deliberately not adopted here.

| Consumer | Source | Resolved `@takazudo/zdtp` |
| --- | --- | --- |
| Root showcase importer (`.`) | `package.json` `"@takazudo/zdtp": "0.8.5"`; `pnpm-lock.yaml` importer `.` | `0.8.5(preact@10.29.2)` |
| `packages/zudo-doc` importer | peer range `^0.5.2 \|\| ^0.6.0 \|\| ^0.7.0 \|\| ^0.8.0`; `pnpm-lock.yaml` importer `packages/zudo-doc` | `0.8.0(preact@10.29.2)`; intentional supported-floor coverage inside the `^0.8.0` peer branch, not the selected runtime |
| Generator scaffold pin | `packages/create-zudo-doc/src/scaffold.ts` (`deps["@takazudo/zdtp"] = "0.8.5"`, only when `designTokenPanel` is on) | `0.8.5` |
| Fresh generated consumer | produced by the installed three-package acceptance task | to be filled in by that task (not observed here) |

`pnpm-lock.yaml` therefore carries two zdtp packages (`0.8.0` and `0.8.5`), each with `preact@10.29.2`. That split is expected and is not deduplicated.

## Where the built island resolves zdtp at runtime

Static reading of the source and the installed tree (no build was run for this topic, so this is a source/`node_modules` inspection, not a bundle inspection):

- `DesignTokenPanelBootstrap` (`packages/zudo-doc/src/design-token-panel-bootstrap-island.tsx`, controller in `design-token-panel-bootstrap-controller.ts`) never imports `@takazudo/zdtp` directly. It lazily imports `@takazudo/zudo-doc/zdtp-loader`.
- `packages/zudo-doc/src/zdtp-loader.ts` is the only file with a bare `import { configurePanel } from "@takazudo/zdtp"` (plus `export *`). When zdtp is not bundled, the preset's `zdtp-loader` plugin (`packages/zudo-doc/src/plugins/zdtp-loader.ts`) shadows exactly that specifier with a throwing virtual module.
- In the showcase worktree `node_modules/@takazudo/zudo-doc` is a symlink to `packages/zudo-doc`, and the bare `@takazudo/zdtp` specifier in the loader resolves from that real location. `packages/zudo-doc/node_modules/@takazudo/zdtp` points to `.pnpm/@takazudo+zdtp@0.8.0_preact@10.29.2`, while the root `node_modules/@takazudo/zdtp` points to `0.8.5`.
- Consequence to verify: if the bundler follows realpaths (the default), the showcase's built panel island imports the **0.8.0** copy (the `packages/zudo-doc` importer), not the root's 0.8.5. In a published install (a fresh generated consumer) there is no workspace symlink and the loader resolves the consumer's single installed copy, which the generator pins at 0.8.5. The lockfile importer entries describe what is installed, not which copy a given island chunk imports; the built chunk in `dist/` must be inspected to settle the showcase case. This is deferred to the installed-acceptance / confirm tasks (a build is heavy and out of scope here).

## #4501 reconciliation draft

Draft only; issue #4501 is not edited here. The disposition task posts the final text. Open resume rows from #4501 against the newer evidence at head `fd0764f` (PR Checks [38030812860](https://github.com/zudolab/zudo-doc/actions/runs/38030812860) 28/28, hosted acceptance [38030809260](https://github.com/zudolab/zudo-doc/actions/runs/38030809260)):

| Open #4501 row | Newer evidence | Verdict |
| --- | --- | --- |
| Exact-final-head package suite, including the four process-lifecycle assertions, passes on a reaping host | Hosted runners pass the package unit tests (PR Checks 38030812860 28/28; hosted package slow/packed 133/133 in 38030809260). The four `run-parallel-cli.test.ts` PID assertions were not individually re-read for this draft | Still pending confirmation: likely satisfied by the hosted package-unit job, but the confirm task must read that job for the four PID assertions; rerun if the candidate changes |
| Required final-head browser suite passes with the repository-pinned browser | PR Checks 38030812860 ran 475 E2E tests in CI (pinned Playwright browser) | Satisfied at `fd0764f`; pending renewal if product code changes before merge |
| Production-vs-candidate comparison and Mermaid enlargement with external access | Unchanged: hosted capture reached 65 states/screenshots per side, zero capture errors, including the Mermaid-enlarge state (resume record, run 38029707092); raw comparison still shows 47 `nav`/`sidebarTree` height differences awaiting visual 06R classification | Capture part satisfied; production-comparison acceptance still pending on the visual 06R task |
| Durable PR evidence records exact final head, commands, outcomes and screenshots | Run URLs and head SHAs are recorded in the resume record and README; lasting-evidence relocation and screenshot artifacts (11661494023 expires 2026-10-17) are separate topics | Still pending: final-head record belongs to the confirm and disposition tasks |
| External references (production URL, `esm.sh` Mermaid, Chromium CDN) unreachable from the cloud container | Container-specific; hosted CI reached the browser and Mermaid paths | Out of scope as a product gate (environment limitation), covered by the hosted rows above |
| Published zfb #4097 persisted-child (stated as separate real blocker) | Strict published 4.3.0 consumer passes 3/3 (38030809260) | Satisfied (upstream resolved by 4.3.0) |
