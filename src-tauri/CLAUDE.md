# Tauri (two modes)

zudo-doc ships two independent Tauri apps. This file auto-loads when working in
`src-tauri/`; `src-tauri-dev/` is Mode 2 below.

## Mode 1 — Standalone offline reader (`src-tauri/`)

Bundles zudo-doc's own pre-built `dist/` into a self-contained desktop app.

- **Build (shipped product):** `cargo tauri build`
  Embeds `dist/` via `frontendDist`; WebView loads `WebviewUrl::App`. There is no
  `beforeBuildCommand`, so build the embedded `dist/` first — and use
  **`GEN_DOC_HISTORY=1 pnpm build`** so the offline reader includes the per-page
  history-dropdown JSON (postBuild JSON is opt-in for local builds, #1986; a plain
  `pnpm build` would silently ship a `dist/` without it).
- **`cargo tauri dev` (contributor convenience only):**
  Runs `pnpm dev` via `beforeDevCommand` and opens the WebView at
  `http://localhost:4321/` (the zfb dev server). This is NOT a shipped product — it exists
  solely for zudo-doc contributors who want to work on both the Tauri shell and site content
  at the same time. The `beforeDevCommand` / `devUrl` fields in `src-tauri/tauri.conf.json`
  must be kept for this workflow.

## Mode 2 — Configurable dev wrapper for end users (`src-tauri-dev/`)

A standalone Tauri app that any project can use as a desktop dev wrapper. It reads the
target project URL and settings from a per-user config file rather than hard-coding anything.

- **Build (shipped product):** `cd src-tauri-dev && cargo tauri build`
- **Config file (macOS):**
  `~/Library/Application Support/com.takazudo.zudo-doc-dev/config.json`
  (Windows/Linux paths differ; see `src-tauri-dev/` for details.)

## Key distinction

Mode 1 `cargo tauri dev` and Mode 2 are both "dev wrappers" superficially, but they target
completely different audiences. Mode 1 dev is a repo-internal contributor convenience
(hard-coded to this project, not shipped). Mode 2 is a product delivered to end users of
any project (configurable, shipped as a standalone installer).

See `src-tauri/README.md` for the full comparison table and the CSP / capabilities
security hardening notes (zudolab/zudo-doc#2240).
