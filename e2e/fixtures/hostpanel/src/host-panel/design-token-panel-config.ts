// Host-owned `buildDesignTokenPanelConfig` for the hostpanel e2e fixture
// (#4310, epic #4309) — mirrors
// `packages/zudo-doc/src/__tests__/fixtures/route-injection/src/design-token-panel-config.ts`,
// the module-graph proof this fixture turns into a live-browser proof.
//
// Ships ONE distinguishing token whose label is a MARKER string, so the spec
// can prove from the rendered panel that the HOST's builder — not the package
// default from `@takazudo/zudo-doc/design-token-panel-config` — is what zdtp
// was configured with.
//
// `storagePrefix` is kept at the value the package default builder uses,
// `zudo-doc-tweak`, so this fixture shares the showcase's storage namespace.
// Note it is NOT zdtp's own `DEFAULT_STORAGE_PREFIX` (`zudo-design-token-panel`),
// so `resolveToggleEventName` derives `toggle-zudo-doc-tweak` from it — the
// shared `toggle-design-token-panel` event `./bootstrap-island.tsx` dispatches
// works regardless, because `bootstrapDesignTokenPanel` binds
// `DEFAULT_TOGGLE_EVENT` unconditionally for the whole pending phase and zdtp
// itself then owns both channels post-configure. Changing `storagePrefix` here
// therefore does not require changing that dispatch name.

import type { PanelConfig } from "@takazudo/zdtp";

export function buildDesignTokenPanelConfig(_mode: "light" | "dark"): PanelConfig {
  return {
    storagePrefix: "zudo-doc-tweak",
    consoleNamespace: "zudoDoc",
    modalClassPrefix: "zudo-doc-design-token-panel-modal",
    schemaId: "zudo-design-tokens/v3",
    exportFilenameBase: "zudo-doc-design-tokens",
    tabs: [
      {
        id: "host-demo-tab",
        label: "Host Demo Tab",
        tiers: [
          {
            id: "host-demo-tier",
            label: "Host Demo Tier",
            items: [
              {
                id: "host-demo-token",
                cssVar: "--dtp-host-demo-token",
                label: "DTP-HOST-CONFIG-MODULE-MARKER",
                default: "1rem",
                type: { kind: "length", step: 0.1, unit: "rem" },
              },
            ],
          },
        ],
      },
    ],
  };
}
