import type { FeatureModule } from "../compose.js";

/**
 * Footer taglist feature.
 *
 * Purely a settings toggle: `settings-gen.ts` emits
 * `footer.taglist = { enabled: true, groupBy: "group" }` when selected,
 * and the existing `footer.astro` (part of the footer pseudo-feature) reads
 * `settings.footer.taglist` to decide whether to render the column(s).
 *
 * `footer.astro` is only installed by the footer pseudo-feature, so
 * `resolveSelectedFeatures` treats `footerTaglist` as one of the triggers
 * for that feature.
 */
export const footerTaglistFeature: FeatureModule = () => ({
  name: "footerTaglist",
  injections: [],
  dependencies: ["tagGovernance"],
});
