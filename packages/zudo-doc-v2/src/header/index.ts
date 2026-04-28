/**
 * Public entry for the JSX `<Header />` port.
 *
 * Consumers import from `@zudo-doc/zudo-doc-v2/header`:
 *
 *   import { Header } from "@zudo-doc/zudo-doc-v2/header";
 *
 * The pure helpers used to compute active-link state are also exposed
 * so downstream tests / custom layouts can reuse them without rebuilding
 * the `pathForMatch` / `computeActiveNavPath` regex logic.
 */

export { Header, type HeaderProps } from "./header.js";
export {
  computeActiveNavPath,
  isNavItemActive,
  pathForMatch,
  type NavItemLike,
} from "./nav-active.js";
export { NAV_OVERFLOW_SCRIPT } from "./nav-overflow-script.js";
