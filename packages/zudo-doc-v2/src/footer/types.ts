/**
 * Public types for the framework-agnostic footer shell.
 *
 * The original Astro `footer.astro` mixed three concerns:
 *   1. Reading `settings.footer` and applying locale overrides.
 *   2. Loading the docs collection + tag vocabulary to build the
 *      optional taglist columns.
 *   3. Rendering the footer markup.
 *
 * Concerns (1) and (2) depend on host-side helpers (`@/config/settings`,
 * `@/utils/get-docs-collection`, `tag-vocabulary`, etc.) that v2 must
 * not reach into. So this package only ports concern (3): the
 * presentational shell. Callers prepare the columns upstream and pass
 * already-localized, already-resolved hrefs in.
 */

/** A single link rendered inside a {@link FooterLinkColumn}. */
export interface FooterLinkItem {
  /** Visible label (already locale-resolved by the caller). */
  label: string;
  /** Resolved href (already base-prefixed and locale-aware). */
  href: string;
  /**
   * When true, the rendered anchor adds `target="_blank"` and
   * `rel="noopener noreferrer"`. Callers compute this from their own
   * external-href detector.
   */
  isExternal?: boolean;
}

/** One column in the footer's link grid. */
export interface FooterLinkColumn {
  /** Visible heading for the column (already locale-resolved). */
  title: string;
  items: FooterLinkItem[];
}

/** A single tag rendered inside a {@link FooterTagColumn}. */
export interface FooterTagItem {
  /** Canonical tag id (rendered as `#<tag>`). */
  tag: string;
  /** Document count shown next to the tag. */
  count: number;
  /** Resolved href to the tag's index page. */
  href: string;
}

/** One column in the footer's tag grid. */
export interface FooterTagColumn {
  /**
   * Group identifier — usually a vocabulary group name like `"topic"`,
   * or the literal `"__flat__"` sentinel for the ungrouped/flat column.
   * Surfaced as `data-taglist-group` on the rendered column wrapper so
   * downstream tests / e2e selectors keep working.
   */
  group: string;
  /** Visible heading for the column (already locale-resolved). */
  title: string;
  tags: FooterTagItem[];
}
