import type { FeatureModule } from "../compose.js";

/**
 * Asset-viewer feature.
 *
 * Purely a `zudoDoc({ assetViewer: true })` field (see `zfb-config-gen.ts`).
 * The scanner, viewer route, and all supporting UI are package-owned by
 * `@takazudo/zudo-doc`; generated projects only need the config toggle.
 * Nothing is injected or copied into the scaffold.
 */
export const assetViewerFeature: FeatureModule = () => ({
  name: "assetViewer",
  injections: [],
});
