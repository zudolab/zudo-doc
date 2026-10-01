import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { chunkAgentText } from "../chunk.js";
import { emitAgentCorpus, projectAgentCorpus } from "../index.js";
import { normalizeAgentMarkdown } from "../normalize.js";
import plugin from "../../../agent-export.js";

describe("agent export", () => {
  it("normalizes outside fences and preserves code, links and dynamic markers", () => {
    const result = normalizeAgentMarkdown('import Foo from "foo"\n```ts\nimport Foo from "foo"\n<Foo />\n```\n![alt](img.png)\n<Admonition>Keep this body</Admonition>\n<Foo />', "https://example.test/docs/page");
    expect(result.text).toContain('```ts\nimport Foo from "foo"\n<Foo />\n```');
    expect(result.text).toContain("![alt](https://example.test/docs/img.png)");
    expect(result.text).toContain("Keep this body");
    expect(result.text).toContain("[Dynamic content unavailable in text export]");
    expect(result.unsupportedDynamicContent).toBe(true);
  });

  it("chunks losslessly with Unicode-safe boundaries", () => {
    const text = "# 日本語\n\n" + "🚀api".repeat(4_000);
    const parts = chunkAgentText(text, "Test", "https://example.test/docs/");
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join("")).toBe(text);
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(8_000);
      expect(part).not.toMatch(/^[\uDC00-\uDFFF]/);
      expect(part).not.toMatch(/[\uD800-\uDBFF]$/);
    }
  });

  it("emits deterministic locale-aware artifacts and removes stale documents", () => {
    const root = mkdtempSync(join(tmpdir(), "agent-export-"));
    const en = join(root, "en"); const ja = join(root, "ja"); const outDir = join(root, "dist");
    mkdirSync(en); mkdirSync(ja);
    writeFileSync(join(en, "index.mdx"), '---\ntitle: Home\n---\n# Hello\n');
    writeFileSync(join(en, "hidden.mdx"), '---\ntitle: Secret\ndraft: true\n---\nSECRET');
    writeFileSync(join(ja, "page.mdx"), '---\ntitle: 日本語\nslug: custom\n---\n# 日本語 API');
    const options = { outDir, base: "/manual/", siteUrl: "https://example.test", siteName: "Docs", defaultLocale: "en", defaultLocaleDir: en, locales: [{ code: "ja", dir: ja }] };
    const first = projectAgentCorpus(options);
    expect(projectAgentCorpus(options)).toEqual(first);
    expect(first.manifest.documents).toHaveLength(2);
    expect(first.manifest.documents.find((doc) => doc.locale === "ja")?.url).toBe("https://example.test/manual/ja/docs/custom");
    expect(JSON.stringify(first)).not.toContain("SECRET");
    emitAgentCorpus(options);
    const path = join(outDir, "manual/agent/v1/manifest.json");
    expect(readFileSync(path, "utf8")).toBe(JSON.stringify(first.manifest));
    const previous = first.manifest.documents.find((doc) => doc.locale === "ja")!;
    const staleItem = join(outDir, "manual/agent/v1/items", `${previous.itemIds[0]}.json`);
    expect(existsSync(staleItem)).toBe(true);
    writeFileSync(join(ja, "page.mdx"), '---\ntitle: 日本語\nsearch_exclude: true\n---\n# 日本語 API');
    emitAgentCorpus(options);
    const updated = JSON.parse(readFileSync(path, "utf8"));
    expect(updated.documents).toHaveLength(1);
    expect(existsSync(staleItem)).toBe(false);
  });

  it("serves live base-prefixed dev artifacts after edits", async () => {
    const root = mkdtempSync(join(tmpdir(), "agent-export-dev-"));
    const page = join(root, "index.mdx");
    writeFileSync(page, "---\ntitle: Home\n---\nFirst version");
    let route = "";
    let handler: (req: { method: string; url: string }) => Promise<{ status: number; body: string } | undefined> = async () => undefined;
    plugin.devMiddleware!({
      options: { base: "/manual/", siteName: "Docs", defaultLocale: "en", defaultLocaleDir: root },
      register(path: string, callback: typeof handler) { route = path; handler = callback; },
    } as never);
    expect(route).toBe("/manual/agent/v1");
    const request = { method: "GET", url: "/manual/agent/v1/search-index.json" };
    expect((await handler(request))?.body).toContain("First version");
    writeFileSync(page, "---\ntitle: Home\n---\nSecond version");
    expect((await handler(request))?.body).toContain("Second version");
    expect((await handler({ ...request, url: "/manual/agent/v1/items/p-0000000000000000-000001.json" }))?.status).toBe(404);
  });
});
