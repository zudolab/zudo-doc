# Dependency audits

## 2026-10-27 audit: stale overrides dropped, advisories cleared, Vite+ not adopted

Audited against `093defd96` on Node 24.22.1 and pnpm 10.30.3, covering the root
and all four workspace packages. Detectors were `knip` 5 (dependencies only)
plus hand-checked imports, scripts, configs, CI and upstream manifests.

| Measure | Before | After |
| --- | --- | --- |
| Lockfile package records | 543 | 538 |
| Installed `name@version` (linux-x64) | 432 | 431 |
| Installed package names | 404 | 402 |
| Installed size (`node_modules/.pnpm`) | 710.5 MB | 554.0 MB |
| `pnpm audit` (all / prod) | 59 / 7 (15 high) | 0 / 0 |
| `@takazudo/zudo-doc` `dist/` | 1104 files, 7,265,125 B | byte-identical |
| Site worker bundle `_zfb_inner.mjs` | 1,462,693 B | 1,579,849 B (zod 4.6) |

The lockfile delta is small because tsup 9 adds a second Rollup line (Vite 7
keeps 4.59) whose 25 platform records install only one binary. The real win is
the duplicate Wrangler 4.111 / Miniflare 4 / workerd 1.20260710 stack: 155 MB.

### Removed overrides and declarations

- `pnpm.overrides` for `lodash-es`, `uuid` and `dompurify`: none of these
  packages is in the graph any more. lodash-es has no import anywhere, so
  there were no lodash usages to replace.
- `undici` (`>=7.29.0 <8`): it forced jsdom, which asks for `^8.9.0`, down to
  undici 7. Miniflare 5 pins a patched 7.30.1 itself.
- `sharp` and `ws`: every remaining requester pins a version at or above the
  floor (Miniflare 5: sharp 0.35.5, ws 8.21.0; happy-dom `^8.21.0`).
- `@cloudflare/vitest-pool-workers` 0.18.5: deprecated upstream and renamed to
  `@cloudflare/vitest-plugin` (same `cloudflareTest` API, now 1.4.8). Its
  Wrangler 4.111 / Miniflare 4 copy is gone; so is `search-worker`'s own
  Wrangler 4.111 resolution (`^4.156.0` now dedupes with the root pin).

### Tightened, updated and kept overrides

- `esbuild` `^0.28.2` (was `>=0.28.1`): still collapses Vite 7's `^0.27`
  request onto the line the frozen-script generators use. Bounded so a
  breaking 0.x release cannot slip in.
- `fast-uri@3` `>=3.1.9`, `brace-expansion@5` `>=5.0.12`: raised to the patched
  versions of the advisories open at baseline.
- `yaml@2` `>=2.9.1`: raised to match the package's own `^2.9.1`, which the
  override would otherwise rewrite back to 2.9.0.
- `picomatch`, `postcss`, `yaml@2`, `hono@4`, `nanoid@3`: kept. Their
  requesters' ranges still admit the vulnerable versions these floors exclude.

### esbuild stays a runtime dependency of `@takazudo/zudo-doc`

esbuild is not only a build tool here. `copy-eject-sources.mjs` ships
`gen-nav-overflow-script.mjs` into ejected headers, and that script loads
esbuild from the installed package at the consumer's site. The three package
generators (`gen-search-widget-script`, `gen-nav-overflow-script`,
`gen-switcher-scripts`) use it at build time to produce the CSP-hashed frozen
literals. The range moved from open-ended `>=0.28.1` to `^0.28.2`. Package
scripts and the eval-graph tests now load the declared dependency directly
instead of borrowing Vite's or tsup's copy.

### Kept dependencies with real consumers

| Dependency | Evidence and decision |
| --- | --- |
| `tsx` (package `dependencies`) | `tags-audit` / `tags-suggest` bins spawn `tsx/cli` to load the consumer's TypeScript config. Node's type stripping does not resolve its extensionless imports. Versions now unified on 4.23.15. |
| `tsup` | Kept and moved to 9.0.0: `@takazudo/zudo-doc` `dist/` is byte-identical and it drops tsup 8's chokidar 4 / esbuild 0.27 requests. |
| `@inquirer/prompts`, `pluralize` | knip false positives: imported by `bin/*-runner.ts`, which knip does not treat as entries. |
| `fs-extra` | About 100 call sites, including `copy` with filters, in both published CLIs. A native rewrite breaks the 40-line abandon rule. Terminal KEEP. |
| `katex` (new `@takazudo/zudo-doc` dev dependency) | Package tests load KaTeX directly. Without the declaration, pnpm resolved the optional peer to a second 0.19.0 copy next to the root's 0.19.1. |
| `jsdom`, `msw` | Not declared. pnpm resolves them as optional peers of Vitest / `@vitest/mocker`; a fresh resolution keeps them. Nothing imports them. |

