/**
 * Public entry for `@zudo-doc/zudo-doc-v2/content`.
 *
 * Exports the 11 MDX typography override components and the pre-assembled
 * component map. Consumers compose the map at the Astro page layer:
 *
 *   import { defaultComponents } from "@zudo-doc/zudo-doc-v2/content";
 *
 *   const components = {
 *     ...defaultComponents,
 *     Note,
 *     Tip,
 *     // ... admonitions, shortcodes, etc.
 *   };
 *
 *   <Content components={components} />
 */

// Components
export { HeadingH2 } from "./heading-h2.js";
export { HeadingH3 } from "./heading-h3.js";
export { HeadingH4 } from "./heading-h4.js";
export { ContentParagraph } from "./content-paragraph.js";
export { ContentLink } from "./content-link.js";
export { ContentStrong } from "./content-strong.js";
export { ContentBlockquote } from "./content-blockquote.js";
export { ContentUl } from "./content-ul.js";
export { ContentOl } from "./content-ol.js";
export { ContentTable } from "./content-table.js";
export { ContentCode } from "./content-code.js";

// Component map
export { htmlOverrides, defaultComponents } from "./component-map.js";
