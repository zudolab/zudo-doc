// scripts/site-schema-graph.mjs
//
// The browser-safety detector shared by the two `site-schema` guards
// (zudolab/zudo-doc#3395):
//   - `scripts/check-site-schema.mjs` (prepack) runs it over `dist/site-schema/index.js`
//   - `src/__tests__/site-schema.test.ts` runs it over `src/site-schema/index.ts`
//
// It bundles the entry with esbuild `platform: "neutral"` — the same mode zfb
// evaluates config modules in (`loader.rs:277`) and the closest stand-in for a
// browser bundler — and records every bare specifier reached along the way.
// Anything matching FORBIDDEN_SPECIFIERS is a violation.
//
// Recording at RESOLVE time (rather than grepping the emitted bundle) is what
// makes the check total: a forbidden dependency is caught whether it resolves,
// fails to resolve, or gets inlined away.

import { createRequire } from "node:module";

/** Specifier classes that must never be reachable from `./site-schema`. */
export const FORBIDDEN_SPECIFIERS = [
  { pattern: /^node:/, label: "node builtin" },
  { pattern: /^preact(\/|$)/, label: "preact" },
  { pattern: /^@takazudo\/zfb/, label: "zfb engine package" },
  { pattern: /^virtual:/, label: "zfb virtual module" },
  { pattern: /\.css$/, label: "stylesheet" },
];

/** The forbidden class a specifier belongs to, or `undefined` when it is fine. */
export function forbiddenLabel(specifier) {
  return FORBIDDEN_SPECIFIERS.find((rule) => rule.pattern.test(specifier))?.label;
}

/**
 * Resolve esbuild without adding it as a direct dependency — it rides in
 * transitively via tsup (build/prepack) and vite/vitest (tests).
 *
 * @param {string[]} fromPaths - candidate resolution roots.
 */
export async function loadEsbuild(fromPaths) {
  const require = createRequire(import.meta.url);
  for (const via of ["tsup", "vite", "vitest", "esbuild"]) {
    try {
      const specifier = via === "esbuild" ? "esbuild" : `${via}/package.json`;
      const pkgPath = require.resolve(specifier, { paths: fromPaths });
      if (via === "esbuild") return await import(pkgPath);
      return await import(createRequire(pkgPath).resolve("esbuild"));
    } catch {
      // try the next host package
    }
  }
  throw new Error("[site-schema-graph] could not resolve esbuild via tsup / vite / vitest");
}

/**
 * Bundle `entry` and report every forbidden specifier reachable from it.
 *
 * @param {object} args
 * @param {string} args.entry - absolute path to the entry module (.ts or .js).
 * @param {string[]} args.resolveFrom - roots used to locate esbuild.
 * @returns {Promise<{ violations: Array<{ specifier: string, label: string, importer: string }>, specifiers: string[] }>}
 */
export async function analyzeSiteSchemaGraph({ entry, resolveFrom }) {
  const esbuild = await loadEsbuild(resolveFrom);

  /** @type {Map<string, { specifier: string, label: string, importer: string }>} */
  const violations = new Map();
  const specifiers = new Set();

  const recorder = {
    name: "site-schema-specifier-recorder",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.kind === "entry-point") return null;
        specifiers.add(args.path);
        const label = forbiddenLabel(args.path);
        if (!label) return null;
        if (!violations.has(args.path)) {
          violations.set(args.path, { specifier: args.path, label, importer: args.importer });
        }
        // Stop here so a forbidden dependency is REPORTED rather than turned
        // into an unrelated "could not resolve" build failure.
        return { path: args.path, external: true };
      });
    },
  };

  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    platform: "neutral",
    format: "esm",
    logLevel: "silent",
    plugins: [recorder],
  });

  return { violations: [...violations.values()], specifiers: [...specifiers].sort() };
}