### Decided against (with blockers)

- **Vite+ 1.4.0 is not adopted.** Measured in a scratch copy, `vp test` ran
  the history-server suite (74/74 green), but on its own Vite+ installs 81
  packages / 127 MB versus 72 / 61 MB for Vitest + Vite + tsup, because it
  bundles oxlint, oxfmt and tsgolint binaries this repo does not use. Adopting
  it in one package added 105 lockfile records. Its `vite` alias
  (`@voidzero-dev/vite-plus-core@1.4.0`) does not satisfy Vitest's `vite`
  peer. `@cloudflare/vitest-plugin` still needs real `vitest`. `vp pack`
  emitted `.mjs`/`.d.mts` names (36% larger) that break the published
  `exports` maps. tsup 9 is a drop-in, so no tsup replacement is needed.
- **Vitest 5 + Vite 8 are blocked.** With them, three drift-guard tests fail
  (`current-path-surfaces`, `language-switcher`, `version-switcher`): they
  compare `Function.prototype.toString()` of live helpers, as transformed by
  Vitest, with esbuild-frozen literals. Vite 8's oxc transform formats those
  bodies differently. Vite 8 also drops Vite's esbuild dependency and changes
  the `esbuild`/`keepNames` handling that `e2e/browser-embed.vite.config.ts`
  relies on. Staying on Vitest 4.1.12 / Vite 7.3.7 (both patched) keeps
  html-validate 10's `vitest` peer satisfied too.
- **TypeScript 6/7, `@clack/prompts` 1.x, `diff` 9:** majors that change the
  `zfb check` / tsup type pipeline, the interactive CLI, or a published peer
  range. Each needs its own behavioral review.
- **`lefthook` 2.2.x and `@types/node` 22.20:** pnpm's `trust-policy=no-downgrade`
  rejects `lefthook@2.2.2` and `undici-types@6.21.0` (pulled by newer
  `@types/node@22`). Trust checks were not disabled, so both stay at their
  locked versions. The same policy also blocks a full `pnpm dedupe` until
  `@types/node@22.19.15`'s `undici-types` is resolved.
- **Published peer floors are unchanged.** The workspace now resolves zod 4.6.7,
  but the `zod` peer (`^4.3.6`) and the scaffold's emitted range still admit
  versions affected by the advisory for zod `<4.6.6`. Raising a published peer
  floor narrows consumer compatibility and belongs to release review. Fresh
  scaffolds already resolve the latest 4.x.
- **`@playwright/test`** stays at 1.58.2 because the CI e2e jobs pin the
  matching `mcr.microsoft.com/playwright:v1.58.2-noble` image.

### Verification

Baseline (`093defd96`) and final tree both passed `pnpm install --frozen-lockfile`,
`pnpm build:workspace`, `pnpm build`, `pnpm check`, `pnpm test` (1,492 root,
3,702 zudo-doc, 816 create-zudo-doc, 74 history-server and 44 search-worker
tests), `pnpm verify:worker-contract` (17 Workers-runtime tests plus the
Wrangler dry-run), `pnpm check:pages` and `pnpm check:e2e`. On the final tree,
`pnpm b4push` passed all 35 steps (the manual TTY step was skipped), including
the `check:prepack-contract` publish gate, template, fixture, pin-parity and
frozen-script drift checks, link, image and HTML validation, and the preview
smoke. `pnpm test:e2e:browser-embed` passed (2/2) against the Vite 7.3.7 build.
Full Playwright E2E runs in CI.

Site output differs from baseline in exactly two ways: KaTeX 0.19.1 changes the
`katex-version` string in the stylesheet (so the CSS hash in every page
changes), and zod 4.6.7 (clears GHSA high `<4.6.6`) changes the server worker
bundle. The history-server `git-history.d.ts` moves its `FirstLastMeta` type
export into a separate `export type {}` line under tsup 9; that is equivalent.

## 2026-09-24 audit: retained used packages and locked the formatter

Audited 2026-09-24 against `50cbd5c6c`: the root, all four pnpm workspace
packages, both Tauri applications, and their scaffold manifests. Detectors were
`depcheck` 1.4.7 and `cargo machete --with-metadata`; their output was checked
against imports, scripts, compiler configuration, and framework peers.

### Removed one duplicate resolution; no direct dependencies removed

Adding the already-used formatter to the root dev dependencies caused pnpm to
consolidate `lru-cache`: `path-scurry@2.0.2` now resolves `11.5.2`, already used
by jsdom, instead of `11.2.7`. This is a transitive version change, not merely
a deleted declaration. The lockfile has **458 package records, down from 459**.
No production dependency declarations or Rust dependencies changed.

