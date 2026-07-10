import type { FeatureModule } from "../compose.js";

/**
 * llms-txt feature.
 *
 * Purely a `zudoDoc({ llmsTxt: true })` field (see `zfb-config-gen.ts`) —
 * `zudoDocPreset()` wires `@takazudo/zudo-doc/plugins/llms-txt` whenever the
 * flag is on. Nothing to inject.
 */
export const llmsTxtFeature: FeatureModule = () => ({
  name: "llmsTxt",
  injections: [],
});
