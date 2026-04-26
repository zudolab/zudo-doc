import type { FeatureModule } from "../compose.js";

/**
 * Blog feature.
 *
 * Settings (`blog: { enabled, dir, sidebarRecentCount, postsPerPage, locales }`)
 * and the optional Blog header-nav entry are emitted by `settings-gen.ts`.
 * The `remark-excerpt` plugin import + registration is wired in
 * `astro-config-gen.ts`. Runtime deps (`mdast-util-to-hast`,
 * `hast-util-to-html`, `mdast-util-from-markdown`) are added in
 * `scaffold.ts#generatePackageJson`.
 *
 * Blog-specific source files (content collection schema entries, route pages,
 * sidebar component, the `remark-excerpt.ts` plugin file, etc.) are copied as
 * template files under `templates/features/blog/files/` — that work lands in
 * the W7 sub-task (#452), not here.
 */
export const blogFeature: FeatureModule = () => ({
  name: "blog",
  injections: [],
});
