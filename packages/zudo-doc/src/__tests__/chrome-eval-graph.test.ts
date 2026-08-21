import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(__dirname, "..");
const repoRoot = resolve(__dirname, "../../../..");

// ── esbuild resolution (mirrors preset.test.ts) ─────────────────────────────
// esbuild is not a direct dependency of this package — it rides in as a
// transitive of vite/vitest. Resolve it via vite so the guard runs without
// adding a dep.
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

// (success-path) Match `node:*` / `virtual:*` only as a real module specifier
// in BUNDLED CODE — in an import/export `from "..."`, a bare `import "..."`,
// or a `require("...")` call — so a matching substring inside an unrelated
// string literal or object-shorthand (`{ node: g6 }`) in the output can't
// trip a false positive. Verified against this exact bundle: esbuild's own
// tailwind engine embeds the string `"virtual:tailwindcss/index.css"` as a
// plain data value, and preact/tailwind internals use `node:` as an object
// key shorthand — neither is preceded by `from`/`import`/`require(`, so the
// strict regex below correctly ignores both.
const NODE_CODE_RE = /(?:\bfrom\s*|\bimport\s*|\brequire\s*\(\s*)["'](node:[^"']+)["']/g;
const VIRTUAL_CODE_RE = /(?:\bfrom\s*|\bimport\s*|\brequire\s*\(\s*)["'](virtual:[^"']+)["']/g;

function specifiersInCode(text: string, re: RegExp): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(re)) {
    if (m[1]) found.add(m[1]);
  }
  return [...found];
}

// (throw-path) Match any quoted `node:*` / `virtual:*` in an esbuild
// DIAGNOSTIC message (e.g. `Could not resolve "node:fs"`). These have no
// import keyword, so the code regexes above would miss them.
const NODE_DIAGNOSTIC_RE = /["'](node:[^"']+)["']/g;
const VIRTUAL_DIAGNOSTIC_RE = /["'](virtual:[^"']+)["']/g;

function specifiersInDiagnostics(text: string, re: RegExp): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(re)) {
    if (m[1]) found.add(m[1]);
  }
  return [...found];
}

// ───────────────────────────────────────────────────────────────────────────
// CHROME BROWSER-BUNDLE EVAL-GRAPH GUARD (#3401, epic #3394).
//
// `@takazudo/zudo-doc/chrome` (and its `./home-page` / `./sidebar-tree`
// siblings) must bundle for the browser with zero shims/aliases (companion
// issue #3393) — the zfb island scanner walks this exact graph to build
// client bundles, and a host with `packageOwnedRoutes: false` bundles it
// directly with no zfb build in the loop. Before wave 1 of epic #3394, that
// graph carried two structural leaks:
//   - a static `virtual:zudo-doc-design-token-panel-config` import, resolved
//     only inside a zfb build (fixed by #3396 — the DTP bootstrap now binds
//     the package-default builder directly; the virtual specifier only
//     appears in the routes-only wrapper under `src/routes/`, which this
//     graph does not reach).
//   - a static `node:fs`/`node:path` import in `sidebar-tree/category-meta.ts`
//     (fixed by #3397 — resolved at call time via
//     `process.getBuiltinModule(...)` instead of a top-level import, so the
//     literal string `"node:fs"` still appears in the bundle as a plain call
//     argument, never as an import/require specifier — the strict
//     `NODE_CODE_RE` below is what makes that distinction, mirroring
//     `preset.test.ts`).
// This guard is only possible now that both edges are gone — it locks them
// out so they can't regrow silently.
//
// MECHANISM: identical to `preset.test.ts` — esbuild-bundle with
// `--platform=neutral` (no shimming of `node:*`), scan the throw-path
// diagnostics AND (defense-in-depth) the emitted bundle for a literal
// `node:*`/`virtual:*` import/require specifier.
//
// EXTERNAL: unlike `preset.test.ts` (which bundles zod with no external at
// all — the config eval graph has no third-party runtime deps of its own),
// chrome's graph reaches real npm peer dependencies. Of those, only
// `@takazudo/zfb-md-wasm` needs to be marked `external` here: it is an
// OPTIONAL peer (`package.json#peerDependenciesMeta`) that
// `html-preview-wrapper/highlight-runtime.ts` reaches through a genuine
// `import("@takazudo/zfb-md-wasm/highlight")` (browser-time-only, per the
// project root CLAUDE.md's "zfb semantic highlighting" note) — its OWN dist
// bundle contains an internal Node/browser environment branch
// (`node:fs/promises`/`node:url`) that is not part of THIS package's import
// graph and would otherwise false-positive the guard when esbuild inlines
// the dynamic-import target. `preact`, `@takazudo/zfb`, and `@takazudo/zdtp`
// were tried and do NOT need to be external — they bundle in clean with zero
// node:*/virtual:* leaks of their own, so excluding them would only narrow
// the guard's coverage for no reason.
//
// ENTRY COVERAGE: `./home-page` and `./sidebar-tree` are covered here TOO,
// alongside `./chrome` (which imports both). Before writing this test, all
// three were probed independently: `sidebar-tree/index.ts` bundles clean
// (the #3397 fix made the whole module node-free), and `home-page/index.tsx`
// bundles clean even though its barrel re-exports `prepareHomeData` (which
// statically imports `sidebar-tree`'s `loadCategoryMeta`) — because that
// chain no longer carries a literal node:* import/require specifier either,
// same reason. So, unlike the older `foundation-eval-graph.test.ts` guard
// (whose header note anticipated this file would stay chrome-only), the
// probe showed no reason to leave home-page/sidebar-tree uncovered.
// ───────────────────────────────────────────────────────────────────────────

