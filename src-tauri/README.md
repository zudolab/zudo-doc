# src-tauri — Mode 1: Standalone Offline Reader

This directory is **Mode 1** of the two-mode Tauri setup. It produces a self-contained
desktop app that bundles zudo-doc's own pre-built static `dist/` directory. End users can
read the documentation offline without running any server.

## Commands

### Build the standalone app (the shipped product)

```sh
cargo tauri build
```

Bundles the files in `../dist/` into a `.app` (macOS), `.exe` (Windows), or AppImage
(Linux). The WebView loads `WebviewUrl::App`, which maps directly to the embedded
`frontendDist` (`../dist`).

Run `pnpm build` first to populate `dist/` if it is stale. For the shipped
offline reader, build with **`GEN_DOC_HISTORY=1 pnpm build`** so the per-page
doc-history dropdown JSON (`dist/doc-history/*.json`) is included — that
postBuild generation is opt-in for local builds (#1986), and a plain
`pnpm build` would embed a `dist/` without it, silently dropping the history
widget from the offline app. (The Created/Updated/Author block comes from the
preBuild meta and is present either way.)

### Contributor dev convenience (NOT a shipped product)

```sh
cargo tauri dev
```

This is a **repo-internal shortcut for zudo-doc contributors**. It:

1. Runs `pnpm dev` via `beforeDevCommand` (starts the zfb dev server on port 4321).
2. Opens the WebView pointed at `devUrl` (`http://localhost:4321/`) instead of embedded
   files.

This makes it easy to iterate on both the Tauri shell and the zudo-doc web content at the
same time. It is NOT a separate shipped product — it is a convenience wrapper for
contributors. The `beforeDevCommand` / `devUrl` fields in `tauri.conf.json` exist solely
for this workflow and must be kept for contributor convenience.

## Disambiguation: Mode 1 dev vs. Mode 2

Both `cargo tauri dev` (Mode 1) and Mode 2 are "dev wrappers" in a loose sense, but they
serve completely different audiences:

| | Mode 1 `cargo tauri dev` | Mode 2 (`src-tauri-dev/`) |
|---|---|---|
| Audience | zudo-doc repo contributors | End users of any project |
| Hard-coded project | Yes — always opens zudo-doc | No — reads project URL from config |
| Config file | None | `~/Library/Application Support/com.takazudo.zudo-doc-dev/config.json` (macOS) |
| Shipped as a product | No | Yes |
| Build command | `cargo tauri dev` | `cd src-tauri-dev && cargo tauri build` |

For the shipped configurable dev wrapper, see `../src-tauri-dev/`.

## tauri.conf.json notes

- `frontendDist: "../dist"` — used by `cargo tauri build` to embed the static site.
- `beforeDevCommand: "pnpm dev"` — starts the zfb dev server for `cargo tauri dev`
  contributor convenience. Keep this field; do not remove it.
- `devUrl: "http://localhost:4321/"` — the URL the WebView opens in `cargo tauri dev` mode.
  Keep this field alongside `beforeDevCommand`.
- `bundle.active: false` — bundling is opt-in; pass `--bundles` flags to `cargo tauri build`
  when creating distributable installers.
