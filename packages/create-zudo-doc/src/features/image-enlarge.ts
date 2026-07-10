import type { FeatureModule } from "../compose.js";

/**
 * Image-enlarge feature.
 *
 * Purely a `zudoDoc({ imageEnlarge: true })` field (see `zfb-config-gen.ts`).
 * The island, its SSR fallback, and its CSS are all package-owned
 * (`@takazudo/zudo-doc/image-enlarge`, mounted by
 * `doc-body-end-islands/index.tsx`; CSS from `features.css`) and the MDX
 * `<figure class="zd-enlargeable">` wrapping is handled inside
 * `@takazudo/zudo-doc/mdx-components` at render time, reading
 * `settings.imageEnlarge`. Nothing to inject or copy.
 */
export const imageEnlargeFeature: FeatureModule = () => ({
  name: "imageEnlarge",
  injections: [],
});
