import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { detectActiveThemePack, resolveZfbConfigPath, ZFB_CONFIG_FILENAME } from "../config-io.js";

const TEMP_PREFIX = "theme-cli-config-io-test-";

let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
});

afterEach(async () => {
  await fs.remove(tempDir);
});

async function writeConfig(content: string): Promise<void> {
  await fs.writeFile(resolveZfbConfigPath(tempDir), content, "utf8");
}

describe("resolveZfbConfigPath", () => {
  it("joins cwd with the fixed zfb.config.ts filename", () => {
    expect(resolveZfbConfigPath("/some/project")).toBe(
      path.join("/some/project", ZFB_CONFIG_FILENAME),
    );
  });
});

describe("detectActiveThemePack", () => {
  it("falls back to the documented default (detected: false) when zfb.config.ts is missing", async () => {
    const result = await detectActiveThemePack(tempDir);
    expect(result).toEqual({ slug: "default", detected: false });
  });

  it("reports the documented default (detected: true) when the field is absent from a canonical config", async () => {
    await writeConfig(`import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    siteName: "Docs",
  }),
);
`);
    const result = await detectActiveThemePack(tempDir);
    expect(result).toEqual({ slug: "default", detected: true });
  });

  it("reads the configured slug from a canonical config", async () => {
    await writeConfig(`import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    themePack: "foundry",
    siteName: "Docs",
  }),
);
`);
    const result = await detectActiveThemePack(tempDir);
    expect(result).toEqual({ slug: "foundry", detected: true });
  });

  it("falls back gracefully (never throws) on a noncanonical spread config", async () => {
    await writeConfig(`import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";
import { settings } from "./src/config/settings";

export default defineConfig(
  zudoDoc({
    ...settings,
  }),
);
`);
    await expect(detectActiveThemePack(tempDir)).resolves.toEqual({
      slug: "default",
      detected: false,
    });
  });

  it("falls back gracefully on unsupported syntax (template literal interpolation)", async () => {
    await writeConfig(`import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

const name = "Docs";

export default defineConfig(
  zudoDoc({
    siteName: \`Hello \${name}\`,
  }),
);
`);
    await expect(detectActiveThemePack(tempDir)).resolves.toEqual({
      slug: "default",
      detected: false,
    });
  });
});
