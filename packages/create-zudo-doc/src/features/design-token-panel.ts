import fs from "fs-extra";
import path from "path";
import type { FeatureModule } from "../compose.js";

/**
 * Design-token-panel (zdtp) feature.
 *
 * Minimal-scaffold cutover (epic zudolab/zudo-doc#2651, Wave 6 #2660): the
 * bootstrap island, its config builder, and the pre-hydration toggle shim
 * are ALL package-owned now —
 * `chrome/derive.tsx`'s `deriveBodyEndIslands` auto-defaults the real
 * `DesignTokenPanelBootstrap` island for every `createChrome` consumer
 * (#2658 gate-2 fix, verified against the locked-manifest self-contained
 * doc stub in the target-manifest confirm fixture), and
 * `doc-body-end-islands/index.tsx` carries the toggle shim inline. So this
 * feature has nothing left to inject into `pages/lib/_body-end-islands.tsx`
 * or `src/config/settings-types.ts` — both files are gone anyway.
 *
 * The ONE thing that stays generator-owned: `@takazudo/zdtp/styles.css` is
 * the single conditional line in `src/styles/global.css` (documented in
 * that file's header comment) — it can't ship unconditionally from
 * `@takazudo/zudo-doc/theme.css` because it pulls in zdtp's own bytes.
 * Inserted right after the `@layer zd-preflight, zd-flow;` line (the same
 * position the locked-manifest reference shape uses).
 */
const ZDTP_IMPORT_LINE = `@import "@takazudo/zdtp/styles.css";`;
const LAYER_LINE = `@layer zd-preflight, zd-flow;`;

export const designTokenPanelFeature: FeatureModule = () => ({
  name: "designTokenPanel",
  injections: [],
  postProcess: async (targetDir) => {
    const cssPath = path.join(targetDir, "src/styles/global.css");
    if (!(await fs.pathExists(cssPath))) return;
    let content = await fs.readFile(cssPath, "utf-8");
    if (content.includes(ZDTP_IMPORT_LINE)) return; // already patched (idempotent)
    content = content.replace(LAYER_LINE, `${LAYER_LINE}\n${ZDTP_IMPORT_LINE}`);
    await fs.writeFile(cssPath, content);
  },
});
