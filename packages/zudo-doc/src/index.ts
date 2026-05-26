/**
 * @takazudo/zudo-doc — framework primitives that sit on top of zfb's engine.
 *
 * **Use the subpath exports for actual imports.** This root barrel deliberately
 * stays empty so consumers don't drag in the entire framework when they only
 * need one piece. Each topic area publishes its own subpath (declared in
 * `package.json#exports`):
 *
 *   import { buildSidebarTree, type SidebarNode } from "@takazudo/zudo-doc/sidebar-tree";
 *   import { DocHead, type HeadProps }              from "@takazudo/zudo-doc/head";
 *   import { Toc, MobileToc }                       from "@takazudo/zudo-doc/toc";
 *   import { Breadcrumb }                           from "@takazudo/zudo-doc/breadcrumb";
 *   import { DocLayout, DocLayoutWithDefaults }     from "@takazudo/zudo-doc/doclayout";
 *   import { ColorSchemeProvider, ThemeToggle }     from "@takazudo/zudo-doc/theme";
 *   import { startViewTransition, sidebarPersistName } from "@takazudo/zudo-doc/transitions";
 *   import { initSidebarResizer }                      from "@takazudo/zudo-doc/sidebar-resizer";
 *
 * The SSR-skip wrapper subpath (`@takazudo/zudo-doc/ssr-skip`) was
 * removed in Wave 8 (super-epic #1333 / child epic #1355). Hosts now
 * compose body-end islands directly with zfb's native `<Island
 * ssrFallback>` API so the page → real-component import chain stays
 * walkable by zfb's island scanner.
 *
 * See packages/zudo-doc/README.md for the topic map.
 */

export {};
