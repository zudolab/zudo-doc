// Host-callables channel fixture (#2658) — a minimal `buildDesignTokenPanelConfig`
// module the DTP test cases point `settings.designTokenPanelConfigModule` at.
//
// Ships ONE distinguishing token (id/label carrying a MARKER string) so the
// build test can prove the host's builder — not the package default from
// `@takazudo/zudo-doc/design-token-panel-config` — actually reached the
// client bundle via `virtual:zudo-doc-design-token-panel-config`.

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
