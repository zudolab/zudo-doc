/**
 * @zudo-doc/zudo-doc-v2 — framework primitives that sit on top of zfb's engine.
 *
 * **Use the subpath exports for actual imports.** This root barrel deliberately
 * stays empty so consumers don't drag in the entire framework when they only
 * need one piece. Each topic area publishes its own subpath (declared in
 * `package.json#exports`):
 *
 *   import { buildSidebarTree, type SidebarNode } from "@zudo-doc/zudo-doc-v2/sidebar-tree";
 *   import { DocHead, type HeadProps }              from "@zudo-doc/zudo-doc-v2/head";
 *   import { Toc, MobileToc }                       from "@zudo-doc/zudo-doc-v2/toc";
 *   import { Breadcrumb }                           from "@zudo-doc/zudo-doc-v2/breadcrumb";
 *   import { DocLayout, DocLayoutWithDefaults }     from "@zudo-doc/zudo-doc-v2/doclayout";
 *   import { ColorSchemeProvider, ThemeToggle }     from "@zudo-doc/zudo-doc-v2/theme";
 *   import { startViewTransition, sidebarPersistName } from "@zudo-doc/zudo-doc-v2/transitions";
 *   import { initSidebarResizer }                      from "@zudo-doc/zudo-doc-v2/sidebar-resizer";
 *
 * The SSR-skip wrapper subpath (`@zudo-doc/zudo-doc-v2/ssr-skip`) was
 * removed in Wave 8 (super-epic #1333 / child epic #1355). Hosts now
 * compose body-end islands directly with zfb's native `<Island
 * ssrFallback>` API so the page → real-component import chain stays
 * walkable by zfb's island scanner.
 *
 * See packages/zudo-doc-v2/README.md for the topic map.
 */

export {};
