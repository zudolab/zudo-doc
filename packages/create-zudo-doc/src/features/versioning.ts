import fs from "fs-extra";
import path from "path";
import type { FeatureModule } from "../compose.js";

/**
 * Versioning feature.
 *
 * The pages/lib wrappers gate `VersionSwitcher` and `VersionBanner` on
 * `settings.versions`. Doc-layout flow is handled by route enumerators +
 * `_inline-version-switcher.tsx`. This feature copies versioning page
 * templates from `templates/features/versioning/files/` via
 * `copyFeatureFiles` (compose.ts), and injects nothing into `global.css`.
 *
 * W7C (#1738): the versioning feature ships pages under
 * `templates/features/versioning/files/pages/`:
 *
 *   docs/versions.tsx                       (always — versioning gate only)
 *   v/[version]/docs/[...slug].tsx          (always — versioning gate only)
 *   v/[version]/[locale]/docs/[...slug].tsx (i18n + versioning — see below)
 *   [locale]/docs/versions.tsx              (i18n + versioning)
 *
 * `copyFeatureFiles` (compose.ts) auto-copies everything under `files/`.
 * postProcess removes the i18n-gated subset when i18n is OFF so single-
 * locale projects don't ship orphan routes.
 */
export const versioningFeature: FeatureModule = (choices) => ({
  name: "versioning",
  postProcess: async (targetDir) => {
    if (!choices.features.includes("i18n")) {
      const localeVersions = path.join(
        targetDir,
        "pages",
        "[locale]",
        "docs",
        "versions.tsx",
      );
      if (await fs.pathExists(localeVersions)) {
        await fs.remove(localeVersions);
      }
      const localeVersionedDocs = path.join(
        targetDir,
        "pages",
        "v",
        "[version]",
        "[locale]",
      );
      if (await fs.pathExists(localeVersionedDocs)) {
        await fs.remove(localeVersionedDocs);
      }
    }
  },
  injections: [],
});
