# #4481 — plugin scratch directory inventory

**Classification:** `intentional-fix` (`verified`, no path move applies after inventory)

**Implements:** [#4429](https://github.com/zudolab/zudo-doc/issues/4429) via [#4481](https://github.com/zudolab/zudo-doc/issues/4481)

**Target:** `@takazudo/zfb` 3.1.0

## Result

The installed zudo-doc source has no opaque intermediate staged under
`.zudo-doc/`. Its only directory writer creates importable route source files
at `.zudo-doc/routes-src`, which must remain there because zfb's first-party
staging allowlist only stages route sources from that project path. The
similarly named `.zudo-doc.json` file is durable project provenance used by
the eject and theme-pack CLIs; it is not plugin scratch state. Moving either
path to a per-command scratch directory would break its consumer contract.

The inventory found no `.zudo-doc` cache reader or dev/preview middleware
consumer. No source path was moved. The root and scaffold `.gitignore` entries
for `.zudo-doc/` remain necessary for generated route sources.

## Writer, reader, cleanup, cache, and middleware inventory

| Path / symbol | Writer and cleanup | Reader / consumer | Disposition |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/plugins/routes.ts` — `stageRoutes()` in `plugin.setup()` | For published-package routes only, removes and recopies the route-source tree to `<projectRoot>/.zudo-doc/routes-src`; creates the parent recursively. `stagedRoutesDir` is an in-memory cache local to that setup invocation. Workspace source routes are injected directly and do not create this copy. | `stageRoutes()` returns the path used to form each `resolvedEntrypoint`; setup passes it to `ctx.injectRoute()`. zfb's first-party staging allowlist consumes `<projectRoot>/.zudo-doc/routes-src` while building its route shadow. No dev or preview middleware reads it. | Keep at `.zudo-doc/routes-src`: these `.tsx` files are importable route modules, the explicit scratch-directory exception. |
| `packages/zudo-doc/src/eject/index.ts` — `eject()` | Reads and merge-writes `<cwd>/.zudo-doc.json` when a component is ejected. | Later eject invocations read `ejected` provenance to prevent overwriting or to report an idempotent no-op. This is CLI state, outside plugin hooks. | Keep at project root; it is durable user provenance, not an intermediate. |
| `packages/zudo-doc/src/theme-cli/provenance.ts` — `readThemePackProvenance()` / `writeThemePackProvenance()` | Reads and merge-writes the `themePack` key in `<cwd>/.zudo-doc.json`. | The exported reader returns the durable value to callers; writes preserve eject provenance. | Keep at project root; per-command scratch would discard durable state. |
| `packages/zudo-doc/src/theme-cli/apply.ts` — apply reporting | Calls the provenance writer after every successful apply, including an idempotent re-apply; does not introduce a separate path. | Reports `.zudo-doc.json` to the CLI user. | Covered by the provenance row above. |
| `packages/zudo-doc/src/plugins/internal/doc-history/pre-build.ts` — `runDocHistoryMetaStep()` | Writes `<projectRoot>/.zfb/doc-history-meta.json`. | The project's `#doc-history-meta` TypeScript alias and route code consume the generated manifest. It is not under `.zudo-doc/`. | Outside this issue's `.zudo-doc` inventory; retain the project-visible alias target. |
| Resource generators under `packages/zudo-doc/src/plugins/internal/{claude-resources,codex-resources,resource-docs-shared}` | Generate MDX in configured documentation directories. | The content collections consume those files as authored documentation. | Persistent content, not scratch intermediates. |
| `packages/zudo-doc/src/plugins/theme-packs.ts` and its emitter | `postBuild` copies configured pack files to `ctx.outDir/theme-packs`; no project-root staging directory is used. | `devMiddleware` serves the package's shipped pack files directly; preview serves the built output. | Public build assets, not `.zudo-doc` staging. |
| `packages/zudo-doc/src/plugins/search-index.ts`, `plugins/llms-txt.ts` and their emitters | `postBuild` writes generated public files under `ctx.outDir`. | Dev middleware builds responses from project content; preview serves built output. | Public build output and request data; no `.zudo-doc` path or project-local intermediate cache. |

The current route-source path is documented in
`packages/zudo-doc/docs/adr/route-injection-seam.md` and asserted by the
published-package cases in `packages/zudo-doc/src/__tests__/route-injection-build.slow.test.ts`.
`packages/zudo-doc/docs/findings/4267-shadow-tree-probe.md` and the changelog
entries retain earlier topology and migration history. No moved path required a
documentation or ignore edit; `.gitignore` and
`packages/create-zudo-doc/src/scaffold.ts` both need the `.zudo-doc/` rule for
route-source staging.

## Installed zfb 3.1.0 hook contract

The installed declaration is
`node_modules/@takazudo/zfb/dist/plugins.d.ts`. It declares `scratchDir: string`
(not optional) on:

| Hook | Context declaration |
| --- | --- |
| `setup` | `ZfbSetupContext` |
| `preBuild`, `postBuild` | `ZfbBuildHookContext` |
| `devMiddleware` | `ZfbDevMiddlewareContext` |
| `previewMiddleware` | `ZfbPreviewMiddlewareContext` |

Each declaration documents the value as an absolute directory ending in
`plugins` (default `<projectRoot>/.zfb-build/plugins`) and says zfb does not
create it. The package type probe assigned `ctx.scratchDir` to `string` in all
five hook signatures; `tsc` passed.

A disposable runtime plugin against the installed 3.1.0 binary called
`path.isAbsolute(ctx.scratchDir)`, recursively created
`<ctx.scratchDir>/zudo-doc/`, wrote a hook-specific file there, and read it
back. Two `zfb build` runs on the same fixture used distinct scratch roots:

| Invocation | Observed `ctx.scratchDir` | Hook files | Absolute / read-back |
| --- | --- | --- | --- |
| Build A: `--scratch-dir <fixture>/.zfb-build/a` | `<fixture>/.zfb-build/a/plugins` | `setup`, `preBuild`, `postBuild` | All true |
| Build B: `--scratch-dir <fixture>/.zfb-build/b` | `<fixture>/.zfb-build/b/plugins` | `setup`, `preBuild`, `postBuild` | All true; disjoint from A |
| `zfb dev --scratch-dir <fixture>/.zfb-build/dev` | `<fixture>/.zfb-build/dev/plugins` | `setup`, `preBuild`, `devMiddleware` | All true |
| `zfb preview --scratch-dir <fixture>/.zfb-build/preview` | `<fixture>/.zfb-build/preview/plugins` | `setup`, `previewMiddleware` | All true |

Both builds succeeded. Dev and preview each reached their ready state before
the disposable servers were stopped. The runtime probe confirms the declared
contract and that a plugin reader can use the same context path as its writer;
it does not create a synthetic scratch artifact in zudo-doc.

## Verification

| Check | Result |
| --- | --- |
| Type probe: `definePlugin()` reads `scratchDir` in all five hook contexts; `tsc --project <fixture>/tsconfig.json` | Passed |
| Runtime probe: installed zfb 3.1.0, two distinct build scratch roots plus dev and preview | Passed; every observed path was absolute and every same-hook read-back matched |
| `ZFB3_SOURCE_RESOLVE=1 pnpm exec vitest run --config packages/zudo-doc/vitest.config.ts packages/zudo-doc/src/plugins/__tests__/routes.test.ts` | Passed: 1 file, 38 tests |
| `node scripts/zfb3-port-check.mjs packages/zudo-doc/src/plugins/routes.ts` | Passed: 0 owned diagnostics; 18 unrelated migration-window diagnostics |

The published-package route staging assertions live in
`packages/zudo-doc/src/__tests__/route-injection-build.slow.test.ts`; they
confirm the imported source is written beneath `.zudo-doc/routes-src`. The
fast setup coverage is in `packages/zudo-doc/src/plugins/__tests__/routes.test.ts`
and passed below. The slow published-package build test was not run in this
leaf task because no route behavior changed and the full package build belongs
to #4467.

## Deliberate boundary

This issue is verified as not applicable to the current `.zudo-doc/` staging
graph. If a future plugin adds an opaque generated intermediate there, place it
under `<ctx.scratchDir>/zudo-doc/`, create the directory recursively, and make
every matching reader use that same hook context. Importable route modules
remain at `.zudo-doc/routes-src`.

The route-source tree itself remains shared across sessions: `stageRoutes()`
still removes and recopies `<projectRoot>/.zudo-doc/routes-src`. Distinct zfb
scratch roots do not isolate that required importable-route location, and this
inventory does not prove concurrent copies cannot overlap. The current zfb
allowlist requires route modules at the project path, so resolving that
separate boundary requires a zfb staging-contract change or a concurrency
policy outside this topic.
