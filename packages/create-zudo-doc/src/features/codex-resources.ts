import type { FeatureModule } from "../compose.js";

/**
 * Codex-resources feature.
 *
 * Fully plugin-owned (`@takazudo/zudo-doc/plugins/codex-resources`,
 * `zudoDocPreset()` wires it whenever `settings.codexResources` is
 * truthy). Generation is package-owned. This feature's touch points are now
 * just the `codexResources` field (`zfb-config-gen.ts`). Resource routes are
 * localized by default; projects can opt selected paths out through the
 * general-purpose `defaultLocaleOnlyPrefixes` setting.
 */
export const codexResourcesFeature: FeatureModule = () => ({
  name: "codexResources",
  injections: [],
});
