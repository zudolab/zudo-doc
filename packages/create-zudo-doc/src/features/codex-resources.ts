import type { FeatureModule } from "../compose.js";

/**
 * Codex-resources feature.
 *
 * Fully plugin-owned (`@takazudo/zudo-doc/plugins/codex-resources`,
 * `zudoDocPreset()` wires it whenever `settings.codexResources` is
 * truthy). Generation is package-owned. This feature's touch points are now
 * just: `codexResources` + `defaultLocaleOnlyPrefixes` fields
 * (`zfb-config-gen.ts`).
 */
export const codexResourcesFeature: FeatureModule = () => ({
  name: "codexResources",
  injections: [],
});