const ENTRIES = [
  "chrome/index.tsx",
  "home-page/index.tsx",
  "sidebar-tree/index.ts",
] as const;

const EXTERNAL = ["@takazudo/zfb-md-wasm"];

describe("chrome browser-bundle graph is node-builtin- and virtual-module-free (--platform=neutral)", () => {
  for (const rel of ENTRIES) {
    it(`bundles ${rel} with no reachable node:* builtin or virtual:* module`, async () => {
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
          external: EXTERNAL,
        });
      } catch (err) {
        // (1) Throw path. Inspect the build diagnostics for a node:*/virtual:*
        // specifier.
        const buildErr = err as EsbuildBuildError;
        const diagnostics = (buildErr.errors ?? [])
          .map((e) => e.text ?? "")
          .join("\n");
        const leakedNode = specifiersInDiagnostics(diagnostics, NODE_DIAGNOSTIC_RE);
        const leakedVirtual = specifiersInDiagnostics(diagnostics, VIRTUAL_DIAGNOSTIC_RE);
        if (leakedNode.length > 0 || leakedVirtual.length > 0) {
          throw new Error(
            `${rel} eval graph leaked unresolvable specifiers (platform=neutral): ` +
              `${[...leakedNode, ...leakedVirtual].join(", ")}`,
          );
        }
        // A build failure unrelated to node:*/virtual:* is a genuine test failure.
        throw err;
      }

      // (2) Success path. No node:*/virtual:* import/require specifier in the
      // emitted bundle.
      expect(result.errors).toEqual([]);
      expect(result.outputFiles.length).toBeGreaterThan(0);

      const bundled = result.outputFiles.map((f: { text: string }) => f.text).join("\n");
      const nodeOffenders = specifiersInCode(bundled, NODE_CODE_RE);
      const virtualOffenders = specifiersInCode(bundled, VIRTUAL_CODE_RE);

      expect(
        nodeOffenders,
        `${rel} leaked node:* builtins: ${nodeOffenders.join(", ")}`,
      ).toEqual([]);
      expect(
        virtualOffenders,
        `${rel} leaked virtual:* modules: ${virtualOffenders.join(", ")}`,
      ).toEqual([]);
    });
  }

  // Self-test: prove the detectors are LIVE, not dead code. A module that
  // imports a node builtin or a virtual: specifier MUST be flagged by the
  // same throw/scan logic the guard above uses. If this ever stops flagging,
  // the guard has silently lost its teeth (mirrors preset.test.ts's
  // equivalent self-test).
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
      leaked = specifiersInCode(r.outputFiles.map((f: { text: string }) => f.text).join("\n"), NODE_CODE_RE);
    } catch (err) {
      const buildErr = err as EsbuildBuildError;
      leaked = specifiersInDiagnostics(
        (buildErr.errors ?? []).map((e) => e.text ?? "").join("\n"),
        NODE_DIAGNOSTIC_RE,
      );
    }
    expect(leaked).toContain("node:fs");
  });

  it("DETECTS a virtual:* import (guard is not dead code)", async () => {
    const esbuild = loadEsbuild();
    const probe = {
      stdin: {
        contents: `import { x } from "virtual:zudo-doc-route-context"; export const y = x;`,
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
      leaked = specifiersInCode(r.outputFiles.map((f: { text: string }) => f.text).join("\n"), VIRTUAL_CODE_RE);
    } catch (err) {
      const buildErr = err as EsbuildBuildError;
      leaked = specifiersInDiagnostics(
        (buildErr.errors ?? []).map((e) => e.text ?? "").join("\n"),
        VIRTUAL_DIAGNOSTIC_RE,
      );
    }
    expect(leaked).toContain("virtual:zudo-doc-route-context");
  });
});
