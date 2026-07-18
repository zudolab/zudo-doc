// Shared test-only helper: builds a minimal, validator-passing `theme-packs/`
// fixture directory (a "default"-style no-css pack + one CSS-bearing pack)
// so theme-cli tests don't need the real installed package's registry.
// NOT a `*.test.ts` file — vitest's `include` glob won't pick this up as a
// suite of its own.

import fs from "fs-extra";
import path from "node:path";

function sampleMeta(slug: string, name: string, version: string) {
  return {
    schemaVersion: 1,
    slug,
    name,
    description: `${name} fixture pack for theme-cli tests.`,
    mode: "light",
    version,
    fonts: { sans: "System", mono: "System", loaded: [] },
    preview: {
      light: {
        bg: "#ffffff",
        fg: "#111111",
        accent: "#0969da",
        syntax: { keyword: "#cf222e", string: "#0a3069", comment: "#6e7781", callable: "#8250df" },
      },
      dark: {
        bg: "#0d1117",
        fg: "#e6edf3",
        accent: "#4493f8",
        syntax: { keyword: "#ff7b72", string: "#a5d6ff", comment: "#8b949e", callable: "#d2a8ff" },
      },
    },
  };
}

/**
 * Writes a fixture `theme-packs/` directory under `dir` with two packs:
 * `default` (meta.json only, per the reserved-pack rule) and `sample`
 * (ships a minimal, correctly-scoped `pack.css`). Returns the directory path.
 */
export async function buildThemePacksFixture(dir: string): Promise<string> {
  const root = path.join(dir, "theme-packs");

  await fs.ensureDir(path.join(root, "default"));
  await fs.writeJson(
    path.join(root, "default", "meta.json"),
    sampleMeta("default", "Default", "1.0.0"),
    { spaces: 2 },
  );

  await fs.ensureDir(path.join(root, "sample"));
  await fs.writeJson(
    path.join(root, "sample", "meta.json"),
    sampleMeta("sample", "Sample", "2.1.0"),
    { spaces: 2 },
  );
  await fs.writeFile(
    path.join(root, "sample", "pack.css"),
    `html[data-theme-pack="sample"] {\n  --zd-bg: #ffffff;\n}\n`,
    "utf8",
  );

  return root;
}
