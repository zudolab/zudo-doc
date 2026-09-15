// Contract suite for the asset-viewer zfb-free subpaths (zudolab/zudo-doc#4225).
//
// #4221 and #4223 split the asset-page and asset-index-page factories into a
// zfb-bound `index.tsx` factory plus a set of plain-prop, zfb-free modules
// (`asset-page/{body,components,script,shared}`,
// `asset-index-page/{body,tree,script}`) so a host can render the asset
// viewer body without a `ChromeContext` or `@takazudo/zfb*`. This sub is the
// single owner of publishing, guarding, and documenting that split.
//
// Modeled on `src/__tests__/site-schema.test.ts` (~:454-500) — same shared
// `scripts/site-schema-graph.mjs` detector, but with `preact` ALLOWED (these
// modules render Preact JSX) via the narrower
// `ASSET_VIEWER_FORBIDDEN_SPECIFIERS` rule set that module exports alongside
// the site-schema default.
//
// Three things are pinned here:
//   1. every new subpath exists in package.json#exports, pointing at the
//      matching `dist/*` file, in the same `{ types, default }` shape as its
//      neighbours;
//   2. the publish-time guard (`check-asset-viewer-exports.mjs`) is wired
//      into `check:prepack-contract`;
//   3. NOTHING reachable from the zfb-free modules' source graph is a
//      `node:*` builtin, a `virtual:*` module, an `@takazudo/zfb*` package,
//      or a direct `doclayout/`/`chrome/` import — with a self-test proving
//      the detector actually catches the `doclayout` → `@takazudo/zfb` path
//      (rather than being dead code that never fires).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "../..");
const REPO_ROOT = resolve(PKG_ROOT, "../..");

// The detector is shared verbatim with the `prepack` guard
// (`scripts/check-asset-viewer-exports.mjs`) so the two can never disagree
// about what counts as browser-unsafe. Loaded through a runtime URL rather
// than a literal specifier because it is plain `.mjs` with no declarations.
interface SiteSchemaGraphRule {
  pattern: RegExp;
  label: string;
}
interface SiteSchemaGraph {
  ASSET_VIEWER_FORBIDDEN_SPECIFIERS: SiteSchemaGraphRule[];
  forbiddenLabel(specifier: string, rules?: SiteSchemaGraphRule[]): string | undefined;
  analyzeSiteSchemaGraph(args: {
    entry: string;
    resolveFrom: string[];
    rules?: SiteSchemaGraphRule[];
  }): Promise<{
    violations: Array<{ specifier: string; label: string; importer: string }>;
    specifiers: string[];
  }>;
}

async function loadGraphHelper(): Promise<SiteSchemaGraph> {
  const url = pathToFileURL(resolve(PKG_ROOT, "scripts/site-schema-graph.mjs")).href;
  return (await import(/* @vite-ignore */ url)) as SiteSchemaGraph;
}

function readPkgJson(): { exports: Record<string, unknown>; scripts: Record<string, string> } {
  return JSON.parse(readFileSync(resolve(PKG_ROOT, "package.json"), "utf8"));
}

/** Every new zfb-free module the split introduced — the entries this guard protects. */
const ZFB_FREE_ENTRIES = [
  "src/asset-page/body.tsx",
  "src/asset-page/components.tsx",
  "src/asset-page/script.ts",
  "src/asset-page/shared.ts",
  "src/asset-index-page/body.tsx",
  "src/asset-index-page/tree.ts",
  "src/asset-index-page/script.ts",
] as const;

/** The zfb-BOUND factory modules — used only by the self-test below. */
const FACTORY_ENTRIES = ["src/asset-page/index.tsx", "src/asset-index-page/index.tsx"] as const;

// ---------------------------------------------------------------------------
// (1) Exports-map entries
// ---------------------------------------------------------------------------

