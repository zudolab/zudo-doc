# Changelog

All notable changes to `create-zudo-doc` are documented in this file.

The format is based on Keep a Changelog, and release notes are generated from the changelog MDX pages.

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
