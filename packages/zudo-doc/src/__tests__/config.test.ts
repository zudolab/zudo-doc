import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";
import { zudoDoc, DEFAULT_SETTINGS } from "../config.js";
import { zudoDocPreset } from "../preset.js";
import { buildDocsSchema as defaultBuildDocsSchema } from "../docs-schema/index.js";
import { defaultDirectiveVocabulary } from "../directive-vocabulary-defaults/index.js";
import { defaultTranslations } from "../i18n-defaults/index.js";
import { defaultColorSchemes } from "../color-schemes-defaults/index.js";

const invalidHeadingIdConfig: Parameters<typeof zudoDoc>[0] = {
  // @ts-expect-error The removed strategy setting is rejected by the config type.
  headingIdStrategy: "flat",
};
void invalidHeadingIdConfig;

const invalidGithubAutolinksConfig: Parameters<typeof zudoDoc>[0] = {
  // @ts-expect-error The removed githubAutolinksRepo setting is rejected by the config type.
  githubAutolinksRepo: "owner/repo",
};
void invalidGithubAutolinksConfig;

// The routes plugin descriptor's options carry the serializable virtual-module
// payload. Helper to pull it out of a built config.
function routesOptions(config: ReturnType<typeof zudoDoc>) {
  const routes = (config.plugins ?? []).find(
    (p) => p.name === "@takazudo/zudo-doc/plugins/routes",
  );
  return routes?.options as
    | {
        settings: Record<string, unknown>;
        translations: Record<string, unknown>;
        tagVocabulary: unknown[];
        colorSchemes: unknown;
      }
    | undefined;
}

// Recursively assert no value in `node` is a function (serializability gate).
function assertNoFunctions(node: unknown, path = "root"): void {
  if (typeof node === "function") {
    throw new Error(`function value found at ${path}`);
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      assertNoFunctions(v, `${path}.${k}`);
    }
  }
}

// ── Complete ZfbConfig shell ─────────────────────────────────────────────────
describe("zudoDoc() returns a complete ZfbConfig", () => {
  it("emits the host-owned shell fields (framework, port, tailwind, base)", () => {
    const config = zudoDoc({ siteName: "My Docs" });
    expect(config.framework).toBe("preact");
    expect(config.port).toBe(4321);
    expect(config.tailwind).toEqual({ enabled: true });
    expect(config.base).toBe("/");
  });

  it("carries NO `presets` field (JS composition, not zfb-native presets — #2653)", () => {
    expect(zudoDoc({ siteName: "X" })).not.toHaveProperty("presets");
  });

  it("includes the preset-owned fields (collections/plugins/markdown/…)", () => {
    const config = zudoDoc({ siteName: "X" });
    expect(config.collections?.map((c) => c.name)).toEqual(["docs"]);
    expect(config.codeHighlight).toEqual({
      mode: "class",
      defaultStylesheet: true,
    });
    expect(config.stripMdExt).toBe(true);
    // packageOwnedRoutes defaults on, so the routes plugin is present + first.
    expect(config.plugins?.[0]?.name).toBe("@takazudo/zudo-doc/plugins/routes");
  });

  it("passes `port` through when given, else defaults to 4321", () => {
    expect(zudoDoc({ port: 3000 }).port).toBe(3000);
    expect(zudoDoc({}).port).toBe(4321);
  });

  it("passes `adapter` and `bundle` through only when given", () => {
    const bare = zudoDoc({ siteName: "X" });
    expect(bare).not.toHaveProperty("adapter");
    expect(bare).not.toHaveProperty("bundle");

    const full = zudoDoc({
      adapter: "@takazudo/zfb-adapter-cloudflare",
      bundle: { exclude: ["components/*.stories.tsx"] },
    });
    expect(full.adapter).toBe("@takazudo/zfb-adapter-cloudflare");
    expect(full.bundle).toEqual({ exclude: ["components/*.stories.tsx"] });
  });
});

// ── Default-merge semantics (omitted vs explicit-false vs override) ───────────
describe("zudoDoc() default-merge semantics", () => {
  it("rejects the removed headingIdStrategy setting", () => {
    expect(() =>
      zudoDoc({
        headingIdStrategy: "flat",
      } as unknown as Parameters<typeof zudoDoc>[0]),
    ).toThrow(/headingIdStrategy is no longer supported/);
  });

  it("rejects the removed githubAutolinksRepo setting", () => {
    expect(() =>
      zudoDoc({
        githubAutolinksRepo: "owner/repo",
      } as unknown as Parameters<typeof zudoDoc>[0]),
    ).toThrow(/githubAutolinksRepo is no longer supported/);
  });

  it("omitted field falls back to DEFAULT_SETTINGS (mermaid defaults true)", () => {
    expect(zudoDoc({}).markdown?.features?.mermaid).toBe(true);
  });

  it("explicit `false` wins over a true-default (mermaid)", () => {
    expect(zudoDoc({ mermaid: false }).markdown?.features?.mermaid).toBe(false);
  });

  it("explicit `false` on packageOwnedRoutes drops the routes plugin", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const plugins = zudoDoc({ packageOwnedRoutes: false }).plugins ?? [];
    expect(plugins.map((p) => p.name)).not.toContain(
      "@takazudo/zudo-doc/plugins/routes",
    );
    warnSpy.mockRestore();
  });

  it("a non-default override wins (docsDir)", () => {
    const config = zudoDoc({ docsDir: "content/docs" });
    expect(config.collections?.[0]?.path).toBe("content/docs");
  });

  it("siteName rides into the routes virtual-module settings", () => {
    const opts = routesOptions(zudoDoc({ siteName: "Custom Name" }));
    expect(opts?.settings.siteName).toBe("Custom Name");
  });

  it("defaults the package-owned home layout to narrow", () => {
    const opts = routesOptions(zudoDoc({}));
    expect(DEFAULT_SETTINGS.home).toEqual({ wide: false });
    expect(opts?.settings.home).toEqual({ wide: false });
  });

  it("serializes the wide home opt-in into the route settings", () => {
    const opts = routesOptions(zudoDoc({ home: { wide: true } }));
    expect(opts?.settings.home).toEqual({ wide: true });
    expect(JSON.parse(JSON.stringify(opts?.settings)).home).toEqual({ wide: true });
  });
});

