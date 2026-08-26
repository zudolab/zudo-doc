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
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

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

/** Every `from "..."` specifier in a declaration file. */
export function declarationSpecifiers(source) {
  return [...source.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map((match) => match[1]);
}

/** Resolve a relative `.js`/extensionless specifier to its emitted `.d.ts`. */
export function resolveDeclaration(fromFile, specifier) {
  const base = resolve(dirname(fromFile), specifier);
  for (const candidate of [
    base.replace(/\.js$/, ".d.ts"),
    `${base}.d.ts`,
    resolve(base, "index.d.ts"),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Walk the transitive emitted declaration graph rooted at `entry` and report
 * forbidden package/specifier classes using the same rules as the JS guard.
 *
 * @param {string} entry - absolute path to an emitted `.d.ts` file.
 * @returns {{ violations: Array<{ specifier: string, label: string, importer: string }>, files: string[] }}
 */
export function analyzeDeclarationGraph(entry) {
  const seen = new Set();
  const violations = [];
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);

    for (const specifier of declarationSpecifiers(readFileSync(file, "utf8"))) {
      const label = forbiddenLabel(specifier);
      if (label) {
        violations.push({ specifier, label, importer: file });
        continue;
      }
      if (!specifier.startsWith(".")) continue;
      const next = resolveDeclaration(file, specifier);
      if (next) queue.push(next);
    }
  }

  return { violations, files: [...seen].sort() };
}

/**
 * Resolve esbuild without adding it as a direct dependency — it rides in
 * transitively via tsup (build/prepack) and vite/vitest (tests).
 *
 * @param {string[]} fromPaths - candidate resolution roots.
 */
export async function loadEsbuild(fromPaths) {
  const require = createRequire(import.meta.url);
  // Each host package is resolved first, then esbuild is resolved FROM it —
  // pnpm's store keeps esbuild out of this package's own node_modules.
  for (const host of ["tsup", "vite", "vitest"]) {
    try {
      const hostPkg = require.resolve(`${host}/package.json`, { paths: fromPaths });
      return await import(createRequire(hostPkg).resolve("esbuild"));
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
