// OPTIONAL-PEER REACHABILITY GUARD (zudolab/zudo-doc#3110).
//
// The failure mode this exists to catch, which has now shipped THREE times
// (#2342 `diff`, #2668 `@takazudo/zdtp`, #3110
// `@takazudo/zudo-doc-history-server`):
//
//   A module in the ALWAYS-bundled route/chrome graph imports an OPTIONAL
//   peerDependency at module scope. Because `packageOwnedRoutes` is on by
//   default, esbuild must RESOLVE that specifier on every build — even for a
//   project whose settings switch the corresponding feature off, and which
//   therefore never installed the package. pnpm does not auto-install peers and
//   an optional one produces NO install warning, so the gap is invisible until
//   a consumer's `zfb build` dies with `Could not resolve "<pkg>"`.
//
// Nothing else catches this: unit tests import from source (every workspace
// package is present), and this repo's own build installs every optional peer.
// Only a reachability analysis over the real route entrypoints sees it.
//
// MECHANISM: bundle the injected doc routes with esbuild, intercepting every
// bare specifier via an `onResolve` hook that marks it external. Nothing is read
// from disk, so the guard does not depend on what happens to be installed — it
// reports what the GRAPH references. Reached optional peers are then diffed
// against the allowlist below.
//
// ── ADDING TO THE ALLOWLIST IS A DELIBERATE CONTRACT CHANGE ──
// Allowlisting a package means every consuming project must declare it as a
// direct dependency regardless of its settings (create-zudo-doc does this in
// `generatePackageJson()`). Prefer fixing the import — move the code into this
// package, or make the import dynamic/gated — over widening the list.

import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// src/__tests__/ → packages/zudo-doc/
const pkgRoot = resolve(__dirname, "../..");
const repoRoot = resolve(pkgRoot, "../..");

// Optional peers that ARE reachable from the always-bundled graph and are an
// accepted, permanent part of the consumer contract. Each needs a reason.
const ALLOWED_UNCONDITIONAL_OPTIONAL_PEERS = new Set([
  // #2342 — doc-history's diff viewer; the chrome graph always bundles the
  // doc-history path, so `diff` resolves regardless of the docHistory setting.
  "diff",
  // #2668 — `chrome/derive`'s `deriveBodyEndIslands` statically imports the real
  // `DesignTokenPanelBootstrap` (so the island auto-mounts with zero host
  // wiring); only RENDERING is gated on `designTokenPanel`, not the import.
  "@takazudo/zdtp",
  // Reached via `mdx-components → math-block`. Math rendering is settings-gated
  // but the import is static.
  "katex",
  // Reached via `html-preview-wrapper → highlight-runtime` for browser-time
  // HTML/CSS/JS highlighting.
  "@takazudo/zfb-md-wasm",
]);

// The default package-owned doc routes — the actual entrypoints zfb injects when
// `packageOwnedRoutes` is on. Using the real routes (rather than a single leaf
// module) means a future regression anywhere in the transitive chrome graph
// (route → _chrome → createChrome → doc-page-renderer → …) is caught too.
const ROUTE_ENTRYPOINTS = [
  "src/routes/docs-slug.tsx",
  "src/routes/locale-docs-slug.tsx",
];

interface EsbuildLike {
  build(opts: Record<string, unknown>): Promise<{ errors: unknown[] }>;
}

// esbuild is not a direct dependency of this package — it rides in as a
// transitive of vite/vitest. Resolve it via vite so the guard adds no dep
// (same approach as `preset.test.ts`).
function loadEsbuild(): EsbuildLike {
  const require = createRequire(import.meta.url);
  const vitePkg = require.resolve("vite/package.json", {
    paths: [process.cwd(), __dirname, repoRoot],
  });
  return createRequire(vitePkg)("esbuild") as EsbuildLike;
}

function optionalPeersOf(): string[] {
  const require = createRequire(import.meta.url);
  const pkg = require(resolve(pkgRoot, "package.json")) as {
    peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  };
  return Object.entries(pkg.peerDependenciesMeta ?? {})
    .filter(([, meta]) => meta.optional === true)
    .map(([name]) => name);
}

