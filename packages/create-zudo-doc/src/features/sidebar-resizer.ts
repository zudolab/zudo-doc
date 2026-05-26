import type { FeatureModule } from "../compose.js";

/**
 * Sidebar-resizer feature.
 *
 * W7A (#1736): post-cutover, sidebar resizer pre-paint scripts and runtime
 * initialization are runtime-gated on `settings.sidebarResizer` inside the
 * pages/lib wrappers — no doc-layout injection is required.
 *
 * NOTE: spec-lock §6.5 flagged a pre-paint FOUC question for the
 * `applySidebarWidth` IIFE that previously ran inline in the layout `<head>`.
 * The post-cutover model relies on the pages/lib head wrapper emitting the
 * inline script (when present); this feature module no longer injects it.
 */
export const sidebarResizerFeature: FeatureModule = () => ({
  name: "sidebarResizer",
  injections: [],
});
