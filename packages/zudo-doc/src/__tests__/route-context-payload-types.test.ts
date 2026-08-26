// Declaration-graph contract for the browser-safe route-context payload leaf.

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "../..");
const DIST_DTS = resolve(PKG_ROOT, "dist/route-context-payload/types.d.ts");
const FACTORY_CONTEXT_DTS = resolve(PKG_ROOT, "dist/factory-context/index.d.ts");

interface DeclarationGraph {
  analyzeDeclarationGraph(entry: string): {
    violations: Array<{ specifier: string; label: string; importer: string }>;
    files: string[];
  };
}

async function loadGraphHelper(): Promise<DeclarationGraph> {
  const url = pathToFileURL(resolve(PKG_ROOT, "scripts/site-schema-graph.mjs")).href;
  return (await import(/* @vite-ignore */ url)) as DeclarationGraph;
}

describe("route-context payload type leaf", () => {
  it("has a transitively browser-clean emitted declaration graph", async () => {
    expect(
      existsSync(DIST_DTS),
      `${DIST_DTS} missing — run \`pnpm --filter @takazudo/zudo-doc build\``,
    ).toBe(true);

    const { analyzeDeclarationGraph } = await loadGraphHelper();
    const { violations, files } = analyzeDeclarationGraph(DIST_DTS);

    expect(
      violations,
      violations.map((v) => `${v.specifier} (${v.label}) declared in ${v.importer}`).join("\n"),
    ).toEqual([]);
    // RouteContextPayload's default Settings generic makes this a real
    // transitive walk rather than a single-file inspection.
    expect(files.length).toBeGreaterThan(1);
  });

  it("keeps RouteContextPayload available from factory-context", () => {
    expect(
      existsSync(FACTORY_CONTEXT_DTS),
      `${FACTORY_CONTEXT_DTS} missing — run \`pnpm --filter @takazudo/zudo-doc build\``,
    ).toBe(true);
    expect(readFileSync(FACTORY_CONTEXT_DTS, "utf8")).toContain(
      'export type { RouteContextPayload } from "../route-context-payload/types.js";',
    );
  });
});
