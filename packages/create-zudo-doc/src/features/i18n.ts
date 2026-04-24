import type { FeatureModule } from "../compose.js";
import { patchDefaultLang } from "../utils.js";

export const i18nFeature: FeatureModule = (_choices) => ({
  name: "i18n",
  injections: [
    {
      file: "src/components/header.astro",
      anchor: "// @slot:header:imports",
      content: `import LanguageSwitcher from "@/components/language-switcher.astro";`,
    },
    {
      file: "src/components/header.astro",
      anchor: "<!-- @slot:header:after-theme-toggle -->",
      content: `      {lang && <LanguageSwitcher lang={lang} />}`,
      position: "after",
    },
  ],
  postProcess: async (targetDir, ch) => {
    const defaultLang = ch.defaultLang;

    // Patch default language label if not "en". The pages themselves no
    // longer encode the secondary locale path — the [locale] catch-all
    // iterates settings.locales, so any non-default locale (set via
    // settings.locales) is picked up automatically without copying files.
    if (defaultLang !== "en") {
      await patchDefaultLang(targetDir, defaultLang);
    }
  },
});