describe("asset-viewer subpath exports", () => {
  const expectedEntries: Record<string, { types: string; default: string }> = {
    "./asset-page/body": {
      types: "./dist/asset-page/body.d.ts",
      default: "./dist/asset-page/body.js",
    },
    "./asset-page/components": {
      types: "./dist/asset-page/components.d.ts",
      default: "./dist/asset-page/components.js",
    },
    "./asset-page/script": {
      types: "./dist/asset-page/script.d.ts",
      default: "./dist/asset-page/script.js",
    },
    "./asset-index-page": {
      types: "./dist/asset-index-page/index.d.ts",
      default: "./dist/asset-index-page/index.js",
    },
    "./asset-index-page/body": {
      types: "./dist/asset-index-page/body.d.ts",
      default: "./dist/asset-index-page/body.js",
    },
    "./asset-index-page/tree": {
      types: "./dist/asset-index-page/tree.d.ts",
      default: "./dist/asset-index-page/tree.js",
    },
    "./asset-index-page/script": {
      types: "./dist/asset-index-page/script.d.ts",
      default: "./dist/asset-index-page/script.js",
    },
  };

  it.each(Object.entries(expectedEntries))(
    "%s points at its built dist file, same shape as its neighbours",
    (subpath, expected) => {
      const pkg = readPkgJson();
      expect(pkg.exports[subpath]).toEqual(expected);
    },
  );

  it("is guarded at publish time by check-asset-viewer-exports.mjs", () => {
    const pkg = readPkgJson();
    expect(pkg.scripts["check:prepack-contract"]).toContain("check-asset-viewer-exports.mjs");
    expect(pkg.scripts.prepack).toBe("pnpm check:prepack-contract");
  });
});

// ---------------------------------------------------------------------------
// (2) Browser safety — bundled source graph (preact ALLOWED)
// ---------------------------------------------------------------------------

