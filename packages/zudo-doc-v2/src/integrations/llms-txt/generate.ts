/**
 * Pure string generators for `llms.txt` and `llms-full.txt`.
 *
 * Both functions are intentionally pure (no fs, no logger, no globals)
 * so they can be unit-tested with fixture entries and so a future zfb
 * non-HTML page (`pages/llms.txt.tsx`) can call them straight from a
 * default export without a build-time hook.
 *
 * Output format must remain byte-identical to the legacy Astro emitter
 * — the file shape is part of the project's public surface.
 */

import type { LlmsDocEntry, LlmsTxtSiteMeta } from "./types.ts";

/**
 * Slim index — site header followed by a markdown bullet per page with
 * `[title](url): description`.
 */
export function generateLlmsTxt(
  entries: readonly LlmsDocEntry[],
  meta: LlmsTxtSiteMeta,
): string {
  const lines: string[] = [];
  lines.push(`# ${meta.siteName}`);
  lines.push("");
  lines.push(`> ${meta.siteDescription}`);
  lines.push("");
  lines.push("## Docs");
  lines.push("");

  for (const entry of entries) {
    lines.push(`- [${entry.title}](${entry.url}): ${entry.description}`);
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Full content concatenation — site header followed by every page's
 * stripped body separated by `---` rules.
 */
export function generateLlmsFullTxt(
  entries: readonly LlmsDocEntry[],
  meta: LlmsTxtSiteMeta,
): string {
  const lines: string[] = [];
  lines.push(`# ${meta.siteName}`);
  lines.push("");
  lines.push(`> ${meta.siteDescription}`);

  for (const entry of entries) {
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(`# ${entry.title}`);
    lines.push("");
    lines.push(`> Source: ${entry.url}`);
    lines.push("");
    lines.push(entry.content);
  }

  lines.push("");
  return lines.join("\n");
}
