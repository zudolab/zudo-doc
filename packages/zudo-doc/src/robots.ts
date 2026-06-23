/**
 * Public entry for `@takazudo/zudo-doc/robots`.
 *
 * Renders the content of `robots.txt` from project settings.
 * Extracted from `pages/robots.txt.tsx` so the same logic can be
 * consumed by both the showcase page and every `create-zudo-doc`
 * scaffold without copy-drift.
 *
 * ## Usage
 *
 * ```ts
 * import { renderRobots } from "@takazudo/zudo-doc/robots";
 * import { settings } from "@/config/settings";
 *
 * export const contentType = "text/plain";
 * export default () => renderRobots(settings);
 * ```
 */

/** Minimal settings shape consumed by renderRobots. */
export interface RobotsSettings {
  /** When true, disallow all crawlers. */
  noindex: boolean;
  /** Base URL of the site, used to construct the Sitemap line. */
  siteUrl?: string;
  /** When true (and siteUrl is set), append a Sitemap: line. */
  sitemap?: boolean;
}

/**
 * Returns the plain-text content for `robots.txt` based on settings.
 *
 * - `noindex: true` → `Disallow: /` with no Sitemap line (advertising a
 *   sitemap while disallowing all crawlers is contradictory).
 * - Otherwise → `Allow: /` with an optional `Sitemap:` line when both
 *   `siteUrl` and `sitemap` are truthy.
 */
export function renderRobots(settings: RobotsSettings): string {
  if (settings.noindex) {
    return `User-agent: *\nDisallow: /\n`;
  }

  const siteUrlBase = (settings.siteUrl ?? "").replace(/\/$/, "");
  const hasSitemapLine = siteUrlBase !== "" && settings.sitemap;

  const sitemapLine = hasSitemapLine
    ? `Sitemap: ${siteUrlBase}/sitemap.xml\n`
    : "";

  return `User-agent: *\nAllow: /\n${sitemapLine}`;
}
