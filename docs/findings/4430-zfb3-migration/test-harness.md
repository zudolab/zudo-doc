# Cutover spine C: zudo-react test harness, vitest flip with source resolution, and the port-check helper

Owner: [#4438](https://github.com/zudolab/zudo-doc/issues/4438). Status: **tooling implemented; migration gates intentionally red until owning ports land**. [Index and column meanings](README.md). [Binding decisions](conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/zudo-doc/vitest.config.ts` | `findPreactRenderToString` | Retain pure logic/markup; audit reachable dialect and API | implemented; zudo-react JSX source and exports-map source resolution; focused unit/port-check evidence below |
| `vitest.config.ts` | `module / template` | Retain pure logic/markup; audit reachable dialect and API | implemented; zudo-react JSX source and exports-map source resolution; focused unit/port-check evidence below |
| `vitest.slow.config.ts` | `module / template` | Retain pure logic/markup; audit reachable dialect and API | implemented; zudo-react JSX source and exports-map source resolution; focused unit/port-check evidence below |
| `packages/zudo-doc/src/__tests__/helpers/zudo-react.ts` (new) | `renderSsr / renderIsland / flushAll` | new owned-runtime harness; exact interface in conventions | implemented; pinned zudo-react/1 server/client contract and locked spec; focused unit evidence below |
| `scripts/zfb3-port-check.mjs` (new) | `CLI source-resolution checker` | new owned diagnostics gate; fail compiler/config failures | implemented; pinned zudo-react/1 server/client contract and locked spec; focused unit evidence below |
| `scripts/check-client-export-names.mjs` (new) | `client entry export audit` | new marker identity/helper export check; per-application fixture roots | implemented; pinned zudo-react/1 server/client contract and locked spec; focused unit evidence below |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| No direct site in initial source scan | Check imported helpers and newly introduced rawHtml | verified: no rawHtml; trusted owned server HTML is assigned to disposable happy-dom host innerHTML |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| Owned source set | No mapped gap in planning TSV | Confirm generated candidate or matching shipped authored selector; unknown ordinary class is not proof | verified: no CSS or utility token changes in this tooling topic |

## Tests and completion evidence

Added focused harness and export-check tests under the assigned files. The package test lane includes the export graph gate; it currently fails on six preexisting client entries assigned to later ports.

Run the exact source-resolution and port-check commands from the conventions with this topic’s paths. Record command, result, version and remaining diagnostics. Required behavioral coverage: initial SSR, active updates, cleanup/disposal, relevant navigation and parser/prop failures. CSS changes require computed-style evidence from the verification owner; a green build is insufficient.

| Completion field | Owner must fill |
| --- | --- |
| Port-check / unit evidence | zfb 3.1.0: `node scripts/zfb3-port-check.mjs packages/zudo-doc/src/format-date/index.ts` → 0 owned, 712 unrelated, exit 0; planted TS2322 in the harness file → 1 owned, exit 1 (restored); `ZFB3_SOURCE_RESOLVE=1 pnpm exec vitest run --config packages/zudo-doc/vitest.config.ts packages/zudo-doc/src/__tests__/helpers/zudo-react.test.ts` → 7 passed; root export tests → 8 passed. Source-resolution imports `@takazudo/zudo-doc/format-date` with no `dist/format-date/index.js`. |
| RawHtml review verdict per site | No rawHtml sites added; harness uses `innerHTML` only with the trusted output of owned `renderToString` in disposable happy-dom. |
| Deliberate DOM/class/behavior differences and cause | None; tooling only. |
| Upstream issue/shim and removal version | No new upstream issue or shim. #3378/#3384 are tracked by the epic. |
| Browser/visual cases handed to #4468/#4475 | Real-browser hydration and visual parity remain those topics’ gates; this harness exercises happy-dom only. |
| Final commit / reviewer / date | Topic branch HEAD; foreground self-review by owning agent, 2026-10-02. |
