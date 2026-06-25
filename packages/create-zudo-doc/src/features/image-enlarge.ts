import type { FeatureModule } from "../compose.js";

/**
 * Image-enlarge feature.
 *
 * W7A (#1736): post-cutover, the image-enlarge island is mounted by the
 * pages/lib body-end wrapper (always present; runtime-gated via the
 * always-loaded stub-or-real ImageEnlarge component). Image-enlarge CSS
 * lives unconditionally in `@takazudo/zudo-doc/features.css` (moved from
 * `global.css` in S3 #2348) — the selectors only activate when the runtime
 * mounts the .zd-enlarge-btn.
 *
 * S2 (#1825): the server-side figure/button emission was re-implemented via an
 * MDX paragraph (p) component override in pages/_mdx-components.ts. Three
 * injections installed the ENLARGE_SVG + EnlargeableParagraph code when
 * imageEnlarge was enabled.
 *
 * S8 / #2360 (E2): the full MDX component assembly moved into the
 * @takazudo/zudo-doc/mdx-components factory (createMdxComponentsBase). The
 * factory reads settings.imageEnlarge at render time and conditionally wraps
 * block-level images in <figure class="zd-enlargeable"> — the same logic the
 * old injections installed, now handled once inside the package. The three
 * _mdx-components.ts injections (enlarge-imports, enlarge-defs,
 * enlarge-p-entry) are therefore removed; the feature is a no-op from the
 * compose engine's perspective (the runtime gate in the factory is always
 * present in the scaffolded template).
 *
 * S3 (#2348): the ImageEnlarge island and its SSR fallback moved from
 * src/components/image-enlarge.tsx into @takazudo/zudo-doc/image-enlarge.
 * The pages/lib/_body-end-islands.tsx template now imports them from the
 * package, so no file-copy injections exist in this feature module either.
 */
export const imageEnlargeFeature: FeatureModule = () => ({
  name: "imageEnlarge",
  injections: [],
});
