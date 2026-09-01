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

import {
  LLMS_ASSET_TEXT_CAP_BYTES,
  type LlmsAssetEntry,
  type LlmsDocEntry,
  type LlmsTxtSiteMeta,
} from "./types.js";

const BINARY_ASSET_STUB = "(binary asset, not inlined)";
const TRUNCATED_ASSET_MARKER = "… (truncated)";

function utf8Width(codePoint: number): number {
  if (codePoint <= 0x7f) return 1;
  if (codePoint <= 0x7ff) return 2;
  if (codePoint <= 0xffff) return 3;
  return 4;
}

/** Keep an asset body within the byte limit without splitting a code point. */
function truncateAssetText(
  text: string,
  explicitlyTruncated: boolean,
): { content: string; truncated: boolean } {
  let bytes = 0;
  let end = 0;
  for (const character of text) {
    const width = utf8Width(character.codePointAt(0) ?? 0);
    if (bytes + width > LLMS_ASSET_TEXT_CAP_BYTES) {
      return { content: text.slice(0, end), truncated: true };
    }
    bytes += width;
    end += character.length;
  }
  return { content: text, truncated: explicitlyTruncated };
}

function renderAssetBody(entry: LlmsAssetEntry): string {
  if (!entry.isText) return BINARY_ASSET_STUB;

  const result = truncateAssetText(
    entry.content ?? "",
    entry.truncated === true,
  );
  const content = result.content.trimEnd();
  if (!result.truncated) return content;
  return `${content}\n${TRUNCATED_ASSET_MARKER}`;
}

/**
 * Slim index — site header followed by a markdown bullet per page with
 * `[title](url): description`.
 */
export function generateLlmsTxt(
  entries: readonly LlmsDocEntry[],
  meta: LlmsTxtSiteMeta,
  assets: readonly LlmsAssetEntry[] = [],
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
  if (assets.length > 0) {
    lines.push("## Files");
    lines.push("");
    for (const asset of assets) {
      lines.push(`- [${asset.path}](${asset.url})`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * Full content concatenation — site header followed by every page's
 * stripped body separated by `---` rules.
 */
export function generateLlmsFullTxt(
  entries: readonly LlmsDocEntry[],
  meta: LlmsTxtSiteMeta,
  assets: readonly LlmsAssetEntry[] = [],
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

  for (const asset of assets) {
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(`# ${asset.path}`);
    lines.push("");
    lines.push(`> Source: ${asset.url}`);
    lines.push("");
    lines.push(renderAssetBody(asset));
  }

  lines.push("");
  return lines.join("\n");
}
