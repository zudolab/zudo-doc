import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ───────────────────────────────────────────────────────────────────────────
// IMPORT-GRAPH GUARD for standalone.ts (issue #3048) and icon.ts (#3286).
//
// The `zudo-doc eject logo` CLI (sibling issue #3050) imports the compiled
// `dist/auto-logo/standalone.js` directly — no preact runtime, no bundler —
// and the icon rasterizer script (#3287) does the same with
// `dist/auto-logo/icon.js`. So neither module's graph may ever reach a
// `.tsx`-derived module or `preact` itself (both would either fail to import
// outside a JSX pipeline or drag the preact runtime into a plain CLI
// script). This mirrors the node-free eval-graph guard pattern in
// `src/__tests__/preset.test.ts` (bundle exactly the reachable graph, assert
// on what's reachable) but checks reachable *input files* via esbuild's
// metafile instead of `node:*` specifiers.
// ───────────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const standaloneSrc = resolve(__dirname, "../standalone.ts");
const iconSrc = resolve(__dirname, "../icon.ts");
const autoLogoIndexSrc = resolve(__dirname, "../index.tsx");
const repoRoot = resolve(__dirname, "../../../../..");

interface EsbuildMetafile {
  inputs: Record<string, unknown>;
}
interface EsbuildLike {
  build(opts: Record<string, unknown>): Promise<{
    errors: unknown[];
    outputFiles: Array<{ text: string }>;
    metafile: EsbuildMetafile;
  }>;
}

function loadEsbuild(): EsbuildLike {
  const vitePkg = require.resolve("vite/package.json", {
    paths: [process.cwd(), __dirname, repoRoot],
  });
  const viteRequire = createRequire(vitePkg);
  return viteRequire("esbuild") as EsbuildLike;
}

function isTsxInput(path: string): boolean {
  return path.endsWith(".tsx");
}

function isPreactInput(path: string): boolean {
  return /(^|\/)node_modules\/preact(\/|$)/.test(path) || /(^|\/)preact\//.test(path);
}

describe("string-renderer module graphs are .tsx-free and preact-free", () => {
  it.each([
    ["standalone.ts", standaloneSrc],
    ["icon.ts", iconSrc],
  ])("bundles %s and reaches no .tsx module and no preact", async (name, entry) => {
    const esbuild = loadEsbuild();
    const result = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      platform: "neutral",
      format: "esm",
      logLevel: "silent",
      metafile: true,
    });

    expect(result.errors).toEqual([]);
    const inputs = Object.keys(result.metafile.inputs);
    const tsxOffenders = inputs.filter(isTsxInput);
    const preactOffenders = inputs.filter(isPreactInput);

    expect(tsxOffenders, `${name} reached .tsx module(s): ${tsxOffenders.join(", ")}`).toEqual([]);
    expect(preactOffenders, `${name} reached preact module(s): ${preactOffenders.join(", ")}`).toEqual([]);
  });

  // Self-test: prove the detector is LIVE, not dead code. auto-logo/index.tsx
  // is a known positive control — it genuinely is `.tsx` and genuinely
  // imports preact — so bundling IT must trip both checks the guard above
  // relies on.
  it("DETECTS a .tsx module and preact (guard is not dead code)", async () => {
    const esbuild = loadEsbuild();
    const result = await esbuild.build({
      entryPoints: [autoLogoIndexSrc],
      bundle: true,
      write: false,
      platform: "neutral",
      format: "esm",
      logLevel: "silent",
      metafile: true,
    });

    expect(result.errors).toEqual([]);
    const inputs = Object.keys(result.metafile.inputs);
    expect(inputs.some(isTsxInput)).toBe(true);
    expect(inputs.some(isPreactInput)).toBe(true);
  });
});
