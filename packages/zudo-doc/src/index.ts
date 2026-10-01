/**
 * @takazudo/zudo-doc — framework primitives that sit on top of zfb's engine.
 *
 * **Use the subpath exports for runtime imports.** This root barrel exposes
 * shared public types only, so consumers do not drag in runtime code when they
 * need type contracts. Each topic area publishes its own subpath (declared in
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

export type {
  ChromeContext,
  ChromeHostBindings,
  FactoryComponent,
  FactoryComponents,
  FactoryContext,
  FactoryI18n,
  NavSource,
  RouteContext,
  RouteContextPayload,
  RouteHrefBuilder,
  TagInfo,
} from "./factory-context/index.js";
export type {
  BodyEndIslandsSlotProps,
  BreadcrumbSlotProps,
  ChromeBindingsInput,
  DesignTokenPanelBootstrapSlotProps,
  DocHistorySlotProps,
  DocPagerSlotProps,
  FooterSlotProps,
  FooterTagEntry,
  FrontmatterRendererSlotProps,
  HeaderSlotProps,
  SearchWidgetSlotProps,
  SidebarSlotProps,
  TocSlotProps,
} from "./chrome-bindings.js";
export type {
  HeaderNavChildItem,
  HeaderNavItem,
  HeaderRightBuiltinComponentName,
  HeaderRightComponentItem,
  HeaderRightComponentName,
  HeaderRightComponentProps,
  HeaderRightComponentRegistry,
  HeaderRightHtmlItem,
  HeaderRightItem,
  HeaderRightLinkItem,
  HeaderRightTriggerItem,
  HeaderRightTriggerName,
  Locale,
} from "./header/types.js";
export type { HeaderRightItemFlags } from "./header/right-items.js";
export type {
  FrontmatterCellRenderer,
  FrontmatterCellRendererProps,
} from "./metainfo/frontmatter-preview.js";
export type {
  ThemePackDialogComponent,
  ThemePackDialogProps,
} from "./theme-pack-switcher/index.js";
export type { ModalDialogOptions, ModalDialogResult } from "./use-modal-dialog/index.js";
export type {
  ChatMessage,
  DocHistoryData,
  DocHistoryEntry,
  EnlargeDialogProps,
} from "./island-types/index.js";
