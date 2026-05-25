// Public surface for the `@zudo-doc/zudo-doc-v2/doclayout` entry.
//
// Two layouts ship from this barrel:
//
//   - `<DocLayout>`         — pure composable shell. Consumer fills every
//                             slot. No coupling to sibling topics.
//   - `<DocLayoutWithDefaults>` — wraps `<DocLayout>` and carries the 16
//                                 `create-zudo-doc` injection anchors.
//                                 Consumers who only need to override one
//                                 slot reach for this.
//
// The anchors module is re-exported as well so the `create-zudo-doc`
// drift checker has a single import path to depend on.

export { DocLayout, DESKTOP_SIDEBAR_ID } from "./doc-layout.js";
export type {
  DocLayoutProps,
  DocLayoutHtmlAttrs,
} from "./doc-layout.js";

export { DocLayoutWithDefaults } from "./doc-layout-with-defaults.js";
export type { DocLayoutWithDefaultsProps } from "./doc-layout-with-defaults.js";

export {
  DOC_LAYOUT_ANCHORS,
  DOC_LAYOUT_ANCHOR_IDS,
  allAnchorComments,
  anchorComment,
} from "./anchors.js";
export type {
  DocLayoutAnchor,
  DocLayoutAnchorId,
  DocLayoutAnchorKind,
} from "./anchors.js";
