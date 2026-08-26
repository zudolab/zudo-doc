// Contract suite for the browser-safe `./theme-packs-registry` surface
// (zudolab/zudo-doc#3679).
//
// The source and emitted declaration graph checks intentionally reuse the
// same detector as `site-schema`. The filesystem loader is tested separately
// in `load-registry.test.ts`; it must not be reachable from this barrel.

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildThemePackRegistry,
  schemaVersion,
  type ThemePacksCatalogManifest,
} from "../index.js";
import type { ThemePackMeta } from "../../route-context-payload/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "../../..");
const REPO_ROOT = resolve(PKG_ROOT, "../..");
const SRC_ENTRY = resolve(PKG_ROOT, "src/theme-packs-registry/index.ts");
const DIST_DTS = resolve(PKG_ROOT, "dist/theme-packs-registry/index.d.ts");

interface RegistryGraph {
  analyzeDeclarationGraph(entry: string): {
    violations: Array<{ specifier: string; label: string; importer: string }>;
    files: string[];
  };
  analyzeSiteSchemaGraph(args: { entry: string; resolveFrom: string[] }): Promise<{
    violations: Array<{ specifier: string; label: string; importer: string }>;
    specifiers: string[];
  }>;
}

async function loadGraphHelper(): Promise<RegistryGraph> {
  const url = pathToFileURL(resolve(PKG_ROOT, "scripts/site-schema-graph.mjs")).href;
  return (await import(/* @vite-ignore */ url)) as RegistryGraph;
}

function makeMeta(slug: string): ThemePackMeta {
  return {
    schemaVersion: 1,
    slug,
    name: slug,
    description: `${slug} theme pack`,
    mode: "light",
    version: "1.0.0",
    fonts: { sans: "System", mono: "System", loaded: [] },
    preview: {
      light: {
        bg: "#fff",
        fg: "#000",
        accent: "#00f",
        syntax: { keyword: "#00f", string: "#080", comment: "#888", callable: "#800" },
      },
      dark: {
        bg: "#000",
        fg: "#fff",
        accent: "#0ff",
        syntax: { keyword: "#0ff", string: "#8f8", comment: "#aaa", callable: "#f88" },
      },
    },
  };
}

const CATALOG: ThemePacksCatalogManifest = {
  schemaVersion: 2,
  packs: [
    { slug: "zeta", meta: makeMeta("zeta"), hasStylesheet: true },
    { slug: "default", meta: makeMeta("default"), hasStylesheet: false },
    { slug: "alpha", meta: makeMeta("alpha"), hasStylesheet: true },
  ],
};

describe("buildThemePackRegistry", () => {
  it("exposes its own numeric contract version", () => {
    expect(schemaVersion).toBe(1);
  });

  it("accepts the whole catalog v2 manifest and resolves default first, then alphabetically", () => {
    const registry = buildThemePackRegistry(CATALOG, {});

    expect(registry.map((entry) => entry.slug)).toEqual(["default", "alpha", "zeta"]);
    expect(registry.map((entry) => entry.hasStylesheet)).toEqual([false, true, true]);
  });

  it("passes the settings projection through to the existing resolver", () => {
    const registry = buildThemePackRegistry(CATALOG, {
      themePack: "zeta",
      themePacks: ["zeta", "alpha"],
    });

    expect(registry.map((entry) => entry.slug)).toEqual(["zeta", "alpha"]);
  });

  it("rejects a v1 manifest before interpreting its packs", () => {
    const v1Manifest = {
      schemaVersion: 1,
      packs: CATALOG.packs.map((entry) => entry.meta),
    };

    expect(() =>
      buildThemePackRegistry(v1Manifest as unknown as ThemePacksCatalogManifest, {}),
    ).toThrow(/schemaVersion 1.*expected 2/);
  });

  it("retains the resolver's loud duplicate and unknown slug errors", () => {
    expect(() =>
      buildThemePackRegistry(CATALOG, { themePacks: ["alpha", "alpha"], themePack: "alpha" }),
    ).toThrow(/duplicate/i);
    expect(() =>
      buildThemePackRegistry(CATALOG, { themePacks: ["missing"], themePack: "missing" }),
    ).toThrow(/missing/);
  });
});

describe("./theme-packs-registry browser safety", () => {
  it("reaches no forbidden source specifier", async () => {
    const { analyzeSiteSchemaGraph } = await loadGraphHelper();
    const { violations, specifiers } = await analyzeSiteSchemaGraph({
      entry: SRC_ENTRY,
      resolveFrom: [PKG_ROOT, REPO_ROOT, __dirname],
    });

    expect(
      violations,
      violations.map((v) => `${v.specifier} (${v.label}) via ${v.importer}`).join("\n"),
    ).toEqual([]);
    expect(specifiers.length).toBeGreaterThan(0);
  });

  it("keeps the emitted declaration graph free of forbidden specifiers", async () => {
    const { analyzeDeclarationGraph } = await loadGraphHelper();
    expect(
      existsSync(DIST_DTS),
      `${DIST_DTS} missing — run \`pnpm --filter @takazudo/zudo-doc build\``,
    ).toBe(true);

    const { violations, files } = analyzeDeclarationGraph(DIST_DTS);
    expect(
      violations,
      violations.map((v) => `${v.specifier} (${v.label}) declared in ${v.importer}`).join("\n"),
    ).toEqual([]);
    expect(files.length).toBeGreaterThan(1);
  });

  it("does not expose the filesystem loader through the browser-safe barrel", async () => {
    const mod = await import("../index.js");
    expect(mod).not.toHaveProperty("loadThemePackRegistry");
  });

  it("declares the builder contract in the emitted declaration", () => {
    expect(existsSync(DIST_DTS), `${DIST_DTS} missing — run package build`).toBe(true);
    const dts = readFileSync(DIST_DTS, "utf8");
    expect(dts).toContain("buildThemePackRegistry");
    expect(dts).toContain("ThemePacksCatalogManifest");
    expect(dts).toContain("ThemePackSettingsProjection");
  });
});
