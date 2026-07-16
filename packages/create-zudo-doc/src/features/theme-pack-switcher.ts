import type { FeatureModule } from "../compose.js";

/**
 * themePackSwitcher feature (theme pack ADR #2818).
 *
 * Purely a `zudoDoc({ themePackSwitcher: true })` field (see
 * `zfb-config-gen.ts`) — the bottom-right switcher flyout and its browse-all
 * dialog are PACKAGE-INJECTED (`@takazudo/zudo-doc`'s theme-pack-provider /
 * theme-pack-sync + the flyout/dialog islands), gated on
 * `settings.themePackSwitcher`. There is nothing to copy or postProcess.
 */
export const themePackSwitcherFeature: FeatureModule = () => ({
  name: "themePackSwitcher",
  injections: [],
});
