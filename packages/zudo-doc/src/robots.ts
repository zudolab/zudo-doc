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

import type { ContentSignalsConfig } from "./settings.js";

export type { ContentSignalsConfig } from "./settings.js";

/** Minimal settings shape consumed by renderRobots. */
export interface RobotsSettings {
  /** When true, disallow all crawlers. */
  noindex: boolean;
  /** Base URL of the site, used to construct the Sitemap line. */
  siteUrl?: string;
  /** Site base path, matching Settings["base"], used to construct the Sitemap line. */
  base?: string;
  /** When true (and siteUrl is set), append a Sitemap: line. */
  sitemap?: boolean;
  /** Content Signals for the `User-agent: *` group; `false` or absent publishes none. */
  contentSignals?: ContentSignalsConfig | false;
}

// Signal names and order from the Content Signals Policy (https://contentsignals.org).
const CONTENT_SIGNALS = [
  ["search", "search"],
  ["aiInput", "ai-input"],
  ["aiTrain", "ai-train"],
] as const satisfies ReadonlyArray<readonly [keyof ContentSignalsConfig, string]>;

/** The `ContentSignalsConfig` keys, in the order the signals are rendered. */
export const CONTENT_SIGNAL_KEYS: ReadonlyArray<keyof ContentSignalsConfig> =
  CONTENT_SIGNALS.map(([key]) => key);

/**
 * Returns the `Content-Signal` value for the configured signals — for example
 * `search=yes, ai-input=yes, ai-train=no` — or `undefined` when no signal is
 * declared. The same value can be sent as a `Content-Signal` response header.
 */
export function renderContentSignal(
  signals: ContentSignalsConfig | false | undefined,
): string | undefined {
  if (!signals) return undefined;
  const parts = CONTENT_SIGNALS.flatMap(([key, name]) => {
    const value = signals[key];
    return typeof value === "boolean" ? [`${name}=${value ? "yes" : "no"}`] : [];
  });
  return parts.length > 0 ? parts.join(", ") : undefined;
}

/**
 * Returns the plain-text content for `robots.txt` based on settings.
 *
 * - `noindex: true` → `Disallow: /` with no Sitemap line (advertising a
 *   sitemap while disallowing all crawlers is contradictory).
 * - Otherwise → `Allow: /` with an optional `Sitemap:` line when both
 *   `siteUrl` and `sitemap` are truthy.
 * - Configured `contentSignals` add a `Content-Signal:` line to the
 *   `User-agent: *` group in both cases.
 */
export function renderRobots(settings: RobotsSettings): string {
  const contentSignal = renderContentSignal(settings.contentSignals);
  const group = `User-agent: *\n${contentSignal ? `Content-Signal: ${contentSignal}\n` : ""}`;

  if (settings.noindex) {
    return `${group}Disallow: /\n`;
  }

  const siteUrlBase = (settings.siteUrl ?? "").replace(/\/$/, "");
  const normalizedBase = (settings.base ?? "").replace(/\/+$/, "");
  const hasSitemapLine = siteUrlBase !== "" && settings.sitemap;

  const sitemapLine = hasSitemapLine
    ? `Sitemap: ${siteUrlBase}${normalizedBase}/sitemap.xml\n`
    : "";

  return `${group}Allow: /\n${sitemapLine}`;
}
