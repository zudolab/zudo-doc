import { describe, it, expect, vi, afterEach } from "vitest";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { zudoDocPreset, type PresetSettings, type DirectiveVocabulary } from "../preset.js";
import { SEMANTIC_RAMP_DEFAULTS, type ColorScheme } from "../color-scheme-utils.js";
import { z } from "zod";

// Minimal valid ramp-native ColorScheme fixture. These preset tests only assert
// that a `colorSchemes` value is present (host-binding warning logic) — the
// concrete color values are irrelevant, so the ramps are all-black stubs.
const fixtureColorScheme: ColorScheme = {
  ramps: {
    base: Array.from({ length: 5 }, () => "#000"),
    accent: Array.from({ length: 3 }, () => "#000"),
    state: { danger: "#000", success: "#000", warning: "#000", info: "#000" },
  },
  map: {
    bg: { base: 4 },
    fg: { base: 0 },
    selectionBg: { base: 2 },
    selectionFg: { base: 0 },
    semantic: { ...SEMANTIC_RAMP_DEFAULTS },
    syntax: {},
  },
};

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
interface EsbuildBuildError extends Error {
  errors?: Array<{ text?: string }>;
}
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

// (success-path) Match `node:*` only as a real module specifier in BUNDLED
// CODE — in an import/export `from "node:..."`, a bare `import "node:..."`, or
// a `require("node:...")` call — so a `node:` substring inside an unrelated
// string literal in the output can't trip a false positive.
const NODE_CODE_RE = /(?:\bfrom\s*|\bimport\s*|\brequire\s*\(\s*)["'](node:[^"']+)["']/g;

function nodeSpecifiersInCode(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(NODE_CODE_RE)) {
    if (m[1]) found.add(m[1]);
  }
  return [...found];
}

// (throw-path) Match any quoted `node:*` in an esbuild DIAGNOSTIC message
// (e.g. `Could not resolve "node:fs"`). These have no import keyword, so the
// code regex above would miss them — a distinct scanner is required.
const NODE_DIAGNOSTIC_RE = /["'](node:[^"']+)["']/g;

function nodeSpecifiersInDiagnostics(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(NODE_DIAGNOSTIC_RE)) {
    if (m[1]) found.add(m[1]);
  }
  return [...found];
}

