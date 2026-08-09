/**
 * SLOT FILE — the preview sub-issue (#3338) replaced this file's internals
 * and nothing else; the pop-out window sub-issue (#3339) renders the same
 * component in its own window. Treat `PreviewPaneSlotProps` as the contract.
 *
 * What the chrome guarantees:
 *
 * - The host is a `min-height: 0` flex column, so a scrolling preview body works
 *   without any further layout work.
 * - `markdown` is the LIVE editor buffer (not the last saved document), so the
 *   preview can update while a save is still pending. The real preview
 *   (`../preview/preview-pane.tsx`) debounces rendering itself — this slot
 *   does not.
 * - `title`/`path` come from the composed snapshot, never from a frontmatter
 *   block inside `markdown` (there is none — epic #3327 contract 1).
 *
 * The actual zfb-md-wasm rendering, prose/syntax CSS, and directive→
 * admonition post-processing live in `../preview/`; this file only keeps the
 * mount seam and prop contract stable for callers (`workspace.tsx` today,
 * the pop-out window's own mount later).
 */

import PreviewPane from "../preview/preview-pane";

export interface PreviewPaneSlotProps {
  pageId: string;
  title: string;
  /** `category-slug/page-slug`, as the pane header shows it. */
  path: string;
  /** The live editor buffer — body only, no frontmatter. */
  markdown: string;
}

export default function PreviewPaneSlot(props: PreviewPaneSlotProps) {
  return <PreviewPane {...props} />;
}
