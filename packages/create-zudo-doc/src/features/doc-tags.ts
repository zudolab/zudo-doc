import fs from "fs-extra";
import path from "path";
import type { FeatureModule } from "../compose.js";

/**
 * docTags feature (W7C — #1738).
 *
 * Settings gate: `settings.docTags === true`.
 *
 * Ships feature-conditional pages from
 * `templates/features/docTags/files/pages/`:
 *
 *   docs/tags/[tag].tsx
 *   docs/tags/index.tsx
 *   [locale]/docs/tags/[tag].tsx    — only when i18n ALSO selected
 *   [locale]/docs/tags/index.tsx    — only when i18n ALSO selected
 *
 * `copyFeatureFiles` (compose.ts) auto-emits every file under
 * `files/`; postProcess removes the `[locale]/**` subset when i18n
 * is NOT selected. See W2 spec-lock §Cross-feature interaction.
 */
export const docTagsFeature: FeatureModule = (choices) => ({
  name: "docTags",
  injections: [],
  postProcess: async (targetDir) => {
    if (!choices.features.includes("i18n")) {
      // i18n is OFF — strip the locale-scoped tag pages that were
      // copied unconditionally by copyFeatureFiles.
      const localeTagsDir = path.join(targetDir, "pages", "[locale]", "docs", "tags");
      if (await fs.pathExists(localeTagsDir)) {
        await fs.remove(localeTagsDir);
      }
    }
  },
});
