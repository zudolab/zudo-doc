import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { listThemePacks, formatThemeList } from "@takazudo/zudo-doc/theme-cli";
import { buildThemePacksFixture } from "./theme-packs-fixture.js";

const TEMP_PREFIX = "theme-cli-list-test-";

let tempDir: string;
let themePacksDir: string;
let projectDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
  themePacksDir = await buildThemePacksFixture(tempDir);
  projectDir = path.join(tempDir, "project");
  await fs.ensureDir(projectDir);
});

afterEach(async () => {
  await fs.remove(tempDir);
});

describe("listThemePacks", () => {
  it("lists every installed pack, in canonical (alphabetical) order", async () => {
    const result = await listThemePacks({ cwd: projectDir, themePacksDir });
    expect(result.rows.map((r) => r.slug)).toEqual(["default", "sample"]);
  });

  it("carries slug/name/mode/version/description for each row", async () => {
    const result = await listThemePacks({ cwd: projectDir, themePacksDir });
    const sample = result.rows.find((r) => r.slug === "sample");
    expect(sample).toMatchObject({
      slug: "sample",
      name: "Sample",
      mode: "light",
      version: "2.1.0",
      description: "Sample fixture pack for theme-cli tests.",
    });
  });

  it("marks the active pack when zfb.config.ts configures a non-default slug", async () => {
    await fs.writeFile(
      path.join(projectDir, "zfb.config.ts"),
      `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    themePack: "sample",
  }),
);
`,
      "utf8",
    );

    const result = await listThemePacks({ cwd: projectDir, themePacksDir });
    expect(result.activeSlug).toBe("sample");
    expect(result.activeDetected).toBe(true);
    expect(result.rows.find((r) => r.slug === "sample")?.active).toBe(true);
    expect(result.rows.find((r) => r.slug === "default")?.active).toBe(false);
  });

  it("marks \"default\" active (with detected: false) when zfb.config.ts is missing", async () => {
    const result = await listThemePacks({ cwd: projectDir, themePacksDir });
    expect(result.activeSlug).toBe("default");
    expect(result.activeDetected).toBe(false);
    expect(result.rows.find((r) => r.slug === "default")?.active).toBe(true);
  });
});

describe("formatThemeList", () => {
  it("renders slug, name, mode, version, description, and marks the active row", async () => {
    const result = await listThemePacks({ cwd: projectDir, themePacksDir });
    const output = formatThemeList(result);

    expect(output).toContain("default");
    expect(output).toContain("sample");
    expect(output).toContain("Sample");
    expect(output).toContain("2.1.0");
    expect(output).toContain("Sample fixture pack for theme-cli tests.");
    expect(output).toContain("(active)");
    expect(output).toContain("zudo-doc theme apply");
  });

  it("notes when the active slug is a fallback default, not a confirmed reading", async () => {
    const result = await listThemePacks({ cwd: projectDir, themePacksDir });
    const output = formatThemeList(result);
    expect(output.toLowerCase()).toContain("no zfb.config.ts");
  });

  it("reports an empty catalog without crashing", () => {
    const output = formatThemeList({ rows: [], activeSlug: "default", activeDetected: false });
    expect(output.length).toBeGreaterThan(0);
  });
});
