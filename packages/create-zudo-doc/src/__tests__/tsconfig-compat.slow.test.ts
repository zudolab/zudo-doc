/**
 * Shared-tsconfig compiler compatibility regression test (#4558).
 *
 * `@takazudo/zudo-doc/tsconfig.base.json` used to carry `baseUrl: "."`, and the
 * generated template re-declared it next to `"@/*": ["src/*"]`. TypeScript 7
 * removed `baseUrl` (TS5102, "Option 'baseUrl' has been removed"), so a
 * consumer on `typescript@7.0.2` (the zfb TS7 docs host's pin) could not
 * extend the shipped base directly. The base no longer sets `baseUrl` and the
 * template's alias target is explicit (`"./src/*"`, resolved relative to the
 * declaring tsconfig).
 *
 * This file proves, against the INSTALLED packed package (not workspace
 * source):
 *
 * - the default generated project still typechecks with its own TS5
 *   requirement (`pnpm check` → `zfb check` → the project's `tsc`) and builds;
 * - zfb's native resolver still maps a real `@/` import in server code AND in
 *   an island dependency without `baseUrl` (emitted HTML + island bundle), and
 *   a wrong alias target fails the build — so zfb really reads the mapping;
 * - an isolated `typescript@7.0.2` (pinned ONLY in this test's scratch
 *   compiler dir — the generator default stays `^5.9.0`) typechecks both the
 *   generated config and a minimal direct-extends project;
 * - the base's top-level `files` ambient declarations (`zfb-config-shim.d.ts`,
 *   `virtual-modules.d.ts`) still apply to a fixture that does not override
 *   `files`, shown by a typing negative control that only fails when the
 *   virtual-module type is actually bound.
 *
 * Slow tier (`pnpm test:slow`): scaffold + registry install + local pack +
 * `zfb build` + a TS7 install.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { scaffold } from "../scaffold.js";
import type { UserChoices } from "../prompts.js";
import {
  runOrThrow,
  installScaffoldedDeps,
  overrideWithLocalZudoDoc,
} from "./slow-build-helpers.js";

const TEMP_PREFIX = "create-zudo-doc-tsconfig-compat-";
const PROJECT_NAME = "tsconfig-compat-test";
// The compiler observed in the zfb TS7 docs host that copies the base solely
// to drop baseUrl (Takazudo/zudo-front-builder#4153).
const MODERN_TS_VERSION = "7.0.2";

const SERVER_MARKER = "zd-4558-server-alias-marker";
const ISLAND_MARKER = "zd-4558-island-alias-marker";

const choices: UserChoices = {
  projectName: PROJECT_NAME,
  defaultLang: "en",
  colorSchemeMode: "single",
  singleScheme: "Default Dark",
  features: [],
  packageManager: "pnpm",
};

let tempDir: string;
let projectDir: string;
let modernTscDir: string;
let directExtendsDir: string;
let originalCwd: string;

function run(cmd: string, args: string[], cwd: string) {
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, SKIP_DOC_HISTORY: "1" },
  });
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

function modernTsc(tsconfigPath: string) {
  return run("pnpm", ["exec", "tsc", "--noEmit", "-p", tsconfigPath], modernTscDir);
}

async function writeAliasFixture(dir: string): Promise<void> {
  await fs.outputFile(
    path.join(dir, "src/lib/server-marker.ts"),
    `export const SERVER_MARKER = "${SERVER_MARKER}";\n`,
  );
  await fs.outputFile(
    path.join(dir, "src/lib/island-marker.ts"),
    `export const ISLAND_MARKER = "${ISLAND_MARKER}";\n`,
  );
  await fs.outputFile(
    path.join(dir, "src/components/compat-island.tsx"),
    `"use client";

import { ISLAND_MARKER } from "@/lib/island-marker";

export default function CompatIsland() {
  return <span data-compat-island="">{ISLAND_MARKER}</span>;
}
(CompatIsland as { displayName?: string }).displayName = "CompatIsland";
`,
  );
  await fs.outputFile(
    path.join(dir, "pages/compat.tsx"),
    `import { Island } from "@takazudo/zfb";
import CompatIsland from "@/components/compat-island";
import { SERVER_MARKER } from "@/lib/server-marker";

export default function CompatPage() {
  return (
    <html lang="en">
      <body>
        <p data-compat-server="">{SERVER_MARKER}</p>
        {Island({ when: "load", children: <CompatIsland /> })}
      </body>
    </html>
  );
}
`,
  );
}

// Lives inside the scaffolded project so the bare `extends` resolves through
// the project's node_modules (the installed packed zudo-doc). It deliberately
// has no `files` key: the base's top-level `files` must reach it unmodified.
async function writeDirectExtendsFixture(dir: string): Promise<void> {
  await fs.outputJson(path.join(dir, "tsconfig.json"), {
    extends: "@takazudo/zudo-doc/tsconfig.base.json",
    include: ["src"],
  });
  await fs.outputFile(
    path.join(dir, "src/index.tsx"),
    `import type { ZfbConfig } from "zfb/config";
import { routeContext } from "virtual:zudo-doc-route-context";

export const config: Partial<ZfbConfig> = {};
export const translations: Record<string, Record<string, string>> = routeContext.translations;
export const element = <div class="direct-extends">ok</div>;
`,
  );
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
  process.chdir(tempDir);

  await scaffold(choices);
  projectDir = path.join(tempDir, PROJECT_NAME);
  installScaffoldedDeps(projectDir);
  overrideWithLocalZudoDoc(projectDir);

  await writeAliasFixture(projectDir);
  directExtendsDir = path.join(projectDir, "direct-extends");
  await writeDirectExtendsFixture(directExtendsDir);

  // TS5 default control: the project's own compiler requirement, untouched.
  runOrThrow("pnpm check", projectDir);
  runOrThrow("pnpm build", projectDir, { SKIP_DOC_HISTORY: "1" });

  modernTscDir = path.join(tempDir, "modern-tsc");
  await fs.outputJson(path.join(modernTscDir, "package.json"), {
    name: "modern-tsc",
    private: true,
    devDependencies: { typescript: MODERN_TS_VERSION },
  });
  installScaffoldedDeps(modernTscDir, true);
}, 10 * 60 * 1000);

afterAll(async () => {
  process.chdir(originalCwd);
  if (tempDir && (await fs.pathExists(tempDir))) {
    await fs.remove(tempDir);
  }
});

describe("installed shared tsconfig base", () => {
  it("ships no baseUrl and keeps the top-level ambient `files`", async () => {
    const base = await fs.readJson(
      path.join(projectDir, "node_modules/@takazudo/zudo-doc/tsconfig.base.json"),
    );
    expect(base.compilerOptions).not.toHaveProperty("baseUrl");
    expect(base.files).toEqual(["./zfb-config-shim.d.ts", "./virtual-modules.d.ts"]);
  });

  it("generated tsconfig uses an explicit relative alias target without baseUrl", async () => {
    const tsconfig = await fs.readJson(path.join(projectDir, "tsconfig.json"));
    expect(tsconfig.compilerOptions).not.toHaveProperty("baseUrl");
    expect(tsconfig.compilerOptions.paths["@/*"]).toEqual(["./src/*"]);
    expect(tsconfig).not.toHaveProperty("files");
  });
});

describe("default TS5 generated project", () => {
  it("typechecks with its own TypeScript 5 requirement", () => {
    const version = run("pnpm", ["exec", "tsc", "-v"], projectDir);
    expect(version.output).toMatch(/Version 5\./);
    // `pnpm check` already passed in beforeAll; this pins which compiler ran.
  });

  it("resolves a server-side `@/` import in the emitted page", async () => {
    const html = await fs.readFile(path.join(projectDir, "dist/compat/index.html"), "utf-8");
    expect(html).toContain(SERVER_MARKER);
    expect(html).toContain("data-zfb-island=CompatIsland");
  });

  it("resolves an island dependency's `@/` import inside the island bundle", async () => {
    const assetsDir = path.join(projectDir, "dist/assets");
    const islandBundles = (await fs.readdir(assetsDir)).filter((f) => /^islands.*\.js$/.test(f));
    const bundled = await Promise.all(
      islandBundles.map((f) => fs.readFile(path.join(assetsDir, f), "utf-8")),
    );
    expect(bundled.some((src) => src.includes(ISLAND_MARKER))).toBe(true);
  });

  it("fails the zfb build when the alias target is wrong (zfb reads the mapping)", async () => {
    const tsconfigPath = path.join(projectDir, "tsconfig.json");
    const original = await fs.readFile(tsconfigPath, "utf-8");
    try {
      await fs.writeFile(tsconfigPath, original.replace('"./src/*"', '"./src-missing/*"'));
      const result = run("pnpm", ["build"], projectDir);
      expect(result.status).not.toBe(0);
      expect(result.output).toContain("@/components/compat-island");
    } finally {
      await fs.writeFile(tsconfigPath, original);
    }
  });
});

describe(`isolated typescript@${MODERN_TS_VERSION}`, () => {
  it("is the pinned modern compiler", () => {
    expect(run("pnpm", ["exec", "tsc", "-v"], modernTscDir).output).toContain(
      `Version ${MODERN_TS_VERSION}`,
    );
  });

  it("typechecks the generated project config", () => {
    const result = modernTsc(path.join(projectDir, "tsconfig.json"));
    expect(result.output).not.toContain("TS5102");
    expect(result.status, result.output).toBe(0);
  });

  it("typechecks a minimal project that extends the base directly", () => {
    const result = modernTsc(path.join(directExtendsDir, "tsconfig.json"));
    expect(result.status, result.output).toBe(0);
  });

  it("binds the inherited virtual-module declarations (typing negative control)", async () => {
    const badFile = path.join(directExtendsDir, "src/bad.ts");
    await fs.outputFile(
      badFile,
      `import { routeContext } from "virtual:zudo-doc-route-context";
export const wrong: number = routeContext.translations;
`,
    );
    try {
      const result = modernTsc(path.join(directExtendsDir, "tsconfig.json"));
      expect(result.status).not.toBe(0);
      expect(result.output).toContain("TS2322");
      expect(result.output).toContain("Record<string, Record<string, string>>");
    } finally {
      await fs.remove(badFile);
    }
  });

  it("rejects an unresolvable `@/` import in the generated project (resolution negative control)", async () => {
    const badFile = path.join(projectDir, "src/lib/bad-alias.ts");
    await fs.outputFile(badFile, `export { nope } from "@/lib/does-not-exist";\n`);
    try {
      const result = modernTsc(path.join(projectDir, "tsconfig.json"));
      expect(result.status).not.toBe(0);
      expect(result.output).toContain("TS2307");
      expect(result.output).toContain("@/lib/does-not-exist");
    } finally {
      await fs.remove(badFile);
    }
  });
});
