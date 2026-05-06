/**
 * Public entry for the framework-agnostic footer shell.
 *
 * Consumers import from `@zudo-doc/zudo-doc-v2/footer`:
 *
 *   import { Footer, type FooterProps } from "@zudo-doc/zudo-doc-v2/footer";
 *
 * The shell is purely presentational — see `./types.ts` for the data
 * shapes the host project assembles upstream.
 */

export { Footer } from "./footer";
export type { FooterProps } from "./footer";
export type {
  FooterLinkColumn,
  FooterLinkItem,
  FooterTagColumn,
  FooterTagItem,
} from "./types";
