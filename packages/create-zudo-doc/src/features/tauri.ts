import fs from "fs-extra";
import path from "path";
import type { FeatureModule } from "../compose.js";

export const tauriFeature: FeatureModule = (choices) => ({
  name: "tauri",
  injections: [
    {
      file: "src/layouts/doc-layout.astro",
      anchor: "// @slot:doc-layout:imports",
      content: 'import FindInPageInit from "@/components/find-in-page-init";',
    },
    {
      file: "src/layouts/doc-layout.astro",
      anchor: "<!-- @slot:doc-layout:body-end-components -->",
      content:
        "    <Island when=\"load\"><FindInPageInit /></Island>",
      position: "after",
    },
    {
      file: "src/styles/global.css",
      anchor: "/* @slot:global-css:feature-styles */",
      content: `/* ── Find-in-page highlight ── */
.find-match {
  background-color: rgba(255, 200, 0, 0.4);
  border-radius: 2px;
}
.find-match-active {
  background-color: rgba(255, 150, 0, 0.7);
  border-radius: 2px;
  outline: 2px solid rgba(255, 150, 0, 0.9);
}`,
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
