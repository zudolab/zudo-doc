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

## Security hardening (zudolab/zudo-doc#2240)

Both Tauri apps previously shipped `"csp": null` and an over-broad
`remote.urls: ["http://localhost:*/**"]` capability. This was tightened:

### Mode 1 (this directory) — Content Security Policy

`app.security.csp` is now a restrictive policy instead of `null`. The reader
serves only the local `dist/` (via `tauri://`), so the policy locks down
exfiltration vectors (`default-src 'self'`, `connect-src` limited to self +
the two CDNs the content genuinely uses, `object-src 'none'`,
`frame-ancestors 'none'`) while still allowing the doc content to render:

- `script-src … https://esm.sh` — Mermaid is loaded at runtime via
  `import("https://esm.sh/mermaid@11…")` (`packages/zudo-doc/src/code-syntax/mermaid-init-script.ts`).
- `font-src` carries **no** jsdelivr grant — removed by zudolab/zudo-doc#3265.
  KaTeX renders server-side at build time via `katex.renderToString` in
  `packages/zudo-doc/src/math-block/index.tsx`, so no client fonts (or CSS)
  ever load from jsdelivr; the grant was dead weight.
- `script-src` / `style-src … https://cdn.jsdelivr.net` are retained as
  deliberate headroom for the documented `HtmlPreview`
  `externalScripts`/`externalStyles` demo recipe on the `components/html-preview`
  doc page (e.g. the `@tailwindcss/browser` CDN recipe), since a `srcdoc` iframe
  inherits its parent document's CSP.
- `'unsafe-inline'` on `script-src`/`style-src` — the site relies on inline
  pre-paint scripts (sidebar/theme/page-loading) and inline `style=` attributes.
  Exfiltration is still blocked by `connect-src`/`img-src`/`default-src`.
- `api.anthropic.com` is **not** allowlisted: the AI-chat client calls it
  **server-side** (`pages/api/_ai-chat-client.ts`), never from the browser, and
  the offline reader has no server anyway.

> **Verified working inside a built Tauri webview (2026-08-03, tauri-cli 2.10.1,
> macOS).** All four at-risk surfaces pass — see "CSP verification
> (zudolab/zudo-doc#3246)" below for the reproduce recipe, the one real (but
> harmless) violation found, and per-surface verdicts. `bundle.active` is
> `false`, so nothing ships this CSP until a deliberate bundle.

## CSP verification (zudolab/zudo-doc#3246)

**Verified:** 2026-08-03, tauri-cli 2.10.1, macOS.

### How to reproduce it

```sh
GEN_DOC_HISTORY=1 pnpm build

cd src-tauri && cargo tauri build --no-bundle
# launch the binary directly — do NOT go through `cargo tauri dev` or
# `cargo tauri build --debug` (see below for why), and do NOT launch it via
# `cargo run` / `cargo tauri`
open target/release/zudo-doc          # or run the binary path directly
```

**`cargo tauri dev` and `cargo tauri build --debug` do not verify this.**
`src-tauri/src/main.rs` sets `const IS_DEV: bool = cfg!(debug_assertions)` and
branches on it: any debug build (`dev`, or `build --debug`) opens
`WebviewUrl::External("http://localhost:4321/")` — the zfb dev server over
plain `http://` — never the embedded `frontendDist`. Only a **release** build
(`cargo tauri build`, no `--debug`) uses `WebviewUrl::default()`, which serves
the bundled `../dist` over the `tauri://` app protocol where the shipped CSP
and Tauri's nonce injection actually apply. This is the trap that made the
whole verification epic necessary — a dev run "working" proves nothing about
the CSP.

