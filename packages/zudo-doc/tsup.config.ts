import { defineConfig } from "tsup";
import fs from "node:fs";

// Entry-point map is derived from package.json's `exports` field so the two
// stay in sync mechanically. For each export entry whose `default` points
// under ./dist/, we reverse-map to the matching source file under src/.
// dist key `foo/index` → tries src/foo/index.ts then src/foo/index.tsx.
//
// Done this way (rather than a hand-maintained list) because adding a new
// export then forgetting to add the matching tsup entry is the classic
// "ships as undefined" failure mode — the test would build, the scaffold
// would install, then the import would fail at runtime only.
function buildEntryMap(): Record<string, string> {
  const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
  const entries: Record<string, string> = {};
  for (const v of Object.values(pkg.exports || {})) {
    if (typeof v !== "object" || v === null) continue;
    const def = (v as { default?: string }).default;
    if (!def || !def.startsWith("./dist/")) continue;
    const key = def.replace(/^\.\/dist\//, "").replace(/\.js$/, "");
    const candidates = [`src/${key}.ts`, `src/${key}.tsx`];
    const src = candidates.find((c) => fs.existsSync(c));
    if (!src) {
      throw new Error(
        `tsup.config: could not resolve src/ for export "${def}"; tried ${candidates.join(", ")}`,
      );
    }
    entries[key] = src;
  }
  return entries;
}

export default defineConfig({
  entry: buildEntryMap(),
  format: "esm",
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: false,
  // External rules:
  //   - peer deps (preact, @takazudo/*) — consumer provides; bundling them
  //     would dedupe-conflict and bloat
  //   - node: builtins — never bundle
  //   - shiki / mermaid — both are dynamically imported at runtime for
  //     syntax highlighting and diagram rendering; bundling them inlines
  //     megabytes of language grammars / mermaid into our dist (9.5 MB
  //     observed before this rule). Consumers that use the relevant
  //     features install shiki / mermaid themselves; the dynamic import
  //     resolves at runtime in their node_modules.
  //   - gray-matter (a declared runtime dep) is INTENTIONALLY bundled —
  //     it's an internal helper, not exposed in the public API
  external: [
    /^preact($|\/)/,
    /^@takazudo\//,
    /^node:/,
    "shiki",
    "mermaid",
  ],
});
