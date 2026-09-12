# Changelog

All notable changes to `create-zudo-doc` are documented in this file.

The format is based on Keep a Changelog, and release notes are generated from the changelog MDX pages.

## [Unreleased]

No unreleased changes.

## [5.22.1] - 2026-09-13

### Other Changes

- Updated generated Design Token Panel projects to use `@takazudo/zdtp` 0.8.0. (81c6571e)

## [5.22.0] - 2026-09-11

### Features

- Generated projects pin `@takazudo/zudo-doc` and `@takazudo/zudo-doc-history-server` at `^5.22.0`. Hosts can edit `docMetainfoFields` and `docHistoryUi` in `zfb.config.ts` to select metadata fields and retain dates without the history viewer. The generated config retains package defaults; no new CLI flags were added. (`06044fa30`)

## [5.21.0] - 2026-09-09

### Features

- Generated projects pin `@takazudo/zudo-doc` and `@takazudo/zudo-doc-history-server` at `^5.21.0`, so a fresh scaffold can add a home-page `introMarkdown` / `sitemapHeading` to its `zfb.config.ts` by hand. There is no new CLI flag — the emitted config keeps the package defaults and stays diff-from-defaults. (`77ed96b3f`)

## [5.20.0] - 2026-09-09

### Bug Fixes

- Made the generated documentation-skill setup script work on stock macOS Bash 3.2 and corrected its locale/config handling, including checking that the documentation symlink exists before emitting locale guidance. (`85b603e33`, `f6b699fe0`)
- Fixed the generated link checker to recognize IDs and links when quoted attributes contain `>`, and reduced repeated scanning by parsing each page once. (`0e52271b9`, `7c0144e51`)

### Other Changes

- Updated the Design Token Panel feature's emitted `@takazudo/zdtp` pin to `0.7.0`. Fresh scaffolds use the compatible panel integration without a migration. (`e0fc27fbd`, `9554dbbea`)

## [5.19.1] - 2026-09-08

### Other Changes

- A generated project's `package.json` now pins `@takazudo/zfb`, `@takazudo/zfb-runtime`, and `@takazudo/zfb-md-wasm` at `2.16.0`, and `@takazudo/zdtp` at `0.5.2` when the Design Token Panel feature is enabled (`47c149385`). Both upstream releases are drop-in for a fresh scaffold — zfb 2.16.0 fixes an `ETXTBSY` crash when first executing a just-written esbuild binary, zdtp 0.5.2 is additive — so no public API, export, config default, or engine requirement moves and a fresh scaffold needs no migration.

## [5.19.0] - 2026-09-07

### Features

- The first positional argument is now a **destination path**, not just a project name. `create-zudo-doc sub/ref-doc` creates `sub/ref-doc` and derives the project name from the final segment (`ref-doc`); previously it failed with a project-name validation error because the one argument meant both the directory to create and the name written into the generated `package.json`. Relative (`../ref-doc`) and absolute destinations are accepted; `.`, `..`, and a filesystem root are rejected because they name no final segment. `--name` still takes a bare package name and now acts as an explicit override of the derived name while the positional continues to supply the directory. The resolved destination is followed consistently by dependency install, `git init`, and the printed `cd <dest>` hint. The programmatic `CreateOptions` API is unchanged — there `projectName` still doubles as the directory. (5a928d51e)

### Bug Fixes

- The printed `cd` target is quoted when the destination contains whitespace, which a path destination may now legally do, and an empty destination no longer resolves the target directory to the current working directory. (134248eba)

### Other Changes

- The EN and JA `create-zudo-doc` reference pages and the package README document the destination argument: an accepted-forms table, both verbatim error messages, the `--name` override, a scaffolding-into-a-subdirectory example, and a note that the programmatic API has no `destination`. (dc83c4615)

## [5.18.2] - 2026-09-06

### Bug Fixes

- `@takazudo/zdtp` is added to a generated project only when the Design Token Panel is enabled. It had been an unconditional direct dependency of every scaffold — which is how generated projects avoided the `@takazudo/zudo-doc` bundling bug fixed in this same release — so every project without the panel installed and carried a package it never used. With that bug fixed upstream, the dependency is now gated on `designTokenPanel`. (a93ff2293)
- Six feature flags now default on, matching the FEATURES catalog: `--sidebar-resizer`, `--sidebar-toggle`, `--toc-toggle`, `--doc-history`, `--llms-txt`, and `--asset-viewer`. A scaffold created without explicit flags now includes these features; pass the matching `--no-` flag to opt out. (6d0d3bfb9)

### Other Changes

- The CLI reference table was contradicted by the change above and has been corrected: the default column now matches the catalog, and the previously-missing `--[no-]asset-viewer` row was added in catalog position. The package README's feature list was corrected the same way. (c908f7f9a, f006d4ada)

## [5.18.1] - 2026-09-06

### Other Changes

