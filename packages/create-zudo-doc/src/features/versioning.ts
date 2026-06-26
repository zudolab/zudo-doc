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
 *   lib/_versions-page.tsx                  (always — versions-listing renderer)
 *
 * The versioned DOC routes — `/docs/versions`, `/v/[version]/docs/[[...slug]]`,
 * and `/v/[version]/[locale]/docs/[[...slug]]` — are now PACKAGE-INJECTED
 * (packageOwnedRoutes); their host catch-all stubs were deleted from the
 * template in #2390 (supersedes #2377) so generated projects render them via
 * injection through `@takazudo/zudo-doc`'s `_chrome` chrome (which wires the
 * MDX content components). The package route is the functional equivalent of
 * the old stub (it enumerates `settings.versions` and renders via the shared
 * `renderDocPage`).
 *
 * `copyFeatureFiles` (compose.ts) auto-copies everything under `files/`.
 * postProcess is now a defensive no-op: the i18n-gated stubs it strips
 * (`[locale]/docs/versions.tsx`, `v/[version]/[locale]/**`) no longer ship in
 * the template, but the cleanup is kept so a re-added stub can never leak an
 * orphan locale route into a single-locale project.
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
