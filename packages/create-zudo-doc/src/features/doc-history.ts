import type { FeatureModule } from "../compose.js";

/**
 * Doc-history feature.
 *
 * W7A (#1736): post-cutover, `pages/lib/_doc-history-area.tsx` is mounted
 * unconditionally and self-gates on `settings.docHistory`. The plugin entry
 * is wired by `zfb-config-gen.ts`.
 */
export const docHistoryFeature: FeatureModule = () => ({
  name: "docHistory",
  injections: [],
});
