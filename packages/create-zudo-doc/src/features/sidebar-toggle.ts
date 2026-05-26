import type { FeatureModule } from "../compose.js";

/**
 * Sidebar-toggle feature.
 *
 * W7A (#1736): post-cutover, the sidebar-toggle is hosted by the pages/lib
 * wrappers which runtime-gate on `settings.sidebarToggle`. The supporting
 * CSS (toggle button positioning, sidebar transitions, `[data-sidebar-hidden]`
 * styles) lives unconditionally in `templates/base/src/styles/global.css`
 * — the selectors only match when the runtime attaches the
 * `data-sidebar-hidden` attribute or mounts the toggle button, so the cost
 * to scaffolds without the feature is one inert rule block.
 */
export const sidebarToggleFeature: FeatureModule = () => ({
  name: "sidebarToggle",
  injections: [],
});
