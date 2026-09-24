# Dependency audit: retain used packages and lock the formatter

Audited 2026-09-24 against `50cbd5c6c`: the root, all four pnpm workspace
packages, both Tauri applications, and their scaffold manifests. Detectors were
`depcheck` 1.4.7 and `cargo machete --with-metadata`; their output was checked
against imports, scripts, compiler configuration, and framework peers.

## Removed one duplicate resolution; no direct dependencies removed

Adding the already-used formatter to the root dev dependencies caused pnpm to
consolidate `lru-cache`: `path-scurry@2.0.2` now resolves `11.5.2`, already used
by jsdom, instead of `11.2.7`. This is a transitive version change, not merely
a deleted declaration. The lockfile has **458 package records, down from 459**.
No production dependency declarations or Rust dependencies changed.

The full `pnpm dedupe --check` could not complete: pnpm rejected
`chokidar@4.0.3` with `ERR_PNPM_TRUST_DOWNGRADE`. Trust checks were not disabled.
The scoped formatter install used the existing offline store; no claim is made
that all remaining duplicate versions have been eliminated.

## Root formatting now uses the declared, locked version

Root formatting scripts and the pre-commit hook previously ran
`pnpm dlx @takazudo/mdx-formatter`. They now use `pnpm exec mdx-formatter`,
with an exact root dev dependency of `1.3.0-next.4`. The old command and the
workspace-installed binary both reported that version during the audit.

The same pin intentionally remains in `packages/zudo-doc`: its tests import
the formatter directly. Root scripts and package tests each declare their own
consumer relationship. This adds no unique formatter package to the lockfile.

## Keep dependencies with real consumers

| Dependency | Evidence and decision |
| --- | --- |
| `@types/minimist` in `packages/zudo-doc` | Only `bin/zudo-doc.mjs` imports minimist, outside the checked TS files. Keep for editor typing of that live JS CLI; the scaffold's TS CLI also retains its own declaration, so removal would save zero packages. |
| `minimist`, `fs-extra`, `picocolors` | Live CLI, scaffolding, eject, theme, and audit consumers. No handwritten replacements attempted. |
| `diff`, `katex`, `@takazudo/zdtp`, `@takazudo/zfb-md-wasm` | Framework peer contracts enable history comparison, math, design-token controls, and browser highlighting. Imports alone are not a sufficient removal oracle. |
| `preact`, `zod`, zfb packages | Required runtime/schema/engine contracts; the Cloudflare adapter also has a direct import in `pages/api/ai-chat.tsx`. |
| `preact-render-to-string`, `vite` | Direct browser-embed fixture imports. These are not obsolete renderer/build dependencies. |
| `pluralize`, `@types/pluralize`, `culori`, `@types/culori` | Tag tests and contrast tooling import these directly. Retention elsewhere does not replace a direct declaration. |
| `@takazudo/zudo-design-token-lint`, `html-validate`, `wrangler` | Depcheck false positives: binary names and script/CI consumers differ from import usage. |
| `minisearch` in `packages/search-worker` | Direct import in `src/search.ts`; the optional search Worker still needs it even though default site search does not. |
| `parse5`, `smol-toml`, `yaml`, `esbuild`, `tsx`, `@inquirer/prompts` | Package-owned parsing, resource generation, bundling, TS CLI execution, and interactive CLI consumers. |
| `tauri-build` | Cargo-machete flags both applications and both templates, but all four `build.rs` files call `tauri_build::build()`. Keep. |
| `tauri`, `open`, `libc`, `serde`, `serde_json` | Direct Rust consumers, including subprocess cleanup and configuration parsing. No platform behavior changes attempted. |

## Keep scope and detector limits explicit

- Published-package runtime dependencies were not modified. Replacing a library
  or changing a framework feature requires a separate behavioral evaluation.
- Node type versions differ intentionally between package toolchains; framework
  peer/dev pins and root/scaffold engine pins also serve distinct consumers.
- Depcheck reports virtual modules, Preact's React aliases, package self-imports,
  and scaffold-template imports as missing. Package tests also consume root
  workspace tooling (`vite`, `culori`, and framework fixtures); this audit did
  not redesign test dependency ownership.
- Do not add the raw detectors as blocking CI checks: the verified false
  positives need a maintained configuration first.
- CI's pinned `npx wrangler@4.111.0` deployment commands and the exam's
  `npx playwright test` were inventoried but not changed. Deployment workflow
  consolidation is separate from root formatter ownership.
- The parent commit's Production Deploy run was green. Rust targets were
  inspected, not rebuilt, because no Rust changes were made.

## Verification preserves generated assets and exercises the new resolution

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
