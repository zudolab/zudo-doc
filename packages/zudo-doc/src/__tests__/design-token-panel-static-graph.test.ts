import { describe, expect, it } from "vitest";
import { build } from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("published bootstrap consumer graph", () => {
  it("eagerly loads no zdtp file at all and dynamically reaches the panel payload", async () => {
    // Exercise the actual dist export a consumer imports. Rebuild the package
    // after source changes before running this contract test.
    const result = await build({
      absWorkingDir: pkgRoot,
      stdin: {
        contents: 'export { bootstrapDesignTokenPanel } from "@takazudo/zudo-doc/design-token-panel-bootstrap";',
        resolveDir: pkgRoot,
        sourcefile: "consumer.ts",
        loader: "ts",
      },
      bundle: true,
      splitting: true,
      format: "esm",
      platform: "browser",
      outdir: "graph-check",
      write: false,
      metafile: true,
    });
    const outputs = result.metafile!.outputs;
    const entry = Object.keys(outputs).find((name) => outputs[name]!.entryPoint === "consumer.ts");
    expect(entry).toBeDefined();
    function closure(start: string, includeDynamic: boolean): Set<string> {
      const seen = new Set<string>();
      function visit(name: string): void {
        if (seen.has(name)) return;
        seen.add(name);
        for (const edge of outputs[name]!.imports) {
          if (!edge.external && (includeDynamic || edge.kind !== "dynamic-import")) visit(edge.path);
        }
      }
      visit(start);
      return seen;
    }
    const eager = closure(entry!, false);
    const all = closure(entry!, true);
    const eagerZdtp = [...new Set([...eager].flatMap((name) => Object.keys(outputs[name]!.inputs)))]
      .filter((name) => name.includes("/@takazudo/zdtp/"));
    // #4009 / #4018: ANY eager zdtp input means a consumer that honors the
    // `optional: true` peer declaration and never installed @takazudo/zdtp
    // cannot build (`Could not resolve "@takazudo/zdtp/..."`). The constants
    // this used to reach through `@takazudo/zdtp/constants` are vendored at
    // `src/design-token-panel-constants.ts`; only the rejection-handled
    // `import("@takazudo/zdtp")` inside `loadZdtp()` may reach the package,
    // and that edge is dynamic so it is excluded from the eager closure.
    expect(eagerZdtp).toEqual([]);
    const payloads = result.outputFiles.filter((file) => file.text.includes("tokenpanel-shell"));
    expect(payloads.length).toBeGreaterThan(0);
    for (const payload of payloads) {
      const key = Object.keys(outputs).find((name) => resolve(pkgRoot, name) === payload.path)!;
      expect(all.has(key)).toBe(true);
      expect(eager.has(key)).toBe(false);
    }
  });
});
