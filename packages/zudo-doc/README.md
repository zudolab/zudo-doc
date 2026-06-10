# @takazudo/zudo-doc

Framework primitives that sit on top of zfb's engine — the framework layer that zfb deliberately doesn't ship (per ADR-003).

This package provides the missing-by-design framework concerns:

- **Sidebar tree builder** (`./sidebar-tree`) — turns collection entries + `_category_.json` into a sidebar `SidebarNode[]`.
- **Theme controls** (`./theme`) — color scheme provider + design-token tweak panel (Preact island that wraps an iframe).
- **TOC** (`./toc`) — desktop and mobile TOC Preact islands fed by MDX `headings` export.
- **Breadcrumb** (`./breadcrumb`) — JSX breadcrumb fed by the sidebar tree.
- **DocLayout** (`./doclayout`) — composable layout shell with explicit `<Header>`, `<Sidebar>`, `<Main>`, `<Toc>`, `<Footer>` props; ships a `<DocLayoutWithDefaults>` wrapper that holds the 16 `create-zudo-doc` injection anchors.
- **View Transitions** (`./transitions`) — native View Transitions API shim (Chrome/Edge/Safari 18+); persistent regions via `view-transition-name`. No-op fallback in Firefox.
- **Head injection** (`./head`) — canonical, og:\*, twitter:\*, robots, preload hints, RSS link, sitemap link, theme-color — byte-equal to today's legacy doc-layout output.
- **SSR-skip wrappers** (`./ssr-skip`) — `<AiChatModalIsland>`, `<ImageEnlargeIsland>`, `<DesignTokenTweakPanelIsland>`, `<MockInitIsland>` — wrap zfb's `<Island ssrFallback>` with the right fallback markup so doc pages don't have to re-implement the SSR-skip pattern.

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
