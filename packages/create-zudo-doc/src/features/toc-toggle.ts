import type { FeatureModule } from "../compose.js";

/**
 * TOC-toggle feature.
 *
 * Purely a `zudoDoc({ tocToggle: true })` field (see `zfb-config-gen.ts`).
 * `DesktopTocToggle` is fully package-owned
 * (`@takazudo/zudo-doc/desktop-toc-toggle-island`, wired into the doc-page
 * shell directly) and its CSS ships unconditionally from
 * `@takazudo/zudo-doc/features.css` — nothing to inject or copy.
 */
export const tocToggleFeature: FeatureModule = () => ({
  name: "tocToggle",
  injections: [],
});
