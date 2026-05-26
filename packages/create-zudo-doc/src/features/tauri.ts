import fs from "fs-extra";
import path from "path";
import type { FeatureModule } from "../compose.js";

/**
 * Tauri feature.
 *
 * W7A (#1736): post-cutover, the FindInPage island is mounted by the
 * pages/lib body-end wrapper. The find-match highlight CSS is unconditional
 * in `templates/base/src/styles/global.css` (matches host). Only the
 * postProcess hooks (Cargo.toml / tauri.conf.json / .gitignore patches)
 * remain feature-scoped.
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
