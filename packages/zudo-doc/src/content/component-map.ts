import { HeadingH2 } from "./heading-h2.js";
import { HeadingH3 } from "./heading-h3.js";
import { HeadingH4 } from "./heading-h4.js";
import { ContentParagraph } from "./content-paragraph.js";
import { ContentLink } from "./content-link.js";
import { ContentStrong } from "./content-strong.js";
import { ContentBlockquote } from "./content-blockquote.js";
import { ContentUl } from "./content-ul.js";
import { ContentOl } from "./content-ol.js";
import { ContentTable } from "./content-table.js";
import { ContentCode } from "./content-code.js";

/**
 * MDX component overrides map for the HTML elements used in doc content.
 *
 * Pass this to `<Content components={defaultComponents} />` (or spread it
 * into a larger components object that also includes admonition overrides,
 * custom shortcodes, etc.) at the Astro page layer.
 */
export const htmlOverrides = {
  h2: HeadingH2,
  h3: HeadingH3,
  h4: HeadingH4,
  p: ContentParagraph,
  a: ContentLink,
  strong: ContentStrong,
  blockquote: ContentBlockquote,
  ul: ContentUl,
  ol: ContentOl,
  table: ContentTable,
  code: ContentCode,
};

/**
 * Alias for `htmlOverrides`. Prefer this name in new consumer code.
 */
export const defaultComponents = htmlOverrides;
