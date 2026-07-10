import type { FeatureModule } from "../compose.js";

/**
 * Dynamic page transition feature.
 *
 * Minimal-scaffold cutover (epic zudolab/zudo-doc#2651, Wave 6 #2660):
 * purely a `zudoDoc({ dynamicPageTransition: true })` field now (see
 * `zfb-config-gen.ts`). The primary activation path —
 * `<ClientRouter enableClientRouter={settings.dynamicPageTransition} />`
 * rendered by the package's own `doc-page-shell`/`doclayout` — and the
 * pure-SSR `<PageLoadingOverlay/>` mount are BOTH already handled inside
 * `doc-body-end-islands/index.tsx`, gated on the same flag; the View-
 * Transitions CSS ships unconditionally from `@takazudo/zudo-doc/features.css`.
 *
 * DROPPED: the host `ClientRouterBootstrap` island
 * (`templates/features/dynamicPageTransition/files/src/components/`) —
 * its old host-owned mount point (`pages/lib/_body-end-islands.tsx`) no
 * longer exists, and the package's own doc-body-end-islands header comment
 * already calls it "a redundant fallback" once PageLoadingOverlay covers the
 * loading UI. Known gap (documented, out of this generator's scope): the
 * package's SSR-only `<ClientRouter/>` import may still need a "use client"
 * bootstrap to guarantee the click-intercept ships to the browser bundle —
 * same class of issue as tauri's find-in-page island (see tauri.ts). If a
 * project needs it restored, wire a custom island through
 * `settings.chromeBindingsModule`'s `BodyEndIslands` slot.
 */
export const dynamicPageTransitionFeature: FeatureModule = () => ({
  name: "dynamicPageTransition",
  injections: [],
});