/** `@scope/pkg/sub` → `@scope/pkg`; `pkg/sub` → `pkg`. */
function packageNameOf(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? specifier);
}

/** Bare (non-relative, non-absolute) specifiers reachable from the entrypoints. */
async function collectBareSpecifiers(entryPoints: string[]): Promise<Set<string>> {
  const esbuild = loadEsbuild();
  const seen = new Set<string>();

  await esbuild.build({
    entryPoints,
    bundle: true,
    write: false,
    // Required by esbuild whenever there is more than one entry point. Nothing
    // is written (`write: false`), so this path is never touched.
    outdir: resolve(pkgRoot, ".optional-peer-guard-nonexistent"),
    format: "esm",
    platform: "neutral",
    jsx: "automatic",
    jsxImportSource: "preact",
    logLevel: "silent",
    plugins: [
      {
        name: "collect-bare-specifiers",
        setup(build: {
          onResolve(
            opts: { filter: RegExp },
            cb: (args: { path: string; kind: string }) => unknown,
          ): void;
        }) {
          build.onResolve({ filter: /.*/ }, (args) => {
            if (args.kind === "entry-point") return null;
            if (args.path.startsWith(".") || args.path.startsWith("/")) return null;
            seen.add(args.path);
            // External: never touch disk, so the result reflects the graph
            // rather than whatever happens to be installed.
            return { path: args.path, external: true };
          });
        },
      },
    ],
  });

  return seen;
}

describe("always-bundled route graph does not reach un-allowlisted optional peers", () => {
  it("reaches only the accepted unconditional optional peers", async () => {
    const specifiers = await collectBareSpecifiers(
      ROUTE_ENTRYPOINTS.map((p) => resolve(pkgRoot, p)),
    );

    const optional = new Set(optionalPeersOf());
    const reachedOptional = [
      ...new Set([...specifiers].map(packageNameOf)),
    ]
      .filter((name) => optional.has(name))
      .sort();

    const unexpected = reachedOptional.filter(
      (name) => !ALLOWED_UNCONDITIONAL_OPTIONAL_PEERS.has(name),
    );

    expect(
      unexpected,
      `Optional peer(s) ${unexpected.join(", ")} are imported from the always-bundled ` +
        `route graph. A project that leaves the corresponding feature OFF never installs ` +
        `them, so its 'zfb build' fails with "Could not resolve". Fix the import (move the ` +
        `code into this package, or gate/dynamic-import it) rather than widening ` +
        `ALLOWED_UNCONDITIONAL_OPTIONAL_PEERS.`,
    ).toEqual([]);
  });

  it("does not reach @takazudo/zudo-doc-history-server (#3110 regression guard)", async () => {
    const specifiers = await collectBareSpecifiers(
      ROUTE_ENTRYPOINTS.map((p) => resolve(pkgRoot, p)),
    );

    const offenders = [...specifiers].filter(
      (s) => packageNameOf(s) === "@takazudo/zudo-doc-history-server",
    );

    expect(
      offenders,
      `#3110: doc-history-area must import compileExclude from ` +
        `src/doc-history-exclude/ (this package), NOT from the optional peer ` +
        `@takazudo/zudo-doc-history-server. Found: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("self-test: the collector actually walks the graph", async () => {
    // Proves the two assertions above are not passing vacuously (e.g. an
    // esbuild/plugin change silently yielding an empty set).
    const specifiers = await collectBareSpecifiers(
      ROUTE_ENTRYPOINTS.map((p) => resolve(pkgRoot, p)),
    );
    const names = new Set([...specifiers].map(packageNameOf));

    expect(names.has("preact")).toBe(true);
    expect(names.has("@takazudo/zfb")).toBe(true);
    // At least one known-allowlisted optional peer must still be seen — if this
    // stops holding, the collector is under-reporting rather than the graph
    // having genuinely cleaned up.
    expect(names.has("diff")).toBe(true);
  });
});