- Generated projects now pin `@takazudo/zdtp` at `0.5.1` (was `0.5.0`). A newly scaffolded project picks up zdtp's panel-width, header-overflow, and doc-adoption fixes, plus the persisted `spawn-ordinal` storage key that keeps multiple panels in stable cascade positions across client-side navigation. (4a72db50d)
- Generated projects inherit the page-loading spinner contrast fix through `@takazudo/zudo-doc@^5.18.1` — see that package's 5.18.1 notes for the new `--color-page-loading-spinner` token and the reduced-motion change. (4fa1651b2)

## [5.18.0] - 2026-09-06

### Other Changes

- A generated project now pins `@takazudo/zdtp` at `0.5.0` (was `0.4.14`), matching the peer requirement of the `@takazudo/zudo-doc` released alongside it (`a55182f9c`).

## [5.17.2] - 2026-09-05

### Bug Fixes

- Prevent generated documentation-skill setup scripts from overwriting real files or directories when creating symlinks (`559e7a1`)
- Detect locale settings inside spread `zudoDoc(...)` configurations when generating documentation skills (`c1658c9`)

## [5.17.1] - 2026-09-04

### Other Changes

- Newly generated projects now use the zfb 2.15.1 package family (`e54438e96`). This is a documentation-only upstream release with no behavior change — the shipped wasm artifacts are byte-size identical to 2.15.0 and a fresh scaffold needs no migration.

## [5.17.0] - 2026-09-04

### Features

- `check-links` now reports protocol-relative hrefs (`//host/path`) as informational notices rather than passing over them silently (`67afa352f`).

### Bug Fixes

- `check-links` no longer treats protocol-relative URLs (`//host/path`) as broken local links (`319169bf3`).

### Other Changes

- Newly generated projects now use the zfb 2.15.0 package family (`d9f5b2f64`). `ts` and `typescript` code fences resolve to the TypeScript grammar and `tsx` to TypeScriptReact, where both previously fell back to JavaScript highlighting.

## [5.16.2] - 2026-09-03

- No package-specific changes.

## [5.16.1] - 2026-09-02

### Other Changes

- Newly generated projects now use the zfb 2.14.3 package family. (`7e79f961a`)

## [5.16.0] - 2026-09-02

- No package-specific changes.

## [5.15.0] - 2026-09-01

### Features

- Added one ordered locale-plan contract across the API, CLI, presets, prompts, scaffold output, and generated guidance, allowing new projects to select and emit any supported set of locales. (`10e34ca0`, `5a990248`, `c9543772`)

### Bug Fixes

- Newly generated multi-locale projects now localize generated Claude/Codex resource routes by default instead of keeping them limited to the default locale. (`26ecad11`)

### Other Changes

- Updated newly generated projects to use the zfb 2.14.2 package family. (`1c1f8f26`)

## [5.14.0] - 2026-08-31

### Features

- Added the `--asset-viewer` feature flag. Generated projects now emit `assetViewer: true` in `zfb.config.ts`, enabling the package-owned viewer for files under `public/assets/` without adding a host route stub or extra template files. (`45dc50cdb`)
- Generated doc-history projects now use the package-owned `run-parallel` command for their concurrent development servers, removing `npm-run-all2` and reporting unsupported trailing arguments instead of silently ignoring them. (`9402ff157`, `3ebfa6e9c`)

### Bug Fixes

- Updated the generated link checker to recognize valid unquoted HTML attributes, decode character references, resolve percent-encoded routes, and avoid serialized-markup false positives. (`db9a07018`)

### Other Changes

- Updated newly generated projects to use the zfb 2.14.0 package family and `@takazudo/zdtp` 0.4.14. (`dbe8553c7`, `038870c94`)

## [5.13.1] - 2026-08-28

### Bug Fixes

- Stopped scaffolding the unused `minisearch` and `pagefind` dependencies into search-enabled projects. Search is served by zudo-doc's own generated search-widget script, so neither package was ever loaded. (`7915fe55`)
- Renamed the search feature from "Pagefind search" to "Full-text search" in the CLI prompt, the generated CLAUDE.md, and the README flag table, which no longer describe an integration the generated project does not use. The `search` feature key and its `--[no-]search` flag are unchanged. (`7915fe55`)

### Other Changes

- Updated newly generated projects to use the zfb 2.13.1 package family. (`c36fd4d0`)

## [5.13.0] - 2026-08-27

### Other Changes

- Updated newly generated projects to the zfb 2.12.0 package family, including its standalone CSS compiler and abort-safe client-router swap behavior. (`9cf3fd4b`)

## [5.12.1] - 2026-08-24

### Other Changes

- Updated newly generated projects to use the zfb 2.10.1 package family. (`e995a459`)

## [5.12.0] - 2026-08-23

- No package-specific changes.

## [5.11.0] - 2026-08-23

### Other Changes

- Updated newly generated projects to use the zfb 2.10.0 package family and the 5.11.0 zudo-doc package family. (`acaa01cf`)
