/**
 * Heading metadata consumed by the TOC primitives.
 *
 * Shape mirrors the `headings` array exported from MDX modules by the
 * underlying engine — `depth` (1–6), DOM `slug` (matching the rendered
 * heading element's id), and the rendered `text`. Keep field names and
 * types byte-aligned with the engine so a page module's `headings`
 * export drops in directly.
 */
export interface HeadingItem {
  readonly depth: number;
  readonly slug: string;
  readonly text: string;
}