describe("asset-viewer zfb-free modules stay zfb-free", () => {
  it.each(ZFB_FREE_ENTRIES)("%s reaches no forbidden specifier", async (relPath) => {
    const { analyzeSiteSchemaGraph, ASSET_VIEWER_FORBIDDEN_SPECIFIERS } = await loadGraphHelper();
    const { violations } = await analyzeSiteSchemaGraph({
      entry: resolve(PKG_ROOT, relPath),
      resolveFrom: [PKG_ROOT, REPO_ROOT, __dirname],
      rules: ASSET_VIEWER_FORBIDDEN_SPECIFIERS,
    });
    expect(
      violations,
      violations.map((v) => `${v.specifier} (${v.label}) via ${v.importer}`).join("\n"),
    ).toEqual([]);
  });

  it("actually walks a graph rather than short-circuiting", async () => {
    // Unlike the pure leaf modules (script.ts / shared.ts / tree.ts — which
    // carry no runtime imports once type-only imports are elided), the two
    // `.tsx` body modules pull in several relative runtime specifiers. This
    // is the sanity check site-schema.test.ts runs once on its single
    // barrel entry — split out here because it does not hold per-entry over
    // this guard's several, much smaller, leaf modules.
    const { analyzeSiteSchemaGraph, ASSET_VIEWER_FORBIDDEN_SPECIFIERS } = await loadGraphHelper();
    for (const relPath of ["src/asset-page/body.tsx", "src/asset-index-page/body.tsx"] as const) {
      const { specifiers } = await analyzeSiteSchemaGraph({
        entry: resolve(PKG_ROOT, relPath),
        resolveFrom: [PKG_ROOT, REPO_ROOT, __dirname],
        rules: ASSET_VIEWER_FORBIDDEN_SPECIFIERS,
      });
      expect(specifiers.length).toBeGreaterThan(0);
    }
  });

  it("ALLOWS preact, unlike the site-schema rule set", async () => {
    const { forbiddenLabel, ASSET_VIEWER_FORBIDDEN_SPECIFIERS } = await loadGraphHelper();
    expect(forbiddenLabel("preact", ASSET_VIEWER_FORBIDDEN_SPECIFIERS)).toBeUndefined();
    expect(forbiddenLabel("preact/hooks", ASSET_VIEWER_FORBIDDEN_SPECIFIERS)).toBeUndefined();
    expect(forbiddenLabel("preact/jsx-runtime", ASSET_VIEWER_FORBIDDEN_SPECIFIERS)).toBeUndefined();
  });

  it("DETECTS a forbidden specifier (guard is not dead code)", async () => {
    const { forbiddenLabel, ASSET_VIEWER_FORBIDDEN_SPECIFIERS } = await loadGraphHelper();
    expect(forbiddenLabel("node:fs", ASSET_VIEWER_FORBIDDEN_SPECIFIERS)).toBe("node builtin");
    expect(forbiddenLabel("@takazudo/zfb", ASSET_VIEWER_FORBIDDEN_SPECIFIERS)).toBe("zfb engine package");
    expect(forbiddenLabel("@takazudo/zfb-runtime", ASSET_VIEWER_FORBIDDEN_SPECIFIERS)).toBe(
      "zfb engine package",
    );
    expect(forbiddenLabel("virtual:zudo-doc-route-context", ASSET_VIEWER_FORBIDDEN_SPECIFIERS)).toBe(
      "zfb virtual module",
    );
    expect(forbiddenLabel("../doclayout/index.js", ASSET_VIEWER_FORBIDDEN_SPECIFIERS)).toBe(
      "doclayout module",
    );
    expect(forbiddenLabel("../chrome/derive.js", ASSET_VIEWER_FORBIDDEN_SPECIFIERS)).toBe(
      "chrome module",
    );
    expect(forbiddenLabel("../slug/index.js", ASSET_VIEWER_FORBIDDEN_SPECIFIERS)).toBeUndefined();
  });

  // Self-test: proves the checker really catches the doclayout/chrome →
  // @takazudo/zfb path rather than passing every entry vacuously.
  // `asset-page/index.tsx` and `asset-index-page/index.tsx` (the pre-split
  // factories) both import `../doclayout/index.js` and `../chrome/*.js`
  // directly, so the full rule set below — the one this guard actually
  // ships — must flag both.
  it.each(FACTORY_ENTRIES)(
    "SELF-TEST: %s is flagged for its direct doclayout/chrome imports",
    async (relPath) => {
      const { analyzeSiteSchemaGraph, ASSET_VIEWER_FORBIDDEN_SPECIFIERS } = await loadGraphHelper();
      const { violations } = await analyzeSiteSchemaGraph({
        entry: resolve(PKG_ROOT, relPath),
        resolveFrom: [PKG_ROOT, REPO_ROOT, __dirname],
        rules: ASSET_VIEWER_FORBIDDEN_SPECIFIERS,
      });
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.label === "doclayout module")).toBe(true);
      expect(violations.some((v) => v.label === "chrome module")).toBe(true);
    },
  );

  // Second half of the self-test: `../doclayout/index.js` itself imports
  // `@takazudo/zfb`/`@takazudo/zfb-runtime` directly (see
  // `src/doclayout/doc-layout-with-defaults.tsx` and `doc-layout.tsx`) — so
  // the "doclayout → @takazudo/zfb" path the module comment above promises
  // is real, not just an assumption. Checked with a reduced rule set (no
  // doclayout/chrome rule) so the walk isn't stopped at the doclayout
  // boundary before it can reach zfb.
  it("SELF-TEST: doclayout itself reaches @takazudo/zfb (the path the doclayout/chrome rule exists to pre-empt)", async () => {
    const { analyzeSiteSchemaGraph, ASSET_VIEWER_FORBIDDEN_SPECIFIERS } = await loadGraphHelper();
    const zfbOnlyRules = ASSET_VIEWER_FORBIDDEN_SPECIFIERS.filter(
      (rule) => rule.label !== "doclayout module" && rule.label !== "chrome module",
    );
    for (const relPath of FACTORY_ENTRIES) {
      const { violations } = await analyzeSiteSchemaGraph({
        entry: resolve(PKG_ROOT, relPath),
        resolveFrom: [PKG_ROOT, REPO_ROOT, __dirname],
        rules: zfbOnlyRules,
      });
      expect(violations.some((v) => v.label === "zfb engine package")).toBe(true);
    }
  });
});
