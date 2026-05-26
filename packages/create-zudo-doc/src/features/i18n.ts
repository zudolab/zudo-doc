import type { FeatureModule } from "../compose.js";

/**
 * i18n feature.
 *
 * W7A (#1736): post-cutover, `pages/lib/_header-with-defaults.tsx` gates
 * `LanguageSwitcher` on `Object.keys(settings.locales).length > 0`.
 * Conditional page files (i18n routes) are handled by #1737 (W7B).
 */
export const i18nFeature: FeatureModule = (_choices) => ({
  name: "i18n",
  injections: [],
});
