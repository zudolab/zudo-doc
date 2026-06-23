import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { zudoDocPreset, type PresetSettings, type DirectiveVocabulary } from "../preset.js";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
const presetSrc = resolve(__dirname, "../preset.ts");
const repoRoot = resolve(__dirname, "../../../..");

// ── esbuild resolution ───────────────────────────────────────────────────
// esbuild is not a direct dependency of this package — it rides in as a
// transitive of vite/vitest. Resolve it via vite so the guard runs without
// adding a dep. `require.resolve('vite/package.json')` is searched from this
// package and the repo root (pnpm hoists vite to either).
// esbuild has no type-declaration entry resolvable from this package (it is
// not a declared dep), so type the surface we use rather than importing
// `typeof import("esbuild")`.
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

// ───────────────────────────────────────────────────────────────────────────
// NODE-FREE EVAL-GRAPH GUARD (mandatory, per #2325).
//
// zfb evaluates the config module through esbuild with `--platform=neutral`
// (mirrors zfb's `loader.rs:277`). A transitive `node:*` import would fail
// that load. The preset is the central node in the config eval graph, so this
// test bundles `src/preset.ts` exactly as zfb would and asserts zero `node:*`
// imports survive in the output. This is the guard against the eval-graph
// footgun — NOT discipline.
// ───────────────────────────────────────────────────────────────────────────
describe("preset eval-graph is node-builtin-free (--platform=neutral)", () => {
  it("bundles under platform=neutral and emits no node:* imports", async () => {
    const esbuild = loadEsbuild();

    const result = await esbuild.build({
      entryPoints: [presetSrc],
      bundle: true,
      write: false,
      platform: "neutral",
      format: "esm",
      logLevel: "silent",
      // Match zfb's loader: bare specifiers are resolved & bundled (no
      // `external`), so any node:* that a dependency drags in would surface
      // in the output. esbuild leaves unresolved `node:*` builtins as
      // `import "node:..."` literals under platform=neutral rather than
      // shimming them, which is exactly what we scan for.
    });

    expect(result.errors).toEqual([]);
    expect(result.outputFiles.length).toBeGreaterThan(0);

    const bundled = result.outputFiles.map((f: { text: string }) => f.text).join("\n");

    // Match `node:*` only as a real module specifier — in an import/export
    // `from "node:..."`, a bare `import "node:..."`, or a `require("node:...")`
    // call — so a `node:` substring inside an unrelated string literal can't
    // trip a false positive.
    const specifierRe =
      /(?:\bfrom\s*|\bimport\s*|\brequire\s*\(\s*)["'](node:[^"']+)["']/g;
    const offenders = new Set<string>();
    for (const m of bundled.matchAll(specifierRe)) {
      if (m[1]) offenders.add(m[1]);
    }

    expect(
      [...offenders],
      `preset eval graph leaked node:* builtins: ${[...offenders].join(", ")}`,
    ).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Behavioral parity — the returned fragment reproduces the hand-written
// `zfb.config.ts` pipeline (collections loop, plugins, markdown.features,
// codeHighlight, resolveMarkdownLinks, stripMdExt, trailingSlash).
// ───────────────────────────────────────────────────────────────────────────

// A fixture mirroring the showcase `settings` shape (the subset the preset
// reads) — default English + a `ja` locale + one English-only version.
const fixtureSettings: PresetSettings = {
  docsDir: "src/content/docs",
  locales: { ja: { dir: "src/content/docs-ja" } },
  versions: [{ slug: "1.0", docsDir: "src/content/docs-v1" }],
  base: "/",
  siteName: "zudo-doc",
  siteDescription: "Documentation base framework.",
  siteUrl: "https://zudo-doc.takazudomodular.com",
  trailingSlash: true,
  mermaid: true,
  onBrokenMarkdownLinks: "warn",
  headingIdStrategy: "hierarchical",
  llmsTxt: true,
  docHistory: true,
  claudeResources: { claudeDir: ".claude" },
};

const fixtureDirectives: DirectiveVocabulary = {
  note: "Note",
  tip: "Tip",
  info: "Info",
  warning: "Warning",
  danger: "Danger",
  caution: "Caution",
  details: "Details",
};

function buildFixtureSchema() {
  return z.object({ title: z.string(), tags: z.array(z.string()).optional() }).passthrough();
}

function preset() {
  return zudoDocPreset({
    settings: fixtureSettings,
    buildDocsSchema: buildFixtureSchema,
    directiveVocabulary: fixtureDirectives,
  });
}

describe("zudoDocPreset collections", () => {
  it("derives default + per-locale + per-version (+ version-locale) collections", () => {
    const { collections } = preset();
    expect(collections.map((c) => `${c.name}:${c.path}`)).toEqual([
      "docs:src/content/docs",
      "docs-ja:src/content/docs-ja",
      "docs-v-1.0:src/content/docs-v1",
    ]);
  });

  it("appends per-version-per-locale collections when a version has locales", () => {
    const r = zudoDocPreset({
      settings: {
        ...fixtureSettings,
        versions: [
          { slug: "2.0", docsDir: "src/content/docs-v2", locales: { ja: { dir: "src/content/docs-v2-ja" } } },
        ],
      },
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
    });
    expect(r.collections.map((c) => c.name)).toEqual(["docs", "docs-ja", "docs-v-2.0", "docs-v-2.0-ja"]);
  });

  it("reuses the same JSON-Schema object across every collection", () => {
    const { collections } = preset();
    const first = collections[0]?.schema;
    expect(first).toBeDefined();
    for (const c of collections) expect(c.schema).toBe(first);
    // And it is a real JSON Schema produced from the zod builder.
    expect(first).toMatchObject({ type: "object" });
  });

  it("emits only the default collection when no locales/versions are configured", () => {
    const r = zudoDocPreset({
      settings: { ...fixtureSettings, locales: {}, versions: false },
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
    });
    expect(r.collections.map((c) => c.name)).toEqual(["docs"]);
  });
});

describe("zudoDocPreset plugins (bare-specifier descriptors)", () => {
  it("emits the package plugin specifiers + project-relative copy-public, in order", () => {
    const { plugins } = preset();
    expect(plugins.map((p) => p.name)).toEqual([
      "@takazudo/zudo-doc/plugins/claude-resources",
      "@takazudo/zudo-doc/plugins/doc-history",
      "@takazudo/zudo-doc/plugins/search-index",
      "@takazudo/zudo-doc/plugins/llms-txt",
      "./plugins/copy-public-plugin.mjs",
    ]);
  });

  it("threads the right options into each plugin", () => {
    const byName = Object.fromEntries(preset().plugins.map((p) => [p.name, p.options]));
    expect(byName["@takazudo/zudo-doc/plugins/claude-resources"]).toEqual({
      claudeDir: ".claude",
      projectRoot: undefined,
      docsDir: "src/content/docs",
    });
    expect(byName["@takazudo/zudo-doc/plugins/doc-history"]).toEqual({
      docsDir: "src/content/docs",
      locales: { ja: { dir: "src/content/docs-ja" } },
      base: "/",
    });
    expect(byName["@takazudo/zudo-doc/plugins/search-index"]).toEqual({
      docsDir: "src/content/docs",
      locales: { ja: { dir: "src/content/docs-ja" } },
      base: "/",
    });
    expect(byName["@takazudo/zudo-doc/plugins/llms-txt"]).toEqual({
      siteName: "zudo-doc",
      siteDescription: "Documentation base framework.",
      base: "/",
      siteUrl: "https://zudo-doc.takazudomodular.com",
      defaultLocaleDir: "src/content/docs",
      locales: [{ code: "ja", dir: "src/content/docs-ja" }],
    });
    expect(byName["./plugins/copy-public-plugin.mjs"]).toEqual({ publicDir: "public" });
  });

  it("omits claude-resources / doc-history / llms-txt when their settings are falsy", () => {
    const r = zudoDocPreset({
      settings: { ...fixtureSettings, claudeResources: false, docHistory: false, llmsTxt: false },
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
    });
    expect(r.plugins.map((p) => p.name)).toEqual([
      "@takazudo/zudo-doc/plugins/search-index",
      "./plugins/copy-public-plugin.mjs",
    ]);
  });
});

describe("zudoDocPreset markdown.features", () => {
  it("reproduces the showcase feature block", () => {
    const { markdown } = preset();
    expect(markdown.features).toEqual({
      directives: {
        note: "Note",
        tip: "Tip",
        info: "Info",
        warning: "Warning",
        danger: "Danger",
        caution: "Caution",
        details: "Details",
      },
      mermaid: true,
      headingMarkerToc: true,
      githubAlerts: true,
      readingTime: true,
      githubAutolinks: { repo: "zudolab/zudo-doc" },
      codeEnrichment: {},
      codeTabs: true,
      ruby: true,
      tocExport: {},
      imageDimensions: {},
      linkValidation: { failOnBroken: false },
      headingIds: { strategy: "hierarchical" },
    });
  });

  it("copies (does not alias) the passed-in directive vocabulary", () => {
    const directives: DirectiveVocabulary = { note: "Note" };
    const r = zudoDocPreset({
      settings: fixtureSettings,
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: directives,
    });
    expect(r.markdown.features.directives).toEqual({ note: "Note" });
    expect(r.markdown.features.directives).not.toBe(directives);
  });

  it("threads settings.mermaid and settings.headingIdStrategy", () => {
    const r = zudoDocPreset({
      settings: { ...fixtureSettings, mermaid: false, headingIdStrategy: "flat" },
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
    });
    expect(r.markdown.features.mermaid).toBe(false);
    expect(r.markdown.features.headingIds).toEqual({ strategy: "flat" });
  });
});

describe("zudoDocPreset top-level pipeline fields", () => {
  it("emits dual-theme codeHighlight, stripMdExt, and trailingSlash", () => {
    const r = preset();
    expect(r.codeHighlight).toEqual({
      themeLight: "base16-ocean.light",
      themeDark: "base16-ocean.dark",
    });
    expect(r.stripMdExt).toBe(true);
    expect(r.trailingSlash).toBe(true);
  });

  it("mirrors settings.trailingSlash", () => {
    const r = zudoDocPreset({
      settings: { ...fixtureSettings, trailingSlash: false },
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
    });
    expect(r.trailingSlash).toBe(false);
  });

  it("builds resolveMarkdownLinks dirs for docs + locales + versions", () => {
    const { resolveMarkdownLinks } = preset();
    expect(resolveMarkdownLinks.enabled).toBe(true);
    expect(resolveMarkdownLinks.onBrokenLinks).toBe("warn");
    expect(resolveMarkdownLinks.dirs).toEqual([
      { dir: "src/content/docs", routePrefix: "/docs/" },
      { dir: "src/content/docs-ja", routePrefix: "/ja/docs/" },
      { dir: "src/content/docs-v1", routePrefix: "/v/1.0/docs/" },
    ]);
  });

  it("threads settings.onBrokenMarkdownLinks into resolveMarkdownLinks", () => {
    const r = zudoDocPreset({
      settings: { ...fixtureSettings, onBrokenMarkdownLinks: "error" },
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
    });
    expect(r.resolveMarkdownLinks.onBrokenLinks).toBe("error");
  });
});
