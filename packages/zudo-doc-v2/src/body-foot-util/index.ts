// Barrel for the body-foot-util topic — JSX port of
// `src/components/body-foot-util-area.astro` and its sibling
// `edit-link.astro`. The DocHistory SSR-skip wrapper lives next to the
// area component because it is only ever mounted from there.
export {
  BodyFootUtilArea,
  DEFAULT_VIEW_SOURCE_LABEL,
} from "./body-foot-util-area.js";
export type { BodyFootUtilAreaProps } from "./body-foot-util-area.js";

export { EditLink, DEFAULT_EDIT_LINK_LABEL } from "./edit-link.js";
export type { EditLinkProps } from "./edit-link.js";

export { DocHistoryIsland } from "./doc-history-island.js";
export type { DocHistoryIslandProps } from "./doc-history-island.js";
