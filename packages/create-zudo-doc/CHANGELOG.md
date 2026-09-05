# Changelog

All notable changes to `create-zudo-doc` are documented in this file.

The format is based on Keep a Changelog, and release notes are generated from the changelog MDX pages.

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
