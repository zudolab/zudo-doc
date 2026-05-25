import type { FeatureModule } from "../compose.js";

export const i18nFeature: FeatureModule = (_choices) => ({
  name: "i18n",
  injections: [
    {
      file: "src/components/header.astro",
      anchor: "// @slot:header:imports",
      content: `import LanguageSwitcher from "@/components/language-switcher";`,
    },
    {
      file: "src/components/header.astro",
      anchor: "<!-- @slot:header:after-theme-toggle -->",
      content: `      {lang && <LanguageSwitcher lang={lang} />}`,
      position: "after",
    },
  ],
  // No postProcess needed: pages are locale-agnostic (they iterate
  // settings.locales) and getLocaleLabel derives its label from
  // defaultLocale.toUpperCase(), so no regex patching of generated files
  // is required for non-default languages.
});
