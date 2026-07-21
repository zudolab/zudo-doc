import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { ejectLogo } from "@takazudo/zudo-doc/eject-logo";

const TEMP_PREFIX = "eject-logo-test-";

const CANONICAL_CONFIG = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    colorScheme: "Default Dark",
    siteName: "My Docs",
  }),
);
`;

const CANONICAL_CONFIG_NO_SITE_NAME = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    colorScheme: "Default Dark",
  }),
);
`;

const NONCANONICAL_SPREAD_CONFIG = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";
import { settings } from "./src/config/settings";

export default defineConfig(
  zudoDoc({
    ...settings,
  }),
);
`;

const CANONICAL_LOGO_DUPLICATE_CONFIG = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    siteName: "My Docs",
    logo: "/a.svg",
    logo: "/b.svg",
  }),
);
`;

let tempDir: string;
let projectDir: string;
let configPath: string;
let svgPath: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
  projectDir = path.join(tempDir, "project");
  await fs.ensureDir(projectDir);
  configPath = path.join(projectDir, "zfb.config.ts");
  svgPath = path.join(projectDir, "public", "img", "logo.svg");
});

afterEach(async () => {
  await fs.remove(tempDir);
});

describe("ejectLogo — missing zfb.config.ts", () => {
  it("refuses cleanly and writes nothing", async () => {
    const result = await ejectLogo({ cwd: projectDir });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("zfb.config.ts not found");
    expect(await fs.pathExists(svgPath)).toBe(false);
  });
});

describe("ejectLogo — literal config happy path", () => {
  it("writes the SVG and rewrites the logo field", async () => {
    await fs.writeFile(configPath, CANONICAL_CONFIG, "utf8");

    const result = await ejectLogo({ cwd: projectDir });
    expect(result.ok).toBe(true);

    expect(await fs.pathExists(svgPath)).toBe(true);
    const svg = await fs.readFile(svgPath, "utf8");
    expect(svg).toContain("<mask");
    expect(svg).not.toContain("var(");
    expect(svg).not.toContain("currentColor");

    const rewritten = await fs.readFile(configPath, "utf8");
    expect(rewritten).toContain('logo: "/img/logo.svg",');
  });

  it("refuses to overwrite an idempotent re-run without --force", async () => {
    await fs.writeFile(configPath, CANONICAL_CONFIG, "utf8");
    const first = await ejectLogo({ cwd: projectDir });
    expect(first.ok).toBe(true);
    const svgAfterFirst = await fs.readFile(svgPath, "utf8");

    const second = await ejectLogo({ cwd: projectDir });
    expect(second.ok).toBe(false);
    expect(second.message).toMatch(/already exists/);

    const svgAfterSecond = await fs.readFile(svgPath, "utf8");
    expect(svgAfterSecond).toBe(svgAfterFirst);
  });

  it("--force overwrites an existing SVG", async () => {
    await fs.writeFile(configPath, CANONICAL_CONFIG, "utf8");
    await ejectLogo({ cwd: projectDir });

    const result = await ejectLogo({ cwd: projectDir, force: true });
    expect(result.ok).toBe(true);
    expect(await fs.pathExists(svgPath)).toBe(true);
  });
});

describe("ejectLogo — seed resolution", () => {
  it("defaults the seed to \"Docs\" when siteName is absent from a literal config", async () => {
    await fs.writeFile(configPath, CANONICAL_CONFIG_NO_SITE_NAME, "utf8");
    const withDefaultSeed = await ejectLogo({ cwd: projectDir });
    expect(withDefaultSeed.ok).toBe(true);
    const defaultSvg = await fs.readFile(svgPath, "utf8");

    await fs.remove(svgPath);
    const withExplicitDocsSeed = await ejectLogo({ cwd: projectDir, seed: "Docs", force: true });
    expect(withExplicitDocsSeed.ok).toBe(true);
    const explicitSvg = await fs.readFile(svgPath, "utf8");

    // Same seed ("Docs" either way) must render byte-identical output.
    expect(explicitSvg).toBe(defaultSvg);
  });

  it("refuses without --seed when siteName cannot be read (non-literal config)", async () => {
    await fs.writeFile(configPath, NONCANONICAL_SPREAD_CONFIG, "utf8");
    const result = await ejectLogo({ cwd: projectDir });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("--seed");
    expect(await fs.pathExists(svgPath)).toBe(false);
    expect(await fs.readFile(configPath, "utf8")).toBe(NONCANONICAL_SPREAD_CONFIG);
  });

  it("still writes the SVG when --seed is supplied for a non-literal config (rewrite is separately refused)", async () => {
    await fs.writeFile(configPath, NONCANONICAL_SPREAD_CONFIG, "utf8");
    const result = await ejectLogo({ cwd: projectDir, seed: "My Docs" });
    expect(result.ok).toBe(false);
    expect(result.partial).toBe(true);
    expect(await fs.pathExists(svgPath)).toBe(true);
  });
});

describe("ejectLogo — precompute ordering (config rewrite refusal)", () => {
  it("leaves the SVG written and exits nonzero when the logo field is a duplicate", async () => {
    await fs.writeFile(configPath, CANONICAL_LOGO_DUPLICATE_CONFIG, "utf8");

    const result = await ejectLogo({ cwd: projectDir });
    expect(result.ok).toBe(false);
    expect(result.partial).toBe(true);
    expect(result.message).toContain("Wrote");
    expect(result.message).toContain('logo: "/img/logo.svg",');

    expect(await fs.pathExists(svgPath)).toBe(true);
    // Config untouched — the pre-existing duplicate members survive verbatim.
    expect(await fs.readFile(configPath, "utf8")).toBe(CANONICAL_LOGO_DUPLICATE_CONFIG);
  });
});
