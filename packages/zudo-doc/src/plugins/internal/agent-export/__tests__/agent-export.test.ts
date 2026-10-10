import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { chunkAgentText } from "../chunk.js";
import { emitAgentCorpus, projectAgentCorpus } from "../index.js";
import { normalizeAgentMarkdown } from "../normalize.js";
import plugin from "../../../agent-export.js";

describe("agent export", () => {
  it("preserves inline code and removes multiline MDX comments from prose", () => {
    const code = '`<Widget />` and ``<span>`value`</span>`` and `[link](relative)` and `$&`';
    const result = normalizeAgentMarkdown(`${code}\n{/* private\ncomment text */}\nVisible`, "/docs/page");
    expect(result.text).toBe(`${code}\n\nVisible`);
    expect(result.unsupportedDynamicContent).toBe(false);
  });

  it("removes multiline named imports without removing import examples", () => {
    const declaration = 'import {\n  InternalComponent,\n  helper\n} from "../../private/source";';
    const result = normalizeAgentMarkdown(`${declaration}\n\nVisible\n\n\`\`\`tsx\n${declaration}\n\`\`\``, "/docs/page");
    expect(result.text).toBe(`Visible\n\n\`\`\`tsx\n${declaration}\n\`\`\``);
  });

  it("resolves fragment, query and reference destinations against the source page", () => {
    const source = '[section](#setup) [query](?view=all) [guide][ref]\n[ref]: ../guide "Guide"\n![image][img]\n[img]: <images/example.png>';
    const result = normalizeAgentMarkdown(source, "https://example.test/manual/docs/page");
    expect(result.text).toContain("[section](https://example.test/manual/docs/page#setup)");
    expect(result.text).toContain("[query](https://example.test/manual/docs/page?view=all)");
    expect(result.text).toContain('[ref]: https://example.test/manual/guide "Guide"');
    expect(result.text).toContain("[img]: <https://example.test/manual/docs/images/example.png>");
    expect(normalizeAgentMarkdown("[section](#setup)", "/manual/docs/page").text)
      .toBe("[section](/manual/docs/page#setup)");
    expect(normalizeAgentMarkdown("[guide](<other page>)", "/manual/docs/page").text)
      .toBe("[guide](</manual/docs/other%20page>)");
  });

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

  it("fails the build when one Unicode code point cannot fit the real item envelope", () => {
    const pageId = "p-0123456789abcdef";
    const baseMetadata = { locale: "ja", pageId };
    const tooLong = "x".repeat(70_000);
    const cases = [
      { title: tooLong, url: "https://example.test/docs/", metadata: baseMetadata },
      { title: "Title", url: `https://example.test/${tooLong}`, metadata: baseMetadata },
      {
        title: "Title",
        url: "https://example.test/docs/",
        metadata: { ...baseMetadata, description: tooLong },
      },
    ];

    for (const item of cases) {
      expect(() => chunkAgentText("🚀", item.title, item.url, item.metadata)).toThrow(
        "Agent item cannot fit within the MCP tool response byte limit, even with one Unicode code point.",
      );
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

  describe("emitted location vs copyPublicWithBase", () => {
    function fixture(base: string) {
      const root = mkdtempSync(join(tmpdir(), "agent-export-base-"));
      const en = join(root, "en"); const outDir = join(root, "dist");
      mkdirSync(en);
      writeFileSync(join(en, "index.mdx"), "---\ntitle: Home\n---\n# Hello\n");
      return { outDir, options: { base, siteName: "Docs", defaultLocale: "en", defaultLocaleDir: en } };
    }
    const runPostBuild = (f: ReturnType<typeof fixture>, config: Record<string, unknown>) =>
      plugin.postBuild!({ outDir: f.outDir, config, options: f.options } as never);

    it("root base emits at dist/agent/v1 for true, unset and false", async () => {
      for (const config of [{}, { copyPublicWithBase: true }, { copyPublicWithBase: false }]) {
        const f = fixture("/");
        await runPostBuild(f, config);
        expect(existsSync(join(f.outDir, "agent/v1/manifest.json"))).toBe(true);
      }
    });

    it("non-root base nests under the base when copyPublicWithBase is unset or true", async () => {
      for (const config of [{}, { copyPublicWithBase: true }]) {
        const f = fixture("/nested/docs/");
        await runPostBuild(f, config);
        expect(existsSync(join(f.outDir, "nested/docs/agent/v1/manifest.json"))).toBe(true);
        expect(existsSync(join(f.outDir, "agent"))).toBe(false);
      }
    });

    it("non-root base emits unprefixed when copyPublicWithBase is false, while advertising base URLs", async () => {
      const f = fixture("/nested/docs/");
      await runPostBuild(f, { copyPublicWithBase: false });
      const manifestPath = join(f.outDir, "agent/v1/manifest.json");
      expect(existsSync(manifestPath)).toBe(true);
      expect(existsSync(join(f.outDir, "nested"))).toBe(false);
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      expect(manifest.searchIndex.url).toBe("/nested/docs/agent/v1/search-index.json");
      expect(manifest.documents[0].markdownUrl).toMatch(/^\/nested\/docs\/agent\/v1\/pages\//);
    });
  });

  it("resolves source-file links using locale and target slug overrides", () => {
    const root = mkdtempSync(join(tmpdir(), "agent-links-"));
    writeFileSync(join(root, "source.mdx"), '---\ntitle: Source\nslug: moved/source\n---\n[Target](./target.mdx#section)\n[Reference][target]\n[target]: ./target.mdx');
    writeFileSync(join(root, "target.mdx"), '---\ntitle: Target\nslug: custom-target\n---\n# Section');
    const corpus = projectAgentCorpus({ base: "/manual", siteUrl: "https://example.test", siteName: "Docs", defaultLocale: "ja", defaultLocaleDir: root });
    const page = corpus.manifest.documents.find(doc => doc.title === "Source")!;
    expect(corpus.pages.get(page.key)).toBe('[Target](https://example.test/manual/docs/custom-target#section)\n[Reference][target]\n[target]: https://example.test/manual/docs/custom-target');
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
