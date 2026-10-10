// The design-token-panel bootstrap's ONLY route to `@takazudo/zdtp` (#4201).
// `loadZdtp()` imports THIS subpath by its bare package name rather than
// `@takazudo/zdtp` directly, so that when zdtp is not bundled
// (`bundleZdtp ?? designTokenPanel` is false) the preset's
// `zdtp-loader` plugin can shadow exactly this specifier with a
// throwing virtual module — the island build then never bundles zdtp's lazy
// chunks. Shadowing the bare `@takazudo/zdtp` instead would hijack a host's
// own zdtp imports.
import { configurePanel } from "@takazudo/zdtp";
import type { PanelConfig, PanelInstanceHandle } from "@takazudo/zdtp";

export * from "@takazudo/zdtp";

/**
 * Mount zdtp's opaque Preact root only while the activating island still owns
 * the pending import. Once configured, zdtp keeps its document-lifetime root
 * and its existing navigation cleanup semantics.
 */
export function configurePanelIfActive(
  signal: AbortSignal | undefined,
  config: PanelConfig,
): PanelInstanceHandle | null {
  if (signal?.aborted) return null;
  return configurePanel(config);
}
