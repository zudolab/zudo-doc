import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildAssetSnapshot } from "../build.js";

const tempDirs: string[] = [];
afterEach(() => {
  delete process.env.SKIP_DOC_HISTORY;
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const highlightCode = async (source: string) => ({
  html: `<pre class="hi-root"><code><span class="line">${source}</span></code></pre>`,
  diagnostics: [],
});

describe("buildAssetSnapshot", () => {
  it("keeps the browser manifest bounded and route-private fields in records", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "zudo-doc-assets-build-"));
    tempDirs.push(projectRoot);
    const assetRoot = join(projectRoot, "public", "assets");
    mkdirSync(assetRoot, { recursive: true });
    for (let index = 0; index < 500; index += 1) {
      writeFileSync(join(assetRoot, `file-${index}.txt`), `value ${index}\n`);
    }
    process.env.SKIP_DOC_HISTORY = "1";
    const warnings: string[] = [];
    const snapshot = await buildAssetSnapshot({
      projectRoot,
      dir: "assets",
      routePrefix: "files",
      exclude: [],
      contentRoots: [],
      base: "/",
      trailingSlash: true,
      logger: { warn: (message) => warnings.push(message) },
      highlightCode,
    });

    expect(snapshot.manifest.entries).toHaveLength(500);
    expect(Buffer.byteLength(JSON.stringify(snapshot.manifest))).toBeLessThan(256 * 1024);
    expect(warnings).toEqual([]);
    expect(snapshot.manifest.entries[0]).not.toHaveProperty("html");
    expect(snapshot.manifest.entries[0]).not.toHaveProperty("linkedFrom");
    expect(snapshot.records["file-0.txt"]).toMatchObject({
      linkedFrom: [],
      previewable: true,
      truncated: false,
    });
    expect(snapshot.records["file-0.txt"]?.html).toContain('id="L1"');
    expect(snapshot.watchFiles.every((path) => path.startsWith(assetRoot))).toBe(true);
  });
});
