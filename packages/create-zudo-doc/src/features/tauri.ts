import fs from "fs-extra";
import path from "path";
import type { FeatureModule } from "../compose.js";

/**
 * Tauri feature.
 *
 * Minimal-scaffold cutover (epic zudolab/zudo-doc#2651, Wave 6 #2660): the
 * `src-tauri/**` Rust shell is a genuine, unconditional file copy (no
 * package equivalent — kept exactly as before). The FindInPageInit island
 * (Cmd/Ctrl+F find bar, #2052) is ALSO still copied
 * (`src/components/find-bar.tsx`, `src/components/find-in-page-init.tsx`,
 * `src/utils/find-in-page.ts`) but is NO LONGER auto-mounted: its old mount
 * point (`pages/lib/_body-end-islands.tsx`) doesn't exist anymore — the
 * package now owns the entire chrome for both the home route and the
 * self-contained doc stub. See the loud note in
 * `find-in-page-init.tsx` for the `chromeBindingsModule` wiring path that
 * restores it. The find-match highlight CSS still ships unconditionally
 * from `@takazudo/zudo-doc/features.css`; the component itself
 * runtime-gates on `window.__TAURI_INTERNALS__`, so it's inert either way
 * in a plain browser build.
 */
export const tauriFeature: FeatureModule = (choices) => ({
  name: "tauri",
  injections: [],
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
