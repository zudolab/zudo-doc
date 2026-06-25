import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(__dirname, "..");
const repoRoot = resolve(__dirname, "../../../..");

// ── esbuild resolution (mirrors preset.test.ts) ──────────────────────────────
// esbuild rides in transitively via vite/vitest. Resolve it via vite so the
// guard runs without adding a dep.
interface EsbuildBuildError extends Error {
  errors?: Array<{ text?: string }>;
}
interface EsbuildLike {
  build(opts: Record<string, unknown>): Promise<{
    errors: unknown[];
    outputFiles: Array<{ text: string }>;
  }>;
}

function loadEsbuild(): EsbuildLike {
  const vitePkg = require.resolve("vite/package.json", {
    paths: [process.cwd(), __dirname, repoRoot],
  });
  const viteRequire = createRequire(vitePkg);
  return viteRequire("esbuild") as EsbuildLike;
}

// Match `node:*` only as a real module specifier in BUNDLED CODE.
const NODE_CODE_RE = /(?:\bfrom\s*|\bimport\s*|\brequire\s*\(\s*)["'](node:[^"']+)["']/g;
function nodeSpecifiersInCode(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(NODE_CODE_RE)) if (m[1]) found.add(m[1]);
  return [...found];
}
// Match any quoted `node:*` in an esbuild DIAGNOSTIC message.
const NODE_DIAGNOSTIC_RE = /["'](node:[^"']+)["']/g;
function nodeSpecifiersInDiagnostics(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(NODE_DIAGNOSTIC_RE)) if (m[1]) found.add(m[1]);
  return [...found];
}

// ───────────────────────────────────────────────────────────────────────────
// NODE-FREE EVAL-GRAPH GUARD for the S1a foundation primitives (#2344).
//
// These modules are imported BOTH from client islands (use-modal-dialog,
// smart-break, render-markdown, island-types) and from the host's config /
// factory wiring (factory-context, url-helpers, slug). zfb evaluates config
// modules through esbuild with `--platform=neutral` (loader.rs:277) and islands
// must bundle for the browser — a transitive `node:*` import would break either
// path. This guard bundles each module exactly as zfb would (no `external`, so
// every bare specifier is resolved) and asserts no `node:*` builtin is
// reachable. Mirrors the preset eval-graph guard (preset.test.ts).
//
// NOTE: this guard deliberately covers only the node-free FOUNDATION primitives.
// `slug` is included even though `md-utils` (which is node-bound) imports IT —
// the dependency points the safe direction (node-free slug ← node-bound
// md-utils), so slug itself stays clean.
// ───────────────────────────────────────────────────────────────────────────

const NODE_FREE_MODULES = [
  "slug/index.ts",
  "render-markdown/index.ts",
  "smart-break/index.tsx",
  "use-modal-dialog/index.ts",
  "island-types/index.ts",
  "url-helpers/index.ts",
  "factory-context/index.ts",
] as const;

describe("S1a foundation primitives are node-builtin-free (--platform=neutral)", () => {
  for (const rel of NODE_FREE_MODULES) {
    it(`bundles ${rel} with no reachable node:* builtin`, async () => {
      const esbuild = loadEsbuild();
      const entry = resolve(srcRoot, rel);

      let result: Awaited<ReturnType<EsbuildLike["build"]>>;
      try {
        result = await esbuild.build({
          entryPoints: [entry],
          bundle: true,
          write: false,
          platform: "neutral",
          format: "esm",
          logLevel: "silent",
          // Preact is a peer; treat it as external so resolution doesn't pull a
          // preact node graph into the check (it has none, but keep the surface
          // focused on the module's OWN imports).
          external: ["preact", "preact/*"],
        });
      } catch (err) {
        const buildErr = err as EsbuildBuildError;
        const diagnostics = (buildErr.errors ?? []).map((e) => e.text ?? "").join("\n");
        const leaked = nodeSpecifiersInDiagnostics(diagnostics);
        if (leaked.length > 0) {
          throw new Error(
            `${rel} eval graph leaked node:* builtins (unresolvable under platform=neutral): ${leaked.join(", ")}`,
          );
        }
        throw err;
      }

      expect(result.errors).toEqual([]);
      expect(result.outputFiles.length).toBeGreaterThan(0);
      const bundled = result.outputFiles.map((f) => f.text).join("\n");
      const offenders = nodeSpecifiersInCode(bundled);
      expect(offenders, `${rel} leaked node:* builtins: ${offenders.join(", ")}`).toEqual([]);
    });
  }

  // Self-test: prove the detector is LIVE, not dead code (mirrors preset.test.ts).
  it("DETECTS a node:* import (guard is not dead code)", async () => {
    const esbuild = loadEsbuild();
    const probe = {
      stdin: {
        contents: `import { readFileSync } from "node:fs"; export const x = typeof readFileSync;`,
        resolveDir: __dirname,
        loader: "ts",
      },
      bundle: true,
      write: false,
      platform: "neutral",
      format: "esm",
      logLevel: "silent",
    } as Record<string, unknown>;

    let leaked: string[];
    try {
      const r = await esbuild.build(probe);
      leaked = nodeSpecifiersInCode(r.outputFiles.map((f) => f.text).join("\n"));
    } catch (err) {
      const buildErr = err as EsbuildBuildError;
      leaked = nodeSpecifiersInDiagnostics((buildErr.errors ?? []).map((e) => e.text ?? "").join("\n"));
    }
    expect(leaked).toContain("node:fs");
  });
});
