import fs from "fs-extra";
import path from "path";
import type { FeatureModule } from "../compose.js";

/**
 * Blog feature.
 *
 * Settings (`blog: { enabled, dir, sidebarRecentCount, postsPerPage, locales }`)
 * and the optional Blog header-nav entry are emitted by `settings-gen.ts`.
 * The `remark-excerpt` plugin import + registration is wired in
 * `astro-config-gen.ts`. Runtime deps (`mdast-util-to-hast`,
 * `hast-util-to-html`, `mdast-util-from-markdown`) are added in
 * `scaffold.ts#generatePackageJson`. The blog content collection schemas
 * are emitted by `content-config-gen.ts`. The secondary-locale starter
 * post (`src/content/blog-${secondaryLang}/hello-world.md`) is written
 * programmatically in `scaffold.ts` when both `blog` and `i18n` are
 * selected — mirrors the pattern used for `docs-${secondaryLang}/`.
 *
 * Blog-specific source files (route pages, sidebar/listing components,
 * the inlined `remark-excerpt.ts` plugin, blog utils, the EN starter
 * post, etc.) are copied as template files under
 * `templates/features/blog/files/`.
 *
 * The post-processing hook strips locale-only artifacts when the i18n
 * feature is NOT selected:
 *   - `src/pages/[locale]/blog/` — the locale-aware blog routes
 *
 * (The `src/content/blog-${secondaryLang}/` directory is not created in
 * the first place when i18n is off, so no removal is needed there.)
 */
export const blogFeature: FeatureModule = () => ({
  name: "blog",
  injections: [],
  postProcess: async (targetDir, choices) => {
    if (choices.features.includes("i18n")) return;

    const localeBlogDir = path.join(targetDir, "src/pages/[locale]/blog");
    if (await fs.pathExists(localeBlogDir)) {
      await fs.remove(localeBlogDir);
    }
  },
});
