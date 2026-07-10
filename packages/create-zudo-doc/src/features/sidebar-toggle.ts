import type { FeatureModule } from "../compose.js";

/**
 * Sidebar-toggle feature.
 *
 * Purely a `zudoDoc({ sidebarToggle: true })` field (see `zfb-config-gen.ts`).
 * `DesktopSidebarToggle` is fully package-owned
 * (`@takazudo/zudo-doc/desktop-sidebar-toggle-island`, wired into
 * Header/Sidebar directly) and its CSS ships unconditionally from
 * `@takazudo/zudo-doc/features.css` — the old host re-export shim
 * (`src/components/desktop-sidebar-toggle.tsx`) is gone; nothing to inject
 * or copy.
 */
export const sidebarToggleFeature: FeatureModule = () => ({
  name: "sidebarToggle",
  injections: [],
});
