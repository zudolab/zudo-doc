import fs from "fs-extra";
import path from "path";
import type { FeatureModule } from "../compose.js";

/**
 * Tauri feature.
 *
 * #2052: the FindInPageInit island (Cmd/Ctrl+F find bar for the Tauri
 * WebView, where the browser-native find UI is unavailable) is wired into
 * `pages/lib/_body-end-islands.tsx` via the three injections below — import,
 * displayName, and Island mount. zfb's island scanner only registers
 * components reachable through static import chains (page → wrapper →
 * component), so without this injection the feature-copied component files
 * are orphaned dead code that never hydrates. The find-match highlight CSS
 * is unconditional in `templates/base/src/styles/global.css` (matches host);
 * the component runtime-gates itself (renders null unless
 * `window.__TAURI_INTERNALS__` exists), so no settings field is needed.
 */
export const tauriFeature: FeatureModule = (choices) => ({
  name: "tauri",
  injections: [
    // 1. Import the island entry. Inserted AFTER the
    //    `// @slot:body-end-islands:imports` anchor.
    {
      file: "pages/lib/_body-end-islands.tsx",
      anchor: "// @slot:body-end-islands:imports",
      position: "after",
      content: `import FindInPageInit from "@/components/find-in-page-init";`,
    },
    // 2. Stable island marker name (same belt-and-braces guard as the
    //    sibling islands in the file). Inserted AFTER the
    //    `// @slot:body-end-islands:display-names` anchor.
    {
      file: "pages/lib/_body-end-islands.tsx",
      anchor: "// @slot:body-end-islands:display-names",
      position: "after",
      content: `(FindInPageInit as { displayName?: string }).displayName = "FindInPageInit";`,
    },
    // 3. Island mount. Inserted AFTER the
    //    `{/* @slot:body-end-islands:extra-islands */}` anchor.
    //    when="load" (not "idle"): the island's job is to intercept
    //    Cmd/Ctrl+F via a keydown listener, so it must hydrate as soon as
    //    the islands runtime mounts — same rationale as the
    //    clientRouterBootstrap click intercept above it. Deferring to idle
    //    would leave a post-load window where Cmd+F does nothing, which is
    //    the very bug this injection fixes.
    {
      file: "pages/lib/_body-end-islands.tsx",
      anchor: "{/* @slot:body-end-islands:extra-islands */}",
      position: "after",
      content: `      {/* Tauri-only find-in-page (Cmd/Ctrl+F) bar. Renders null outside
          a Tauri WebView, so the island is inert in plain browser builds
          of the same scaffold. */}
      {Island({
        when: "load",
        children: <FindInPageInit />,
      }) as unknown as VNode}`,
    },
  ],
  postProcess: async (targetDir) => {
    // Patch Cargo.toml package name
    const cargoPath = path.join(targetDir, "src-tauri/Cargo.toml");
    if (await fs.pathExists(cargoPath)) {
      let content = await fs.readFile(cargoPath, "utf-8");
      const safeName = choices.projectName.replace(/[^a-zA-Z0-9_-]/g, "-");
      content = content.replace(/name = "zudo-doc"/, `name = "${safeName}"`);
      await fs.writeFile(cargoPath, content);
    }

    // Patch tauri.conf.json productName, identifier, and beforeDevCommand
    const confPath = path.join(targetDir, "src-tauri/tauri.conf.json");
    if (await fs.pathExists(confPath)) {
      let content = await fs.readFile(confPath, "utf-8");
      const productName = choices.projectName
        .split(/[-_]/)
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join("");
      const identifier = `com.example.${choices.projectName.replace(/[^a-zA-Z0-9-]/g, "-")}`;
      content = content.replace(/"productName": "ZudoDoc"/, `"productName": "${productName}"`);
      content = content.replace(/"identifier": "com.zudolab.zudo-doc"/, `"identifier": "${identifier}"`);
      // Patch beforeDevCommand for the chosen package manager
      const devCmd =
        choices.packageManager === "npm" || choices.packageManager === "bun"
          ? `${choices.packageManager} run dev`
          : `${choices.packageManager} dev`;
      content = content.replace(/"beforeDevCommand": "pnpm dev"/, `"beforeDevCommand": "${devCmd}"`);
      await fs.writeFile(confPath, content);
    }

    // Append src-tauri entries to .gitignore
    const gitignorePath = path.join(targetDir, ".gitignore");
    if (await fs.pathExists(gitignorePath)) {
      let content = await fs.readFile(gitignorePath, "utf-8");
      if (!content.includes("src-tauri/target")) {
        content += "\n# Tauri build artifacts\nsrc-tauri/target\nsrc-tauri/gen\n";
        await fs.writeFile(gitignorePath, content);
      }
    }
  },
});
