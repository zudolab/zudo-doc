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

## Pre-publish dev workflow

Phase A npm publish is deferred (see super-epic comment 2026-04-28). During pre-publish dev, this package references zfb via the local checkout at `$HOME/repos/myoss/zfb`. Use `/refer-another-project zfb` to read zfb's APIs. If a zfb bug is discovered, fix it directly on zfb's `main` and push (zfb is not public yet).
