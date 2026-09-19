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
// `storagePrefix` is kept at the package-default value `zudo-doc-tweak` so the
// resolved toggle channel stays the shared `toggle-design-token-panel` event
// (see `resolveToggleEventName` in
// `packages/zudo-doc/src/design-token-panel-constants.ts`).

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
