// Pure, zfb-free helpers shared by the asset viewer body/components and (per
// zudolab/zudo-doc#4221) reused by the asset index page instead of being
// duplicated there. No JSX, no node builtins, no `@takazudo/zfb*` imports.

import type { AssetIndexEntry } from "../route-context-payload/types.js";

/** Formats a duration in seconds as `M:SS`. */
export function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainder = (rounded % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

/** Short kind badge for an asset: its language when known, else the MIME subtype or kind, uppercased. */
export function kindLabel(asset: AssetIndexEntry): string {
  if (asset.language) return asset.language;
  return asset.mime.split("/").at(-1)?.toUpperCase() ?? asset.kind.toUpperCase();
}

/**
 * Secondary metadata facet shown next to the kind badge: line count, video
 * duration, or image dimensions — whichever applies to the asset's kind.
 * `linesLabel`, when given, is used verbatim in place of the default
 * `"${lines} lines"` fallback (callers resolve the localized/templated text
 * themselves).
 */
export function facetLabel(asset: AssetIndexEntry, linesLabel?: string): string | null {
  if (asset.lines !== undefined) return linesLabel ?? `${asset.lines} lines`;
  if (asset.kind === "video" && asset.durationSec !== undefined) {
    return formatDuration(asset.durationSec);
  }
  if (asset.width !== undefined && asset.height !== undefined) return `${asset.width} × ${asset.height}`;
  if (asset.durationSec !== undefined) return formatDuration(asset.durationSec);
  return null;
}

/** Tailwind classes for an asset action button/link, primary (filled) or secondary (outlined). */
export function actionClass(primary = false): string {
  return `${primary ? "border-accent bg-accent text-bg" : "border-muted bg-surface text-fg"} inline-flex items-center justify-center rounded border px-hsp-md py-vsp-2xs text-caption font-medium hover:border-accent focus-visible:border-accent`;
}
