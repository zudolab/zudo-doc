/**
 * Public entry for the framework-agnostic footer shell.
 *
 * Consumers import from `@takazudo/zudo-doc/footer`:
 *
 *   import { Footer, type FooterProps } from "@takazudo/zudo-doc/footer";
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
