// Target-manifest confirm fixture (Wave 5, epic zudolab/zudo-doc#2651, #2659).
// This IS the whole config surface under test — the locked 12-file manifest's
// central claim ("one config file") lives or dies on this file typechecking
// and building cleanly through `zudoDoc()` (#2657), with NO local shim and a
// tsconfig that `include`s `pages/` (so the doc stub below is really
// typechecked — see the "changelogs TS2322" incidental bug noted on #2653).
import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    siteName: "Target Manifest Confirm",
    siteDescription: "Locked 12-file minimal-scaffold confirm fixture",
    sitemap: true,
    // Assertion group 2 (island-set diff) requires this ON — the
    // DesignTokenPanelBootstrap island must reach the SAME pages a
    // full-featured project would show it on.
    designTokenPanel: true,
  }),
);
