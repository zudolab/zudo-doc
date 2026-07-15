import type { FeatureModule } from "../compose.js";

/**
 * Claude-resources feature.
 *
 * Fully plugin-owned (`@takazudo/zudo-doc/plugins/claude-resources`,
 * `zudoDocPreset()` wires it whenever `settings.claudeResources` is
 * truthy). Generation is package-owned. This feature's touch points are now
 * just: `claudeResources` + `defaultLocaleOnlyPrefixes` fields
 * (`zfb-config-gen.ts`).
 */
export const claudeResourcesFeature: FeatureModule = () => ({
  name: "claudeResources",
  injections: [],
});
