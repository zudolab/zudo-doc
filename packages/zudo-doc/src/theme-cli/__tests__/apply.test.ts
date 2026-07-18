import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { applyThemePack, readThemePackProvenance } from "@takazudo/zudo-doc/theme-cli";
import { buildThemePacksFixture } from "./theme-packs-fixture.js";

const TEMP_PREFIX = "theme-cli-apply-test-";

const CANONICAL_CONFIG = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    colorScheme: "Default Dark",
    siteName: "Docs",
  }),
);
`;

const NONCANONICAL_CONFIG = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";
import { settings } from "./src/config/settings";

export default defineConfig(
  zudoDoc({
    ...settings,
  }),
);
`;

let tempDir: string;
let themePacksDir: string;
let projectDir: string;
let configPath: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
  themePacksDir = await buildThemePacksFixture(tempDir);
  projectDir = path.join(tempDir, "project");
  await fs.ensureDir(projectDir);
  configPath = path.join(projectDir, "zfb.config.ts");
});

afterEach(async () => {
  await fs.remove(tempDir);
});

describe("applyThemePack — missing file", () => {
  it("refuses cleanly when zfb.config.ts does not exist", async () => {
    const result = await applyThemePack("sample", { cwd: projectDir, themePacksDir });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("zfb.config.ts not found");
    expect(await fs.pathExists(configPath)).toBe(false);
  });

  it("does not create .zudo-doc.json when the config file is missing", async () => {
    await applyThemePack("sample", { cwd: projectDir, themePacksDir });
    expect(await fs.pathExists(path.join(projectDir, ".zudo-doc.json"))).toBe(false);
  });
});

describe("applyThemePack — unknown slug", () => {
  it("refuses and lists the available slugs, without touching zfb.config.ts", async () => {
    await fs.writeFile(configPath, CANONICAL_CONFIG, "utf8");
    const result = await applyThemePack("does-not-exist", { cwd: projectDir, themePacksDir });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Unknown theme pack "does-not-exist"');
    expect(result.message).toContain("default");
    expect(result.message).toContain("sample");
    expect(await fs.readFile(configPath, "utf8")).toBe(CANONICAL_CONFIG);
  });
});

describe("applyThemePack — canonical config", () => {
  it("rewrites zfb.config.ts and records .zudo-doc.json provenance", async () => {
    await fs.writeFile(configPath, CANONICAL_CONFIG, "utf8");
    const fixedNow = () => new Date("2026-07-16T00:00:00.000Z");

    const result = await applyThemePack("sample", { cwd: projectDir, themePacksDir, now: fixedNow });
    expect(result.ok).toBe(true);
    expect(result.changed).toBe(true);

    const rewritten = await fs.readFile(configPath, "utf8");
    expect(rewritten).toContain('themePack: "sample",');

    const provenance = await readThemePackProvenance(projectDir);
    expect(provenance).toEqual({
      schemaVersion: 1,
      slug: "sample",
      packVersion: "2.1.0",
      appliedAt: "2026-07-16T00:00:00.000Z",
    });
  });

  it("preserves pre-existing .zudo-doc.json keys (eject provenance) additively", async () => {
    await fs.writeFile(configPath, CANONICAL_CONFIG, "utf8");
    await fs.writeJson(
      path.join(projectDir, ".zudo-doc.json"),
      { packageVersion: "3.3.0", ejected: { header: "src/components/zudo-doc/header" } },
      { spaces: 2 },
    );

    await applyThemePack("sample", { cwd: projectDir, themePacksDir });

    const raw = await fs.readJson(path.join(projectDir, ".zudo-doc.json"));
    expect(raw.packageVersion).toBe("3.3.0");
    expect(raw.ejected).toEqual({ header: "src/components/zudo-doc/header" });
    expect(raw.themePack).toMatchObject({ schemaVersion: 1, slug: "sample", packVersion: "2.1.0" });
  });
});

describe("applyThemePack — idempotency", () => {
  it("re-applying the already-active slug is a no-op on zfb.config.ts", async () => {
    await fs.writeFile(configPath, CANONICAL_CONFIG, "utf8");

    const first = await applyThemePack("sample", { cwd: projectDir, themePacksDir });
    expect(first.ok).toBe(true);
    expect(first.changed).toBe(true);
    const afterFirst = await fs.readFile(configPath, "utf8");

    const second = await applyThemePack("sample", { cwd: projectDir, themePacksDir });
    expect(second.ok).toBe(true);
    expect(second.changed).toBe(false);
    const afterSecond = await fs.readFile(configPath, "utf8");

    expect(afterSecond).toBe(afterFirst);
  });

  it("still refreshes .zudo-doc.json provenance on an idempotent re-apply", async () => {
    await fs.writeFile(configPath, CANONICAL_CONFIG, "utf8");
    await applyThemePack("sample", {
      cwd: projectDir,
      themePacksDir,
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });
    await applyThemePack("sample", {
      cwd: projectDir,
      themePacksDir,
      now: () => new Date("2026-07-16T00:00:00.000Z"),
    });

    const provenance = await readThemePackProvenance(projectDir);
    expect(provenance?.appliedAt).toBe("2026-07-16T00:00:00.000Z");
  });
});

describe("applyThemePack — noncanonical config (refusal, never corrupt)", () => {
  it("refuses a spread-argument config and leaves the file byte-identical", async () => {
    await fs.writeFile(configPath, NONCANONICAL_CONFIG, "utf8");

    const result = await applyThemePack("sample", { cwd: projectDir, themePacksDir });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/spread argument/i);

    const afterAttempt = await fs.readFile(configPath, "utf8");
    expect(afterAttempt).toBe(NONCANONICAL_CONFIG);
  });

  it("does not write .zudo-doc.json when the rewrite is refused", async () => {
    await fs.writeFile(configPath, NONCANONICAL_CONFIG, "utf8");
    await applyThemePack("sample", { cwd: projectDir, themePacksDir });
    expect(await fs.pathExists(path.join(projectDir, ".zudo-doc.json"))).toBe(false);
  });

  it("leaves a pre-existing .zudo-doc.json completely untouched on refusal", async () => {
    await fs.writeFile(configPath, NONCANONICAL_CONFIG, "utf8");
    const provenanceFile = path.join(projectDir, ".zudo-doc.json");
    await fs.writeJson(provenanceFile, { packageVersion: "3.3.0", ejected: {} }, { spaces: 2 });
    const before = await fs.readFile(provenanceFile, "utf8");

    await applyThemePack("sample", { cwd: projectDir, themePacksDir });

    const after = await fs.readFile(provenanceFile, "utf8");
    expect(after).toBe(before);
  });
});

describe("applyThemePack — apply default", () => {
  it("sets themePack to \"default\" explicitly (not a field removal)", async () => {
    await fs.writeFile(
      configPath,
      `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    themePack: "sample",
    siteName: "Docs",
  }),
);
`,
      "utf8",
    );

    const result = await applyThemePack("default", { cwd: projectDir, themePacksDir });
    expect(result.ok).toBe(true);
    const rewritten = await fs.readFile(configPath, "utf8");
    expect(rewritten).toContain('themePack: "default",');
  });
});