// ───────────────────────────────────────────────────────────────────────────
// NODE-FREE EVAL-GRAPH GUARD (mandatory, per #2325).
//
// zfb evaluates the config module through esbuild with `--platform=neutral`
// (mirrors zfb's `loader.rs:277`). A transitive `node:*` import would fail
// that load. The preset is the central node in the config eval graph, so this
// test bundles `src/preset.ts` exactly as zfb would — no `external`, so every
// bare specifier (incl. zod) is resolved & bundled — and asserts no `node:*`
// builtin is reachable.
//
// MECHANISM (verified against esbuild 0.27.x): under `--platform=neutral`
// esbuild does NOT shim `node:*` — it tries to RESOLVE it, and an unresolvable
// `node:fs`/`node:path`/… makes `build()` **reject** with a "Could not resolve"
// diagnostic on the thrown error's `.errors`. It does NOT succeed-with-a-literal
// `import "node:..."`. So the guard checks BOTH paths:
//   (1) throw path — a build failure whose diagnostics reference a `node:*`
//       specifier is a leak (fail with the offending names); any other build
//       error is a genuine test failure (re-thrown).
//   (2) success path — defense-in-depth: scan the emitted bundle for a literal
//       `node:*` specifier in case a future esbuild/config passes one through.
// This is the guard against the eval-graph footgun — NOT discipline.
//
// The package-default data modules that will be threaded into this eval graph
// via `zudoDoc()` (#2657) — `i18n-defaults`, `color-schemes-defaults`,
// `docs-schema`, `z-index-defaults`, `frontmatter-preview-defaults`,
// `directive-vocabulary-defaults` (epic #2651, S4 #2654) — are covered by the
// same mechanism in `foundation-eval-graph.test.ts`'s `NODE_FREE_MODULES`
// list, which already generalizes this single-entry-point guard to a list of
// modules. Extended there instead of duplicated here.
// ───────────────────────────────────────────────────────────────────────────
describe("preset eval-graph is node-builtin-free (--platform=neutral)", () => {
  it("bundles under platform=neutral with no reachable node:* builtin", async () => {
    const esbuild = loadEsbuild();

    let result: Awaited<ReturnType<EsbuildLike["build"]>>;
    try {
      result = await esbuild.build({
        entryPoints: [presetSrc],
        bundle: true,
        write: false,
        platform: "neutral",
        format: "esm",
        logLevel: "silent",
      });
    } catch (err) {
      // (1) Throw path. Inspect the build diagnostics for a node:* specifier.
      const buildErr = err as EsbuildBuildError;
      const diagnostics = (buildErr.errors ?? [])
        .map((e) => e.text ?? "")
        .join("\n");
      const leaked = nodeSpecifiersInDiagnostics(diagnostics);
      if (leaked.length > 0) {
        throw new Error(
          `preset eval graph leaked node:* builtins (unresolvable under platform=neutral): ${leaked.join(", ")}`,
        );
      }
      // A build failure unrelated to node:* is a genuine test failure.
      throw err;
    }

    // (2) Success path. No node:* in the emitted bundle.
    expect(result.errors).toEqual([]);
    expect(result.outputFiles.length).toBeGreaterThan(0);

    const bundled = result.outputFiles.map((f: { text: string }) => f.text).join("\n");
    const offenders = nodeSpecifiersInCode(bundled);

    expect(
      offenders,
      `preset eval graph leaked node:* builtins: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  // Self-test: prove the detector is LIVE, not dead code. A module that imports
  // a node builtin MUST be flagged by the same throw/scan logic the guard above
  // uses. If this ever stops flagging, the guard has silently lost its teeth
  // (the exact "refactored into a disabled state" failure mode raised in
  // review). Bundles a stdin probe so no temp file is written.
  it("DETECTS a node:* import (guard is not dead code)", async () => {
    const esbuild = loadEsbuild();
    const probe = {
      stdin: {
        contents: `import { readFileSync } from "node:fs"; export const x = typeof readFileSync;`,
        resolveDir: __dirname,
        loader: "ts",
      },
      bundle: true,
      write: false,
      platform: "neutral",
      format: "esm",
      logLevel: "silent",
    } as Record<string, unknown>;

    let leaked: string[];
    try {
      const r = await esbuild.build(probe);
      leaked = nodeSpecifiersInCode(r.outputFiles.map((f: { text: string }) => f.text).join("\n"));
    } catch (err) {
      const buildErr = err as EsbuildBuildError;
      leaked = nodeSpecifiersInDiagnostics(
        (buildErr.errors ?? []).map((e) => e.text ?? "").join("\n"),
      );
    }
    expect(leaked).toContain("node:fs");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Behavioral parity — the returned fragment reproduces the hand-written
// `zfb.config.ts` pipeline (collections loop, plugins, markdown.features,
// codeHighlight, resolveMarkdownLinks, stripMdExt, trailingSlash, minifyHtml).
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
  minifyHtml: true,
  mermaid: true,
  onBrokenMarkdownLinks: "warn",
  llmsTxt: true,
  changelogs: [
    {
      sourceDir: "src/content/docs/changelog",
      outputFile: "packages/zudo-doc/CHANGELOG.md",
      packageName: "@takazudo/zudo-doc",
    },
  ],
  docHistory: true,
  docHistoryExclude: ["drafts/**"],
  claudeResources: { claudeDir: ".claude" },
  githubAutolinksRepo: "zudolab/zudo-doc",
  packageOwnedRoutes: true,
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
  it("emits the package plugin specifiers in order (no project-relative copy-public since #2358)", () => {
    const { plugins } = preset();
    expect(plugins.map((p) => p.name)).toEqual([
      "@takazudo/zudo-doc/plugins/routes",
      "@takazudo/zudo-doc/plugins/claude-resources",
      "@takazudo/zudo-doc/plugins/doc-history",
      "@takazudo/zudo-doc/plugins/search-index",
      "@takazudo/zudo-doc/plugins/theme-packs",
      "@takazudo/zudo-doc/plugins/llms-txt",
      "@takazudo/zudo-doc/plugins/changelog",
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
      exclude: ["drafts/**"],
    });
    expect(byName["@takazudo/zudo-doc/plugins/search-index"]).toEqual({
      docsDir: "src/content/docs",
      locales: { ja: { dir: "src/content/docs-ja" } },
      base: "/",
    });
    expect(byName["@takazudo/zudo-doc/plugins/theme-packs"]).toEqual({
      base: "/",
      themePack: undefined,
      themePacks: undefined,
    });
    expect(byName["@takazudo/zudo-doc/plugins/llms-txt"]).toEqual({
      siteName: "zudo-doc",
      siteDescription: "Documentation base framework.",
      base: "/",
      siteUrl: "https://zudo-doc.takazudomodular.com",
      defaultLocaleDir: "src/content/docs",
      locales: [{ code: "ja", dir: "src/content/docs-ja" }],
    });
    expect(byName["@takazudo/zudo-doc/plugins/changelog"]).toEqual({
      changelogs: [
        {
          sourceDir: "src/content/docs/changelog",
          outputFile: "packages/zudo-doc/CHANGELOG.md",
          packageName: "@takazudo/zudo-doc",
        },
      ],
    });
    // copy-public-plugin.mjs was removed in #2358; no project-relative plugin expected.
  });

  it("threads settings.themePack / themePacks into the theme-packs plugin options", () => {
    const r = zudoDocPreset({
      settings: { ...fixtureSettings, themePack: "foundry", themePacks: ["default", "foundry"] },
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
    });
    const themePacks = r.plugins.find((p) => p.name === "@takazudo/zudo-doc/plugins/theme-packs");
    expect(themePacks?.options).toEqual({
      base: "/",
      themePack: "foundry",
      themePacks: ["default", "foundry"],
    });
  });

  it("defaults doc-history exclude patterns to an empty array", () => {
    const result = zudoDocPreset({
      settings: { ...fixtureSettings, docHistoryExclude: undefined },
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
    });
    const docHistory = result.plugins.find(
      (plugin) => plugin.name === "@takazudo/zudo-doc/plugins/doc-history",
    );

    expect(docHistory?.options?.["exclude"]).toEqual([]);
  });

  it("omits claude-resources / doc-history / llms-txt / changelog when their settings are falsy", () => {
    const r = zudoDocPreset({
      settings: { ...fixtureSettings, claudeResources: false, docHistory: false, llmsTxt: false, changelogs: false, packageOwnedRoutes: false },
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
    });
    expect(r.plugins.map((p) => p.name)).toEqual([
      "@takazudo/zudo-doc/plugins/search-index",
      "@takazudo/zudo-doc/plugins/theme-packs",
    ]);
  });

  // ── packageOwnedRoutes gate (Package-First Finale #2356, ADR
  //    route-injection-seam.md Decision 4) — off only when explicitly false.
  it("omits the routes plugin when packageOwnedRoutes is explicitly false", () => {
    const r = zudoDocPreset({
      settings: { ...fixtureSettings, packageOwnedRoutes: false },
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
    });
    expect(r.plugins.map((p) => p.name)).not.toContain("@takazudo/zudo-doc/plugins/routes");
  });

  it("adds the routes bare-specifier descriptor only when packageOwnedRoutes is true", () => {
    const r = zudoDocPreset({
      settings: { ...fixtureSettings, packageOwnedRoutes: true },
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
      translations: { en: { "doc.allTags": "All Tags" } },
      tagVocabulary: [{ id: "ai" }],
    });
    const routes = r.plugins.find((p) => p.name === "@takazudo/zudo-doc/plugins/routes");
    expect(routes).toBeDefined();
    // It is FIRST so injection happens before the other plugins' preBuild work.
    expect(r.plugins[0]?.name).toBe("@takazudo/zudo-doc/plugins/routes");
    // Options carry serializable settings/translations/tagVocabulary only.
    expect(routes?.options).toMatchObject({
      translations: { en: { "doc.allTags": "All Tags" } },
      tagVocabulary: [{ id: "ai" }],
    });
    expect((routes?.options as { settings: { packageOwnedRoutes?: boolean } }).settings.packageOwnedRoutes).toBe(true);
  });

  // ── default-on gate (#2404) ──────────────────────────────────────────────
  it("includes the routes plugin when packageOwnedRoutes is omitted (default-on, #2404)", () => {
    const { packageOwnedRoutes: _omitted, ...settingsWithoutFlag } = fixtureSettings;
    const r = zudoDocPreset({
      settings: settingsWithoutFlag,
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
    });
    expect(r.plugins.map((p) => p.name)).toContain("@takazudo/zudo-doc/plugins/routes");
    expect(r.plugins[0]?.name).toBe("@takazudo/zudo-doc/plugins/routes");
  });

  // ── explicit-false + content configured → diagnostic warning (#2404) ─────
  describe("explicit false + configured content emits console.warn (#2404)", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("warns when packageOwnedRoutes is false and docsDir is set", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      zudoDocPreset({
        settings: { ...fixtureSettings, packageOwnedRoutes: false },
        buildDocsSchema: buildFixtureSchema,
        directiveVocabulary: fixtureDirectives,
      });
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0]?.[0]).toContain("packageOwnedRoutes is off but doc content is configured");
    });

    it("does NOT warn when packageOwnedRoutes is false and content roots are all empty", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      zudoDocPreset({
        settings: {
          ...fixtureSettings,
          packageOwnedRoutes: false,
          docsDir: "",
          locales: {},
          versions: false,
        },
        buildDocsSchema: buildFixtureSchema,
        directiveVocabulary: fixtureDirectives,
      });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("does NOT warn (about packageOwnedRoutes=false) when packageOwnedRoutes is true and bindings are supplied", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      zudoDocPreset({
        settings: { ...fixtureSettings, packageOwnedRoutes: true },
        buildDocsSchema: buildFixtureSchema,
        directiveVocabulary: fixtureDirectives,
        // Supply both bindings so neither #2404 nor #2405 warning fires.
        translations: { en: { "doc.allTags": "All Tags" } },
        colorSchemes: { "Default Dark": fixtureColorScheme },
      });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("does NOT warn (about packageOwnedRoutes=false) when packageOwnedRoutes is omitted and bindings are supplied (default-on)", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { packageOwnedRoutes: _omitted, ...settingsWithoutFlag } = fixtureSettings;
      zudoDocPreset({
        settings: settingsWithoutFlag,
        buildDocsSchema: buildFixtureSchema,
        directiveVocabulary: fixtureDirectives,
        // Supply both bindings so neither #2404 nor #2405 warning fires.
        translations: { en: { "doc.allTags": "All Tags" } },
        colorSchemes: { "Default Dark": fixtureColorScheme },
      });
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});

// ── #2405 warning: packageOwnedRoutes on but host bindings missing ────────────
describe("zudoDocPreset silent-degradation diagnostic (#2405)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("warns when packageOwnedRoutes is on and colorSchemes is absent", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    zudoDocPreset({
      settings: { ...fixtureSettings, packageOwnedRoutes: true },
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
      translations: { en: { "doc.allTags": "All Tags" } },
      // colorSchemes intentionally absent
    });
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]?.[0]).toContain("colorSchemes");
    expect(warnSpy.mock.calls[0]?.[0]).toContain("packageOwnedRoutes is on");
  });

  it("warns when packageOwnedRoutes is on and translations is absent", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    zudoDocPreset({
      settings: { ...fixtureSettings, packageOwnedRoutes: true },
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
      // translations intentionally absent
      colorSchemes: { "Default Dark": fixtureColorScheme },
    });
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]?.[0]).toContain("translations");
    expect(warnSpy.mock.calls[0]?.[0]).toContain("packageOwnedRoutes is on");
  });

  it("does NOT warn when packageOwnedRoutes is off (about missing bindings)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      // suppress the #2404 'packageOwnedRoutes is off' warning
    });
    zudoDocPreset({
      settings: { ...fixtureSettings, packageOwnedRoutes: false },
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
      // no colorSchemes, no translations — but routes are off so no binding warning
    });
    // The only warn emitted is the #2404 one (packageOwnedRoutes is off + content configured).
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]?.[0]).toContain("packageOwnedRoutes is off");
    expect(warnSpy.mock.calls[0]?.[0]).not.toContain("packageOwnedRoutes is on");
  });

  it("does NOT warn when both translations and colorSchemes are supplied", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    zudoDocPreset({
      settings: { ...fixtureSettings, packageOwnedRoutes: true },
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
      translations: { en: { "doc.allTags": "All Tags" } },
      colorSchemes: { "Default Dark": fixtureColorScheme },
    });
    expect(warnSpy).not.toHaveBeenCalled();
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

  it("threads settings.mermaid while keeping hierarchical heading IDs", () => {
    const r = zudoDocPreset({
      settings: { ...fixtureSettings, mermaid: false },
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
    });
    expect(r.markdown.features.mermaid).toBe(false);
    expect(r.markdown.features.headingIds).toEqual({ strategy: "hierarchical" });
  });

  it("omits githubAutolinks when githubAutolinksRepo is absent (#2321)", () => {
    const r = zudoDocPreset({
      settings: { ...fixtureSettings, githubAutolinksRepo: undefined },
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
    });
    expect(r.markdown.features).not.toHaveProperty("githubAutolinks");
  });

  it("includes githubAutolinks when githubAutolinksRepo is set (#2321)", () => {
    const r = zudoDocPreset({
      settings: { ...fixtureSettings, githubAutolinksRepo: "owner/repo" },
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
    });
    expect(r.markdown.features.githubAutolinks).toEqual({ repo: "owner/repo" });
  });
});

describe("zudoDocPreset top-level pipeline fields", () => {
  it("emits class-mode codeHighlight, stripMdExt, trailingSlash, and minifyHtml", () => {
    const r = preset();
    expect(r.codeHighlight).toEqual({
      mode: "class",
      defaultStylesheet: true,
    });
    expect(r.codeHighlight).not.toHaveProperty("themeLight");
    expect(r.codeHighlight).not.toHaveProperty("themeDark");
    expect(r.codeHighlight).not.toHaveProperty("themesDir");
    expect(r.codeHighlight).not.toHaveProperty("classPrefix");
    expect(r.codeHighlight).not.toHaveProperty("roleClasses");
    expect(r.stripMdExt).toBe(true);
    expect(r.trailingSlash).toBe(true);
    expect(r.minifyHtml).toBe(true);
  });

  it("mirrors settings.trailingSlash", () => {
    const r = zudoDocPreset({
      settings: { ...fixtureSettings, trailingSlash: false },
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
    });
    expect(r.trailingSlash).toBe(false);
  });

  it("defaults minifyHtml to true when the setting is omitted", () => {
    const { minifyHtml: _omitted, ...settingsWithoutMinifyHtml } = fixtureSettings;
    const r = zudoDocPreset({
      settings: settingsWithoutMinifyHtml,
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
    });
    expect(r.minifyHtml).toBe(true);
  });

  it("mirrors settings.minifyHtml when explicitly false", () => {
    const r = zudoDocPreset({
      settings: { ...fixtureSettings, minifyHtml: false },
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
    });
    expect(r.minifyHtml).toBe(false);
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

describe("zudoDocPreset markdown.cjkFriendly", () => {
  it("forwards cjkFriendly: false to markdown.cjkFriendly", () => {
    const r = zudoDocPreset({
      settings: { ...fixtureSettings, cjkFriendly: false },
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
    });
    expect(r.markdown.cjkFriendly).toBe(false);
  });

  it("forwards cjkFriendly: true to markdown.cjkFriendly", () => {
    const r = zudoDocPreset({
      settings: { ...fixtureSettings, cjkFriendly: true },
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
    });
    expect(r.markdown.cjkFriendly).toBe(true);
  });

  it("leaves markdown.cjkFriendly absent when the setting is omitted", () => {
    const { cjkFriendly: _omitted, ...settingsWithoutCjk } = { ...fixtureSettings, cjkFriendly: undefined };
    const r = zudoDocPreset({
      settings: settingsWithoutCjk,
      buildDocsSchema: buildFixtureSchema,
      directiveVocabulary: fixtureDirectives,
    });
    expect(r.markdown).not.toHaveProperty("cjkFriendly");
  });
});
