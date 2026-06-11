export { Toc } from "./toc.js";
export type { TocProps } from "./toc.js";
export { MobileToc } from "./mobile-toc.js";
export type { MobileTocProps } from "./mobile-toc.js";
export { useActiveHeading, getActiveHeadingId } from "./use-active-heading.js";
export type { UseActiveHeadingResult } from "./use-active-heading.js";
export type { HeadingItem } from "./types.js";
// Exposed so consumers wiring their own scanner-visible Toc/MobileToc shims
// (the override pattern from zudolab/zudo-doc#2057) can derive the locale TOC
// label from the page `lang` without hand-mirroring the lang→title map.
export { getTocTitle } from "./toc-title.js";
