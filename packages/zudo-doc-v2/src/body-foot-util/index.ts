// Barrel for the body-foot-util topic — JSX port of
// `src/components/body-foot-util-area.astro` and its sibling
// `edit-link.astro`.
//
// Wave 8 (super-epic #1333 / child epic #1355) dropped the local
// DocHistoryIsland SSR-skip wrapper that used to live next to the area
// component. The host now passes a pre-built `<Island ssrFallback>`
// VNode (rendering the real DocHistory component) into
// `BodyFootUtilArea#docHistoryIsland` so zfb's island scanner can walk
// the page → real-component import chain. See
// `pages/lib/_doc-history-area.tsx` for the canonical composition.
export {
  BodyFootUtilArea,
  DEFAULT_VIEW_SOURCE_LABEL,
} from "./body-foot-util-area.js";
export type { BodyFootUtilAreaProps } from "./body-foot-util-area.js";

export { EditLink, DEFAULT_EDIT_LINK_LABEL } from "./edit-link.js";
export type { EditLinkProps } from "./edit-link.js";
