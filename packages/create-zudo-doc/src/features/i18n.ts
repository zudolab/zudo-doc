import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import type { FeatureModule } from "../compose.js";

/**
 * i18n feature — gates the locale-prefixed page set.
 *
 * Locked manifest (#2653 Decision 4, i18n addendum): "i18n ON adds
 * `pages/[locale]/docs/[[...slug]].tsx` (a second doc stub, locale variant)
 * … No other pages." That ONE self-contained stub — required for the same
 * injected-DYNAMIC-route dev-mode 404 gap the default-locale stub fixes —
 * is shipped under `templates/features/i18n/files/pages/[locale]/docs/`
 * and copied by `composeFeatures → copyFeatureFiles` whenever `i18n` is
 * selected. The old `pages/[locale]/index.tsx` home-route template is GONE
 * (the locked manifest doesn't want it — the package-owned `/` route
 * already handles every locale via `[[locale]]`-style resolution inside
 * `routes/index.tsx`'s own logic).
 *
 * No injections: the stub iterates `settings.locales` at build/request
 * time, so no postProcess regex patching is required for non-default
 * languages. Secondary-language content mirrors under
 * `src/content/docs-<lang>/` are seeded by `scaffold.ts`.
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
        `Expected to find [locale]/docs/[[...slug]].tsx.\n` +
        `This is a generator bug — please file an issue.`,
    );
  }

  return {
    name: "i18n",
    injections: [],
  };
};