// ── Serializability split (virtual-module payload carries no functions) ───────
describe("zudoDoc() serializability split", () => {
  it("the routes plugin options contain no function values", () => {
    const opts = routesOptions(
      zudoDoc({ siteName: "X", buildDocsSchema: () => defaultBuildDocsSchema() }),
    );
    expect(opts).toBeDefined();
    assertNoFunctions(opts);
  });

  it("the serialized settings do NOT leak the escape-hatch / shell fields", () => {
    const opts = routesOptions(
      zudoDoc({
        siteName: "X",
        buildDocsSchema: () => defaultBuildDocsSchema(),
        directives: { note: "Note" },
        translations: { en: {} },
        colorSchemes: {},
        tagVocabularyEntries: [{ id: "ai" }],
        port: 3000,
        adapter: "@takazudo/zfb-adapter-cloudflare",
        bundle: { exclude: [] },
      }),
    );
    const settings = opts?.settings ?? {};
    for (const leaked of [
      "buildDocsSchema",
      "directives",
      "translations",
      "colorSchemes",
      "tagVocabularyEntries",
      "port",
      "adapter",
      "bundle",
    ]) {
      expect(settings).not.toHaveProperty(leaked);
    }
  });

  it("the whole routes payload survives a JSON round-trip (JSON-serializable)", () => {
    const opts = routesOptions(zudoDoc({ siteName: "X" }));
    expect(() => JSON.stringify(opts)).not.toThrow();
  });
});

// ── Zero-override == zudoDocPreset() with the package defaults ────────────────
describe("zudoDoc({}) preset-owned output equals zudoDocPreset() with template defaults", () => {
  it("matches collections/plugins/markdown/codeHighlight/resolveMarkdownLinks/… field-for-field", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const config = zudoDoc({});

    const expected = zudoDocPreset({
      settings: DEFAULT_SETTINGS,
      buildDocsSchema: () =>
        defaultBuildDocsSchema({
          tagGovernance: DEFAULT_SETTINGS.tagGovernance,
          tagVocabulary: undefined,
        }),
      directiveVocabulary: defaultDirectiveVocabulary,
      translations: defaultTranslations,
      colorSchemes: defaultColorSchemes,
      tagVocabulary: [],
    });

    expect(config.collections).toEqual(expected.collections);
    expect(config.plugins).toEqual(expected.plugins);
    expect(config.markdown).toEqual(expected.markdown);
    expect(config.codeHighlight).toEqual(expected.codeHighlight);
    expect(config.resolveMarkdownLinks).toEqual(expected.resolveMarkdownLinks);
    expect(config.stripMdExt).toBe(expected.stripMdExt);
    expect(config.trailingSlash).toBe(expected.trailingSlash);
    expect(config.minifyHtml).toBe(expected.minifyHtml);

    warnSpy.mockRestore();
  });
});

// ── buildPlugins() diagnostics (gate 5) ──────────────────────────────────────
describe("zudoDoc() build-time diagnostics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("default users emit NO warning (translations + colorSchemes auto-supplied)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    zudoDoc({ siteName: "X" });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("still warns when packageOwnedRoutes is off and content is configured (#2404)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // DEFAULT_SETTINGS.docsDir is non-empty, so content is configured.
    zudoDoc({ packageOwnedRoutes: false });
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]?.[0]).toContain(
      "packageOwnedRoutes is off but doc content is configured",
    );
  });
});

// ── Escape-hatch overrides flow to the right places ──────────────────────────
describe("zudoDoc() escape-hatch overrides", () => {
  it("`directives` override replaces the markdown directive map", () => {
    const config = zudoDoc({ directives: { note: "MyNote" } });
    expect(config.markdown?.features?.directives).toEqual({ note: "MyNote" });
  });

  it("`translations` / `colorSchemes` / `tagVocabularyEntries` ride into routes options", () => {
    const opts = routesOptions(
      zudoDoc({
        translations: { en: { "doc.allTags": "All Tags" } },
        colorSchemes: { "Custom": defaultColorSchemes["Default Dark"]! },
        tagVocabularyEntries: [{ id: "ai" }],
      }),
    );
    expect(opts?.translations).toEqual({ en: { "doc.allTags": "All Tags" } });
    expect(opts?.tagVocabulary).toEqual([{ id: "ai" }]);
    expect(opts?.colorSchemes).toHaveProperty("Custom");
  });

  it("`tagVocabularyEntries` + strict governance tightens the docs schema `tags`", () => {
    const strict = zudoDoc({
      tagGovernance: "strict",
      tagVocabularyEntries: [{ id: "ai" }, { id: "guide" }],
    });
    const loose = zudoDoc({});
    // Strict enum schema differs from the loose string-array schema.
    expect(strict.collections?.[0]?.schema).not.toEqual(
      loose.collections?.[0]?.schema,
    );
  });

  it("`buildDocsSchema` override replaces the schema builder", () => {
    const custom = zudoDoc({
      // A schema with a distinctive extra field so the JSON Schema differs.
      buildDocsSchema: () =>
        z.object({ title: z.string(), zzz_marker: z.string() }).passthrough(),
    });
    const schema = JSON.stringify(custom.collections?.[0]?.schema);
    expect(schema).toContain("zzz_marker");
  });
});