The full `pnpm dedupe --check` could not complete: pnpm rejected
`chokidar@4.0.3` with `ERR_PNPM_TRUST_DOWNGRADE`. Trust checks were not disabled.
The scoped formatter install used the existing offline store; no claim is made
that all remaining duplicate versions have been eliminated.

### Root formatting now uses the declared, locked version

Root formatting scripts and the pre-commit hook previously ran
`pnpm dlx @takazudo/mdx-formatter`. They now use `pnpm exec mdx-formatter`,
with an exact root dev dependency of `1.3.0`. The old command and the
workspace-installed binary both reported that version during the audit.

The same pin intentionally remains in `packages/zudo-doc`: its tests import
the formatter directly. Root scripts and package tests each declare their own
consumer relationship. This adds no unique formatter package to the lockfile.

### Keep dependencies with real consumers

| Dependency | Evidence and decision |
| --- | --- |
| `@types/minimist` in `packages/zudo-doc` | Only `bin/zudo-doc.mjs` imports minimist, outside the checked TS files. Keep for editor typing of that live JS CLI; the scaffold's TS CLI also retains its own declaration, so removal would save zero packages. |
| `minimist`, `fs-extra`, `picocolors` | Live CLI, scaffolding, eject, theme, and audit consumers. No handwritten replacements attempted. |
| `diff`, `katex`, `@takazudo/zdtp`, `@takazudo/zfb-md-wasm` | Framework peer contracts enable history comparison, math, design-token controls, and browser highlighting. Imports alone are not a sufficient removal oracle. |
| `zod`, zfb packages | zod is the runtime schema contract; zfb packages are engine contracts, and the Cloudflare adapter also has a direct import in `pages/api/ai-chat.tsx`. |
| `preact-render-to-string`, `vite` | The browser-embed fixture now uses zfb's public zudo-react server renderer; the unused renderer dependency has been removed from the root manifest. Vite remains the direct fixture build dependency. |
| `pluralize`, `@types/pluralize`, `culori`, `@types/culori` | Tag tests and contrast tooling import these directly. Retention elsewhere does not replace a direct declaration. |
| `@takazudo/zudo-design-token-lint`, `html-validate`, `wrangler` | Depcheck false positives: binary names and script/CI consumers differ from import usage. |
| `minisearch` in `packages/search-worker` | Direct import in `src/search.ts`; the optional search Worker still needs it even though default site search does not. |
| `parse5`, `smol-toml`, `yaml`, `esbuild`, `tsx`, `@inquirer/prompts` | Package-owned parsing, resource generation, bundling, TS CLI execution, and interactive CLI consumers. |
| `tauri-build` | Cargo-machete flags both applications and both templates, but all four `build.rs` files call `tauri_build::build()`. Keep. |
| `tauri`, `open`, `libc`, `serde`, `serde_json` | Direct Rust consumers, including subprocess cleanup and configuration parsing. No platform behavior changes attempted. |

### Keep scope and detector limits explicit

- Published-package runtime dependencies were not modified. Replacing a library
  or changing a framework feature requires a separate behavioral evaluation.
- Node type versions differ intentionally between package toolchains; framework
  peer/dev pins and root/scaffold engine pins also serve distinct consumers.
- The historical detector reported virtual modules, old React compatibility aliases, package self-imports,
  and scaffold-template imports as missing. Package tests also consume root
  workspace tooling (`vite`, `culori`, and framework fixtures); this audit did
  not redesign test dependency ownership.
- Do not add the raw detectors as blocking CI checks: the verified false
  positives need a maintained configuration first.
