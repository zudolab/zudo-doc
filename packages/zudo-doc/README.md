# @takazudo/zudo-doc

Framework primitives that sit on top of zfb's engine — the framework layer that zfb deliberately doesn't ship (per ADR-003).

This package provides the missing-by-design framework concerns:

- **Sidebar tree builder** (`./sidebar-tree`) — turns collection entries + `_category_.json` into a sidebar `SidebarNode[]`.
- **Theme controls** (`./theme`) — color scheme provider + design-token tweak panel (Preact island that wraps an iframe).
- **Theme toggle (bare)** (`./theme-toggle`) — the un-wrapped ThemeToggle component for call sites that compose their own `<Island>` (the `./theme` barrel exports an Island-wrapped variant of the same component).
- **TOC** (`./toc`) — desktop and mobile TOC Preact islands fed by MDX `headings` export.
- **Breadcrumb** (`./breadcrumb`) — JSX breadcrumb fed by the sidebar tree.
- **DocLayout** (`./doclayout`) — composable layout shell with explicit `<Header>`, `<Sidebar>`, `<Main>`, `<Toc>`, `<Footer>` props; ships a `<DocLayoutWithDefaults>` wrapper that holds the 16 `create-zudo-doc` injection anchors.
- **View Transitions** (`./transitions`) — native View Transitions API shim (Chrome/Edge/Safari 18+); persistent regions via `view-transition-name`. No-op fallback in Firefox.
- **Head injection** (`./head`) — canonical, og:\*, twitter:\*, robots, preload hints, RSS link, sitemap link, theme-color — byte-equal to today's legacy doc-layout output.
- **SSR-skip wrappers** (`./ssr-skip`) — `<AiChatModalIsland>`, `<ImageEnlargeIsland>`, `<DesignTokenTweakPanelIsland>`, `<MockInitIsland>` — wrap zfb's `<Island ssrFallback>` with the right fallback markup so doc pages don't have to re-implement the SSR-skip pattern.

## Optional peer dependency: shiki

`./html-preview-wrapper`'s `<HighlightedCode>` lazily `import("shiki")`s at runtime for client-side syntax highlighting. `shiki` is declared as an **optional peerDependency** — install it in your project if you use that subpath:

```sh
pnpm add shiki
```

Projects scaffolded by `create-zudo-doc` already include it. If you never render `<HtmlPreview>` / `<HighlightedCode>`, you can omit it.

## ⚠️ HTML preview iframe sandbox — trust assumption

`<HtmlPreview>` / `<HtmlPreviewWrapper>` render their preview inside an `<iframe srcdoc>` whose `sandbox` attribute **defaults** to:

- `allow-scripts allow-same-origin` when the preview contains scripts (a `js` prop or a `<script>` in `head`), or
- `allow-same-origin` when it does not.

**`allow-scripts` + `allow-same-origin` together effectively void the sandbox** — scripts running inside the preview share the parent page's origin and can reach the parent document. This default is intentional and safe for zudo-doc's own use case, where preview content is **author-trusted** MDX. The `allow-same-origin` token is what lets the component auto-measure the iframe body and sync its height.

If your project renders **semi-trusted or user-submitted** HTML in a preview, override the sandbox with a stricter value via the `sandbox` prop:

```tsx
// Maximally restrictive — no script execution, opaque origin
<HtmlPreviewWrapper html={untrustedHtml} sandbox="" height={400} />

// Allow scripts but keep an opaque origin (script can't reach the parent)
<HtmlPreviewWrapper html={untrustedHtml} sandbox="allow-scripts" height={400} />
```

**Caveat:** removing `allow-same-origin` gives the iframe an opaque origin, which blocks the parent from reading `iframe.contentDocument`. That **disables auto-height** — always pair a stricter `sandbox` with a fixed `height`. Passing the empty string `""` is honored verbatim (only omitting the prop falls back to the computed default).

## Styling — Tailwind setup for consumers

This package ships **no precompiled CSS** — the component utility classes are inlined in the `dist/` JavaScript, and Tailwind v4 does not scan `node_modules`. Without help, those utilities never make it into your build, so the components render unstyled.

The fix is to import the package's build-generated safelist into your Tailwind CSS entry, right next to your `@import "tailwindcss";`:

```css
@import "tailwindcss";
@import "@takazudo/zudo-doc/safelist.css";
```

`dist/safelist.css` is generated at package build time and contains an `@source inline()` set covering every utility the components use (including arbitrary-value classes like `w-[var(--zd-sidebar-w)]`). It auto-syncs whenever you upgrade the package — no drift, no manual maintenance. Available in `@takazudo/zudo-doc` **>= 0.2.0**.

> **Don't `@source` into `node_modules`.** A glob like `@source "../node_modules/@takazudo/zudo-doc/dist/**"` looks plausible but is unreliable: pnpm surfaces packages via symlinks and Tailwind v4's file scanner does not reliably traverse them, so utilities get intermittently dropped across rebuilds (see zudolab/zudo-doc#1989). Import the package safelist instead.

**Migrating from a pre-0.2.0 workaround?** If you vendored or copied the package `dist/` to get its styles, delete that workaround and replace it with the single `@import "@takazudo/zudo-doc/safelist.css";` line above.

## Dev workflow (in this repo)

This package is published to npm as `@takazudo/zudo-doc` (since `0.2.0`, `latest` tracks the current line). Inside this repo the host site consumes it as a workspace package through its compiled `dist/` — `pnpm dev` at the repo root runs `tsup --watch` so edits under `src/` rebuild automatically; for a one-off rebuild use `pnpm --filter @takazudo/zudo-doc build`.

zfb itself comes from npm (versions pinned in the root `package.json`). To develop against a local zfb checkout, use the temporary `pnpm.overrides` link escape hatch documented in the root `CLAUDE.md` — do not commit the override.
