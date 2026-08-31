import type { FeatureModule } from "../compose.js";

/**
 * Claude-resources feature.
 *
 * Fully plugin-owned (`@takazudo/zudo-doc/plugins/claude-resources`,
 * `zudoDocPreset()` wires it whenever `settings.claudeResources` is
 * truthy). Generation is package-owned. This feature's touch points are now
 * just the `claudeResources` field (`zfb-config-gen.ts`). Resource routes are
 * localized by default; projects can opt selected paths out through the
 * general-purpose `defaultLocaleOnlyPrefixes` setting.
 */
export const claudeResourcesFeature: FeatureModule = () => ({
  name: "claudeResources",
  injections: [],
});
