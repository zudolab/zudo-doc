// Fast-tier assertion for the `@takazudo/zudo-doc/catalog` browser-safe data
// export (zudolab/zudo-doc#3349, epic #3345 "theme catalog single-sourcing").
//
// Assumes `dist/catalog.js` is already populated by a prior
// `pnpm --filter @takazudo/zudo-doc build` (same precondition
// `check-catalog.mjs`'s prepack guard relies on) — this test only imports the
// generated artifact, it never triggers a build itself, so it stays cheap
// enough for the fast unit-test tier.

import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "../..");
const DIST_DTS = resolve(PKG_ROOT, "dist/catalog.d.ts");

describe("@takazudo/zudo-doc/catalog", () => {
  it("aggregates every bundled theme pack, default first then alphabetical", async () => {
    const { default: catalog } = await import(resolve(PKG_ROOT, "dist/catalog.js"));

    expect(catalog.schemaVersion).toBe(2);
    expect(catalog.packs.length).toBe(31);
    expect(catalog.packs[0].slug).toBe("default");

    const rest = catalog.packs.slice(1).map((pack: { slug: string }) => pack.slug);
    expect(rest).toEqual([...rest].sort());
  });

  it("every pack carries preview.light/dark swatch fields consumers need for picker cards", async () => {
    const { default: catalog } = await import(resolve(PKG_ROOT, "dist/catalog.js"));

    for (const pack of catalog.packs) {
      expect(typeof pack.hasStylesheet, `${pack.slug}.hasStylesheet`).toBe("boolean");
      for (const mode of ["light", "dark"] as const) {
        const swatches = pack.meta.preview[mode];
        expect(swatches.bg, `${pack.slug}.preview.${mode}.bg`).toBeTruthy();
        expect(swatches.fg, `${pack.slug}.preview.${mode}.fg`).toBeTruthy();
        expect(swatches.accent, `${pack.slug}.preview.${mode}.accent`).toBeTruthy();
        expect(swatches.syntax.keyword, `${pack.slug}.preview.${mode}.syntax.keyword`).toBeTruthy();
        expect(swatches.syntax.string, `${pack.slug}.preview.${mode}.syntax.string`).toBeTruthy();
        expect(swatches.syntax.comment, `${pack.slug}.preview.${mode}.syntax.comment`).toBeTruthy();
        expect(swatches.syntax.callable, `${pack.slug}.preview.${mode}.syntax.callable`).toBeTruthy();
      }
    }
  });

  it("carries hasStylesheet from the filesystem registry, not a slug heuristic", async () => {
    const { default: catalog } = await import(resolve(PKG_ROOT, "dist/catalog.js"));
    const { loadThemePackRegistry } = await import(
      resolve(PKG_ROOT, "dist/theme-packs-registry/load-registry.js"),
    );
    const { resolveEnabledPacks } = await import(
      resolve(PKG_ROOT, "dist/theme-packs-registry/index.js"),
    );
    const registry = loadThemePackRegistry(resolve(PKG_ROOT, "src/theme-packs"));
    const enabled = resolveEnabledPacks(registry, {});

    expect(
      catalog.packs.map((pack: { slug: string; hasStylesheet: boolean }) => [
        pack.slug,
        pack.hasStylesheet,
      ]),
    ).toEqual(
      enabled.map((entry: { slug: string; hasStylesheet: boolean }) => [
        entry.slug,
        entry.hasStylesheet,
      ]),
    );
  });

  it("exports a v2 validator that rejects a v1-shaped manifest", async () => {
    const { default: catalog, validateThemePackCatalog } = await import(
      resolve(PKG_ROOT, "dist/catalog.js"),
    );

    expect(validateThemePackCatalog(catalog)).toBe(catalog);
    const v1Manifest = {
      schemaVersion: 1,
      packs: catalog.packs.map((pack: { meta: unknown }) => pack.meta),
    };
    expect(() => validateThemePackCatalog(v1Manifest)).toThrow(
      /schemaVersion 1.*expected 2/,
    );
  });

  it("declares the v2 manifest and entry types in the generated declaration", async () => {
    const fs = await import("node:fs/promises");
    const dts = await fs.readFile(DIST_DTS, "utf8");

    expect(dts).toContain("interface ThemePackCatalogEntry");
    expect(dts).toContain("interface ThemePacksCatalogManifest");
    expect(dts).toContain("hasStylesheet: boolean");
    expect(dts).toContain("validateThemePackCatalog");
  });

  it("exposes the ./catalog subpath export", async () => {
    const fs = await import("node:fs/promises");
    const pkg = JSON.parse(await fs.readFile(resolve(PKG_ROOT, "package.json"), "utf8")) as {
      exports: Record<string, { types?: string; default?: string }>;
    };
    expect(pkg.exports["./catalog"]).toEqual({
      types: "./dist/catalog.d.ts",
      default: "./dist/catalog.js",
    });
  });
});
