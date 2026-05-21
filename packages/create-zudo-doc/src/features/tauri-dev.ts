import fs from "fs-extra";
import path from "path";
import type { FeatureModule } from "../compose.js";

export const tauriDevFeature: FeatureModule = (choices) => ({
  name: "tauriDev",
  injections: [],
  postProcess: async (targetDir) => {
    // Patch Cargo.toml package name — use "-dev" suffix to avoid collision with Mode 1 tauri
    const cargoPath = path.join(targetDir, "src-tauri-dev/Cargo.toml");
    if (await fs.pathExists(cargoPath)) {
      let content = await fs.readFile(cargoPath, "utf-8");
      const safeName = choices.projectName.replace(/[^a-zA-Z0-9_-]/g, "-");
      content = content.replace(/name = "zudo-doc-dev"/, `name = "${safeName}-dev"`);
      await fs.writeFile(cargoPath, content);
    }

    // Append src-tauri-dev entries to .gitignore
    const gitignorePath = path.join(targetDir, ".gitignore");
    if (await fs.pathExists(gitignorePath)) {
      let content = await fs.readFile(gitignorePath, "utf-8");
      if (!content.includes("src-tauri-dev/target")) {
        content += "\n# Tauri dev wrapper build artifacts\nsrc-tauri-dev/target\nsrc-tauri-dev/gen\n";
        await fs.writeFile(gitignorePath, content);
      }
    }
  },
});
