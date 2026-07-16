import fs from "fs-extra";
import path from "path";
import type { FeatureModule } from "../compose.js";

/**
 * Doc-history feature.
 *
 * Minimal-scaffold cutover (epic zudolab/zudo-doc#2651, Wave 6 #2660):
 * `settings.docHistory` is a plain zudoDoc() field now (see zfb-config-gen.ts)
 * and the diff-viewer CSS (`.diff-row`/`.diff-line-*`) ships unconditionally
 * from `@takazudo/zudo-doc/features.css` (epic #2344 S4) — the old
 * `@slot:global-css:feature-styles` CSS injection this module used to carry
 * is DEAD (the anchor no longer exists in the ~20-line `global.css`) and has
 * been removed.
 *
 * What's left to wire: the self-contained doc-route stub(s)
 * (`pages/docs/[[...slug]].tsx`, and its i18n locale sibling when i18n is
 * also selected) always thread the host's `chromeBindings`. Unlike
 * `DesignTokenPanelBootstrap` (auto-defaulted at the chrome-derive seam,
 * #2658 gate-2 fix), `DocHistory`'s derive-level default is a deliberate
 * no-op stub (see `routes/_chrome.tsx`'s comment on why — its own island
 * needs the REAL host binding to hydrate). So when docHistory is selected,
 * this feature patches the stub(s) to statically import the real
 * `DocHistory` component and merge it over those bindings — preserving every
 * configured host slot while maintaining the same #2480 scanner-reachability
 * chain `routes/_chrome.tsx` uses for the package's own routes.
 */
export const docHistoryFeature: FeatureModule = () => ({
  name: "docHistory",
  injections: [],
  postProcess: async (targetDir) => {
    const stubPaths = [
      path.join(targetDir, "pages", "docs", "[[...slug]].tsx"),
      path.join(targetDir, "pages", "[locale]", "docs", "[[...slug]].tsx"),
    ];
    for (const stubPath of stubPaths) {
      if (!(await fs.pathExists(stubPath))) continue;
      let content = await fs.readFile(stubPath, "utf-8");
      // Idempotency guard: check for the actual inserted import statement,
      // NOT a bare `.includes("DocHistory")` — this file's own header
      // comment (explaining WHY this patch exists) mentions "DocHistory" in
      // prose, which would false-positive a weaker check and skip patching
      // on every run.
      const importMarker = `import { DocHistory } from "@takazudo/zudo-doc/doc-history";`;
      if (content.includes(importMarker)) continue; // already patched

      content = content.replace(
        `import { createChrome } from "@takazudo/zudo-doc/chrome";`,
        `import { createChrome } from "@takazudo/zudo-doc/chrome";
${importMarker}
import { defineChromeBindings } from "@takazudo/zudo-doc/chrome-bindings";`,
      );
      content = content.replace(
        `const { renderDocPage } = createChrome(routeCtx, chromeBindings);`,
        `const { renderDocPage } = createChrome(routeCtx, {
  ...chromeBindings,
  ...defineChromeBindings({ DocHistory }),
});`,
      );
      await fs.writeFile(stubPath, content);
    }
  },
});