- CI's then-pinned `npx wrangler@4.111.0` deployment commands and the exam's
  `npx playwright test` were inventoried but not changed by this audit.
  Deployment workflow consolidation is separate from root formatter ownership.
  The Wrangler literal has since been retired (#4528): see the current Wrangler
  contract below.
- The parent commit's Production Deploy run was green. Rust targets were
  inspected, not rebuilt, because no Rust changes were made.

### Verification preserves generated assets and exercises the new resolution

The workspace and 773-page site build passed. All 492 generated JS, CSS, and
WASM files matched the baseline hashes. A fresh isolated frozen offline
install resolved `path-scurry` to `lru-cache@11.5.2`; formatting all 638 content
files, token lint over 193 files, and HTML validation passed using that install.
The temporary install was removed afterward. A forced frozen offline install
also refreshed the checkout's stale skipped-package state; its actual runtime
resolution was checked, not just its lockfile.

The comprehensive pre-push run passed its automated checks except template
drift and package tests: `cargo machete --with-metadata` had generated ignored
Cargo lockfiles inside the scaffold templates. Those audit-generated files
were removed and template drift passed. The package rerun hit machine-load
timeouts; retrying with `pnpm test:packages --maxWorkers=2` passed, as did the
plugin-resolution check. No test assertions or timeouts were changed.
Manual interactive smoke was skipped; browser E2E is outside this local suite.

### Current migration dependency contract

Release 8.1.2 shipped the ZFB 5.1.4 family (peers `^5.1.4`; 5.1.0 by #4627, 5.1.1 by #4640, 5.1.2 by #4641, released in 8.1.0; 5.1.3 by #4646, released in 8.1.1; 5.1.4 by #4656), zdtp 0.8.7, MCP SDK 1.32.2, and history-server peer floor `^8.0.0`; 8.1.3 kept that tuple; the unreleased workspace moves to ZFB 5.1.5 (peers `^5.1.5`) and zdtp 0.9.0. Node.js 24 remains the minimum. The publication records below describe earlier releases.

The released 6.0.0 tuple: `@takazudo/zudo-doc`, `@takazudo/zudo-doc-history-server`
and `create-zudo-doc` were published at 6.0.0 with the published zfb family
pinned to 4.3.1 and peers ^4.3.1. zudo-doc 6.0.2 moved to zfb 4.3.2 with peers ^4.3.2 (#4541). zudo-doc 6.1.1 shipped zfb
4.3.3 with peers ^4.3.3 (RUSTSEC-2026-0333 frontmatter parser fix). zudo-doc 6.2.0 shipped zfb 4.5.0 with peers ^4.5.0 (#4569, #4581). zudo-doc 7.0.0 shipped zfb 4.5.2 with peers ^4.5.2. zudo-doc 7.1.0 shipped zfb 4.7.0 with peers ^4.7.0 (4.5.3 by #4602, then 4.5.4 by #4606, then 4.6.0 by #4607, then 4.7.0 by #4612). zudo-doc 8.0.0 shipped zfb 5.0.1 with peers ^5.0.1 (5.0.0 by #4623). zudo-doc 8.1.0 shipped zfb 5.1.2 with peers ^5.1.2 (5.1.0 by #4627, 5.1.1 by #4640, 5.1.2 by #4641). zudo-doc 8.1.1 shipped zfb 5.1.3 with peers ^5.1.3 and zdtp 0.8.7 (#4646). zudo-doc 8.1.2 shipped zfb 5.1.4 with peers ^5.1.4 (#4656), and 8.1.3 kept it. The unreleased workspace moves to zfb 5.1.5 with peers ^5.1.5; zdtp 0.9.0; MCP SDK 1.32.2; root and generated-MCP
Wrangler 4.156.0. The history-server peer floor is ^8.0.0 (raised in the 8.0.0 major; a minimum compatibility
floor — see "First-party peer floor" in `RELEASE.md`). Publication and consumer
evidence: [6.0.0 publication record](docs/findings/4430-zfb3-migration/release-6.0.0/README.md).
The September audit above is historical evidence, not a new dependency/build run.

Wrangler has one source of truth: the exact `devDependencies.wrangler` pin in the root
`package.json`. The deploy/preview workflows run `node scripts/wrangler-pinned.mjs`,
which reads that pin (no separate workflow version literal) and invokes
`npx --yes wrangler@<pin>` without a workspace install;
`scripts/verify-worker-dry-run.mjs` uses the installed `pnpm exec wrangler` from the
same pin.
Core JSX uses zudo-react. Installed zdtp 0.9.0 renders with its own bundled zudo-react
runtime and depends on no Preact (0.8.6–0.8.7 carried Preact as a dependency; through
0.8.5 it was a peer), so the workspace installs no Preact at all. zdtp still owns its
internal Tailwind browser dependency, an intentional panel-only engine mention. Native Wind uses package defaults plus the public wind.json
manifest, and no host Tailwind compiler dependency is required.

### Unreleased KaTeX compatibility floor (#4572)

The root dependency moved to `^0.19.0` (now `^0.19.1`, locked 0.19.1); the optional package
peer becomes `^0.18.2 || ^0.19.0`. The consumer matrix covers 0.18.2, 0.18.11
and 0.19.0, excluding affected versions below 0.18.2 and unreviewed 0.20+.
KaTeX remains absent from generated defaults. Math-enabled hosts import the
installed KaTeX stylesheet before package feature CSS. The lockfile also moves
KaTeX's Commander dependency to 15.0.1, whose engine requires Node >=22.12.0.
That minimum alone does not define the supported runtime. As of 2026-10-14,
[Node's release table](https://nodejs.org/en/about/previous-releases) lists
Node 24 as LTS (latest 24.22.0) and Node 26 as Current (latest 26.12.0);
this workspace, initializer and framework package require Node 24 or later
(`>=24`, with no upper bound since #4614). CI still runs a single Node 24 LTS
lane (`.nvmrc`). Node 26 is no longer refused by `engines` but is not
CI-verified. Removing 0.16 support raises the consumer compatibility floor and
needs breaking-change release review under stable SemVer; widening the Node
range is non-breaking.
No package version is changed or published by this work.
