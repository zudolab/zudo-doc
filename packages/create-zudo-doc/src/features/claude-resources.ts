import type { FeatureModule } from "../compose.js";

/**
 * Claude-resources feature.
 *
 * Fully plugin-owned (`@takazudo/zudo-doc/plugins/claude-resources`,
 * `zudoDocPreset()` wires it whenever `settings.claudeResources` is
 * truthy). The old `src/integrations/claude-resources/*` host copy
 * (escape-for-mdx.ts / generate.ts + tests) was a pre-package-first
 * duplicate implementation nothing imported — deleted in the minimal-scaffold
 * cutover (epic zudolab/zudo-doc#2651, Wave 6 #2660). This feature's touch
 * points are now just: `claudeResources` + `defaultLocaleOnlyPrefixes` fields
 * (`zfb-config-gen.ts`).
 */
export const claudeResourcesFeature: FeatureModule = () => ({
  name: "claudeResources",
  injections: [],
});
