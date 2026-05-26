import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import type { FeatureModule } from "../compose.js";

/**
 * i18n feature — gates the locale-prefixed page set.
 *
 * Page templates are shipped under `templates/features/i18n/files/pages/`
 * and copied by `composeFeatures → copyFeatureFiles` whenever `i18n` is in
 * the selected feature set.
 *
 * No injections: header / language-switcher wiring was retired with the
 * Astro cutover (#1736 / W7A) — `pages/lib/_header-with-defaults.tsx` now
 * gates `LanguageSwitcher` on `Object.keys(settings.locales).length > 0`.
 * The pages are locale-agnostic — they iterate `settings.locales` at build
 * time, so no postProcess regex patching is required for non-default
 * languages.
 *
 * Loud-failure check: per spec-lock Decision 8 (#1737), abort scaffolding
 * if the feature template dir is missing or empty. Without this guard,
 * `copyFeatureFiles` silently no-ops on a missing dir (l-lessons line 790)
 * and the user receives a half-scaffolded project with `i18n` enabled in
 * settings but no `[locale]/**` pages.
 */
export const i18nFeature: FeatureModule = (_choices) => {
  const featuresRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..", // up from features/ to src/
    "..", // up from src/ to package root
    "templates/features",
  );
  const pagesDir = path.join(featuresRoot, "i18n/files/pages");
  // Check existence + directory-ness before readdir so a stray file at this
  // path produces the same loud error rather than an opaque ENOTDIR.
  const stat = fs.existsSync(pagesDir) ? fs.statSync(pagesDir) : null;
  if (!stat || !stat.isDirectory() || fs.readdirSync(pagesDir).length === 0) {
    throw new Error(
      `i18n feature template dir is missing or empty: ${pagesDir}\n` +
        `Expected to find [locale]/index.tsx and [locale]/docs/[...slug].tsx.\n` +
        `This is a generator bug — please file an issue.`,
    );
  }

  return {
    name: "i18n",
    injections: [],
  };
};
