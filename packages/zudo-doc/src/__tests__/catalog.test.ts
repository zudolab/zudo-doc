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

describe("@takazudo/zudo-doc/catalog", () => {
  it("aggregates every bundled theme pack, default first then alphabetical", async () => {
    const { default: catalog } = await import(resolve(PKG_ROOT, "dist/catalog.js"));

    expect(catalog.schemaVersion).toBe(1);
    expect(catalog.packs.length).toBe(31);
    expect(catalog.packs[0].slug).toBe("default");

    const rest = catalog.packs.slice(1).map((pack: { slug: string }) => pack.slug);
    expect(rest).toEqual([...rest].sort());
  });

  it("every pack carries preview.light/dark swatch fields consumers need for picker cards", async () => {
    const { default: catalog } = await import(resolve(PKG_ROOT, "dist/catalog.js"));

    for (const pack of catalog.packs) {
      for (const mode of ["light", "dark"] as const) {
        const swatches = pack.preview[mode];
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