**Why the recipe above needs no icon workaround anymore (#3264, resolved by
#3287).** `tauri::generate_context!()` panics without `icons/icon.png` even
with `bundle.icon: []` and `bundle.active: false` — the empty `icon` array
does not exempt it. It must be an **RGBA PNG**: Tauri's icon decoder panics on
RGB/grayscale/indexed color types. This directory used to have no committed
`icons/`, so the reproduce recipe had to copy `src-tauri-dev/icons/icon.png`
in before building and delete it afterward. `icons/icon.png` is now committed
here, so that copy/delete workaround is gone.

The committed icon is **generated**, not copied from `src-tauri-dev/` — it is
the square variant of the AutoLogo design (`packages/zudo-doc/src/auto-logo/icon.ts`,
`shapes-square.ts`), rasterized to a 1024×1024 RGBA PNG with the seed
`"zudo-doc"` (this repo's `siteName`), which selects the "bookmark" glyph.
Regenerate it after any auto-logo geometry/color change with:

```sh
pnpm build:workspace && node scripts/gen-tauri-icon.mjs
```

`build:workspace` first is required — `scripts/gen-tauri-icon.mjs` imports the
compiled `packages/zudo-doc/dist/auto-logo/icon.js`, and the workspace-build
guard used elsewhere in this repo only checks that `dist/` exists, not that
it's fresh. The rasterizer uses the already-installed `@playwright/test`
Chromium (no native image deps added) and hard-asserts the output is a fully
opaque RGBA PNG before writing it — see the script's own comments for why a
plain Chromium screenshot isn't enough (it silently drops the alpha channel
for fully-opaque content). Committing the PNG is a manual, non-CI step, same
policy as the Mode 2 stock icon: Playwright's rendered PNG bytes aren't stable
across Chromium versions, so this is not a build step or a CI byte-parity
check — regenerate and re-commit by hand when the source SVG changes.

### Surfaces checked and verdicts

| Surface | Verdict |
|---|---|
| Code highlighting | PASS — computed styles on `hi-*` classes return real distinct `oklch(...)` colors, so the `--zd-syntax-*` token CSS survives `style-src`. |
| KaTeX | PASS — and the epic's premise was wrong: `MathBlock` renders KaTeX **server-side at build time** (`packages/zudo-doc/src/math-block/index.tsx`); the site never loads `katex.min.css` or its webfonts from jsdelivr. Identical behavior confirmed in a plain Chromium browser against the same `dist/`, so this was never a CSP/Tauri-specific concern — the dead `font-src` jsdelivr grant was subsequently dropped (zudolab/zudo-doc#3265/#3275). |
| Mermaid | PASS, with one real violation on record: `style-src-attr`/`style-src-elem` block inline `style=""` writes from `esm.sh/d3-selection` and `esm.sh/mermaid` — Tauri's nonce injection neutralizes `'unsafe-inline'` for those sub-directives. This is the epic's predicted failure, landing on **style** rather than **script**. It causes no visible defect: colored-shape ratio and diagram geometry match a plain-browser rendering of the same `dist/` exactly. |
| Sidebar + theme pre-paint | PASS — no `script-src` violations anywhere. Verified with a seeded non-default state (light theme against a dark OS, sidebar collapsed): a full app quit + relaunch showed the correct state already applied in the DOM at `PageLoadEvent::Finished`, before the window is shown, and an 8-frame rapid capture showed no flash. |

No CSP change was made — #3249 (fix-forward) closed as a no-op because every
surface passed. The policy stands exactly as written in #2240/#2312.

### Capabilities — `remote.urls`

`capabilities/default.json` dropped the `remote` block. The shipped reader uses
`tauri://` and needs no remote grant; `cargo tauri dev` loads `localhost:4321`
but the doc site invokes no Tauri commands, so it needs none either.

### Mode 2 (`../src-tauri-dev/`) — `withGlobalTauri` trust assumption

Mode 2 keeps `withGlobalTauri: true` and its localhost `remote.urls` grant
because its own `frontend/index.html` requires them (it listens for
`launch-error` events and invokes the `retry_launch` command via
`window.__TAURI__`). Disabling either would break the wrapper's error/retry UI.
The residual risk — a malicious dependency in the *wrapped* project gaining
Tauri reach — is documented as an accepted trust assumption in
`../src-tauri-dev/capabilities/default.json` (only point Mode 2 at trusted
projects). A future hardening could split the local-frontend capability from the
remote-project one so the wrapped site inherits no command access.
