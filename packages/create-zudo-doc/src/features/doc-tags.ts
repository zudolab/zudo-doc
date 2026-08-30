import type { FeatureModule } from "../compose.js";

/**
 * docTags feature.
 *
 * Purely a `zudoDoc({ docTags: true })` field (see `zfb-config-gen.ts`) —
 * the `/docs/tags` + `/docs/tags/[tag]` routes are PACKAGE-INJECTED
 * (`routes/docs-tags-index.tsx` / `routes/docs-tags-tag.tsx`), gated on
 * `settings.docTags`. `templates/features/docTags/files/` has been empty
 * since the host catch-all stubs were retired in favor of package
 * injection — there is nothing left to copy or postProcess.
 *
 * zfb 2.13.1 renders these injected tag routes in both dev and build. This
 * feature has no host stubs because package injection owns the routes.
 */
export const docTagsFeature: FeatureModule = () => ({
  name: "docTags",
  injections: [],
});
