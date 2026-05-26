/**
 * Public entry for the JSX `<Header />` port.
 *
 * Consumers import from `@takazudo/zudo-doc/header`:
 *
 *   import { Header } from "@takazudo/zudo-doc/header";
 *
 * The pure helpers used to compute active-link state are also exposed
 * so downstream tests / custom layouts can reuse them without rebuilding
 * the `pathForMatch` / `computeActiveNavPath` regex logic.
 */

export type {
  Locale,
  HeaderNavChildItem,
  HeaderNavItem,
  HeaderRightComponentItem,
  HeaderRightComponentName,
  HeaderRightHtmlItem,
  HeaderRightItem,
  HeaderRightLinkItem,
  HeaderRightTriggerItem,
  HeaderRightTriggerName,
} from "./types.js";
export {
  filterHeaderRightItems,
  type HeaderRightItemFlags,
} from "./right-items.js";
export { Header, type HeaderProps } from "./header.js";
export {
  computeActiveNavPath,
  isNavItemActive,
  pathForMatch,
  type NavItemLike,
} from "./nav-active.js";
export { NAV_OVERFLOW_SCRIPT } from "./nav-overflow-script.js";
