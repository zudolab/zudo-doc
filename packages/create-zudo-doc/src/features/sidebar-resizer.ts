import type { FeatureModule } from "../compose.js";

/**
 * Sidebar-resizer feature.
 *
 * Purely a `zudoDoc({ sidebarResizer: true })` field (see `zfb-config-gen.ts`)
 * — the pre-paint script and runtime init are package-owned
 * (`sidebar-resizer/sidebar-resizer-init.tsx`), gated on `settings.sidebarResizer`
 * inside the package's own chrome. Nothing to inject.
 */
export const sidebarResizerFeature: FeatureModule = () => ({
  name: "sidebarResizer",
  injections: [],
});
