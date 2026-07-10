import type { FeatureModule } from "../compose.js";

/**
 * Search feature.
 *
 * The `@takazudo/zudo-doc/plugins/search-index` plugin runs unconditionally
 * (every project gets a `search-index.json`) — `zudoDocPreset()` always
 * wires it. This feature only controls whether the header shows the search
 * trigger (`{ type: "component", component: "search" }` in
 * `headerRightItems`, see `zfb-config-gen.ts`) — the widget itself is
 * package-owned (`chrome/derive.tsx`'s `SearchWidget`), so there is nothing
 * left to inject.
 */
export const searchFeature: FeatureModule = () => ({
  name: "search",
  injections: [],
});
