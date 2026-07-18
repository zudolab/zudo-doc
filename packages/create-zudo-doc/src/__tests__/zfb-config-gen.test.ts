import { describe, it, expect } from "vitest";
import { generateZfbConfig, orderDesiredKeys } from "../zfb-config-gen.js";
import type { UserChoices } from "../prompts.js";

// Minimal-scaffold cutover (epic zudolab/zudo-doc#2651, Wave 6 #2660 / Wave 7
// #2662): `zfb-config-gen.ts` is now the ONE generator, emitting
// `defineConfig(zudoDoc({ ...diff-from-defaults }))` — there is no more
// `settings-gen.ts` / `src/config/settings.ts` split. Every assertion below
// targets that single-file, diff-from-defaults shape.

const baseChoices: UserChoices = {
  projectName: "test-doc",
  defaultLang: "en",
  colorSchemeMode: "single",
  singleScheme: "Default Dark",
  features: [],
  packageManager: "pnpm",
};

// The one combination whose resolved fields are byte-identical to
// `zudoDoc()`'s own `DEFAULT_SETTINGS` mirror for every field this generator
// can ever set (light/dark mode, Default Light/Default Dark, system-pref
// respecting) — the "near-empty" case the locked spec describes.
const packageDefaultChoices: UserChoices = {
  ...baseChoices,
  colorSchemeMode: "light-dark",
  singleScheme: undefined,
  lightScheme: "Default Light",
  darkScheme: "Default Dark",
  defaultMode: "dark",
  respectPrefersColorScheme: true,
};

describe("generateZfbConfig — imports and wrapper shape", () => {
  it("imports defineConfig from zfb/config and zudoDoc from @takazudo/zudo-doc/config", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).toContain('import { defineConfig } from "zfb/config";');
    expect(result).toContain(
      'import { zudoDoc } from "@takazudo/zudo-doc/config";',
    );
  });

  it("wraps the config in defineConfig(zudoDoc({ ... }))", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).toMatch(/export default defineConfig\(\s*zudoDoc\(\{/);
    expect(result.trim()).toMatch(/\}\),\s*\);$/);
  });

  it("migration guard: no Astro references", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).not.toContain("astro/config");
    expect(result).not.toContain("@astrojs/mdx");
    expect(result).not.toContain("@astrojs/preact");
  });

  it("does not inline collections, plugins, or zod (all delegated to the package preset)", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).not.toContain("collections");
    expect(result).not.toContain("plugins:");
    expect(result).not.toContain('from "zod"');
    expect(result).not.toContain("z.toJSONSchema");
    expect(result).not.toContain("directiveVocabulary");
    expect(result).not.toContain("const docsSchema");
  });

  it("does not emit inline plugin .mjs file references", () => {
    const result = generateZfbConfig({
      ...baseChoices,
      features: ["docHistory", "llmsTxt", "claudeResources", "search"],
    });
    expect(result).not.toContain("doc-history-plugin.mjs");
    expect(result).not.toContain("llms-txt-plugin.mjs");
    expect(result).not.toContain("claude-resources-plugin.mjs");
    expect(result).not.toContain("search-index-plugin.mjs");
  });
});

describe("generateZfbConfig — siteName always emitted", () => {
  it("emits siteName derived from the project name for every choice combination", () => {
    expect(generateZfbConfig(baseChoices)).toContain('siteName: "Test Doc"');
    expect(
      generateZfbConfig({ ...packageDefaultChoices, projectName: "my-cool-docs" }),
    ).toContain('siteName: "My Cool Docs"');
  });
});

describe("generateZfbConfig — diff-from-defaults (near-empty case)", () => {
  it("emits ONLY siteName + the always-different headerNav when every other choice matches the package default", () => {
    // packageDefaultChoices resolves colorMode/colorScheme to the exact
    // DEFAULT_MIRROR values, so both are diffed away. headerNav always gets
    // a "Getting Started" entry (default mirror is []). With no GitHub URL,
    // headerRightItems is just theme-toggle and therefore matches the default
    // mirror. No other field should appear.
    const result = generateZfbConfig(packageDefaultChoices);
    const bodyMatch = result.match(/zudoDoc\(\{([\s\S]*)\}\),/);
    expect(bodyMatch).not.toBeNull();
    const fieldNames = [...bodyMatch![1]!.matchAll(/^\s{4}(\w+):/gm)].map(
      (m) => m[1],
    );
    expect(fieldNames).toEqual(["siteName", "headerNav"]);
    expect(result).not.toContain("colorMode");
    expect(result).not.toContain("colorScheme:");
  });
});

describe("generateZfbConfig — color scheme", () => {
  it("single mode emits colorMode: false (diffs from the light-dark default mirror)", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).toContain("colorMode: false");
  });

  it("single mode omits colorScheme when it matches the default (Default Dark)", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).not.toContain('colorScheme: "Default Dark"');
  });

  it("single mode emits colorScheme when it differs from the default (Default Light)", () => {
    const result = generateZfbConfig({
      ...baseChoices,
      singleScheme: "Default Light",
    });
    expect(result).toContain('colorScheme: "Default Light"');
  });

  it("light-dark mode with non-default wiring emits the full colorMode object", () => {
    const result = generateZfbConfig({
      ...baseChoices,
      colorSchemeMode: "light-dark",
      singleScheme: undefined,
      lightScheme: "Default Light",
      darkScheme: "Default Dark",
      defaultMode: "light",
      respectPrefersColorScheme: false,
    });
    expect(result).toContain("colorMode: {");
    expect(result).toContain('defaultMode: "light"');
    expect(result).toContain("respectPrefersColorScheme: false");
  });
});

describe("generateZfbConfig — theme pack (ADR #2818)", () => {
  it("emits themePack when a non-default slug is chosen", () => {
    const result = generateZfbConfig({ ...baseChoices, themePack: "foundry" });
    expect(result).toContain('themePack: "foundry"');
  });

  it("omits themePack when it matches the default", () => {
    const result = generateZfbConfig({ ...baseChoices, themePack: "default" });
    expect(result).not.toContain("themePack");
  });

  it("omits themePack entirely when no theme-pack choice was made", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).not.toContain("themePack");
  });

  it("emits themePackSwitcher: true when the feature is selected", () => {
    const result = generateZfbConfig({
      ...baseChoices,
      features: ["themePackSwitcher"],
    });
    expect(result).toContain("themePackSwitcher: true");
  });

  it("omits themePackSwitcher when not selected (matches its false default)", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).not.toContain("themePackSwitcher");
  });

  it("never emits themePacks (advanced, hand-edit-only field — no CLI/prompt surface)", () => {
    const result = generateZfbConfig({
      ...baseChoices,
      themePack: "foundry",
      features: ["themePackSwitcher"],
    });
    expect(result).not.toContain("themePacks");
  });
});

describe("generateZfbConfig — i18n", () => {
  it("emits a locales entry keyed by the secondary language", () => {
    const result = generateZfbConfig({ ...baseChoices, features: ["i18n"] });
    expect(result).toContain("locales: {");
    expect(result).toContain("ja: {");
    expect(result).toContain('label: "JA"');
    expect(result).toContain('dir: "src/content/docs-ja"');
  });

  it("omits locales entirely when i18n is off (matches the {} default)", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).not.toContain("locales:");
  });

  it("adds language-switcher to headerRightItems when i18n is on", () => {
    const result = generateZfbConfig({ ...baseChoices, features: ["i18n"] });
    expect(result).toContain('component: "language-switcher"');
  });

  it("swaps the secondary language when defaultLang is ja", () => {
    const result = generateZfbConfig({
      ...baseChoices,
      defaultLang: "ja",
      features: ["i18n"],
    });
    expect(result).toContain("en: {");
    expect(result).toContain('dir: "src/content/docs-en"');
  });
});

describe("generateZfbConfig — tagGovernance", () => {
  it("derives all tag settings from the explicit tag CLI config", () => {
    const result = generateZfbConfig({
      ...baseChoices,
      features: ["tagGovernance"],
    });
    expect(result).toContain("tagGovernance: tagCliConfig.governance");
    expect(result).toContain(
      "tagVocabulary: tagCliConfig.vocabularyActive",
    );
    expect(result).toContain(
      "tagVocabularyEntries: tagCliConfig.vocabulary",
    );
    expect(result).toContain(
      'import tagCliConfig from "./src/config/tag-vocabulary";',
    );
  });

  it("omits tagGovernance/tagVocabulary/the import when disabled (matches off/false defaults)", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).not.toContain("tagGovernance");
    expect(result).not.toContain("tagVocabulary");
    expect(result).not.toContain("tag-vocabulary");
  });
});

describe("generateZfbConfig — simple boolean feature fields", () => {
  const cases: Array<[string, string]> = [
    ["docTags", "docTags: true"],
    ["llmsTxt", "llmsTxt: true"],
    ["designTokenPanel", "designTokenPanel: true"],
    ["sidebarResizer", "sidebarResizer: true"],
    ["sidebarToggle", "sidebarToggle: true"],
    ["imageEnlarge", "imageEnlarge: true"],
    ["dynamicPageTransition", "dynamicPageTransition: true"],
    ["docHistory", "docHistory: true"],
    ["noindex", "noindex: true"],
  ];

  it.each(cases)("selecting %s emits %s", (feature, expected) => {
    const result = generateZfbConfig({ ...baseChoices, features: [feature] });
    expect(result).toContain(expected);
  });

  it.each(cases)(
    "NOT selecting %s omits the field entirely (matches its false default)",
    (feature) => {
      const fieldName = expected_field_name(feature);
      const result = generateZfbConfig(baseChoices);
      expect(result).not.toMatch(new RegExp(`\\b${fieldName}:\\s*true`));
    },
  );

  function expected_field_name(feature: string): string {
    return feature;
  }
});

describe("generateZfbConfig — findInPage rides the tauri feature (#2690)", () => {
  // findInPage has no CLI flag/prompt of its own — it is set whenever the
  // tauri feature is selected (the Cmd/Ctrl+F find bar only makes sense
  // inside the Tauri desktop shell). Deliberately its own describe block,
  // NOT folded into the "simple boolean feature fields" table above: that
  // table's negative-case helper assumes feature name === field name
  // (`expected_field_name(feature) === feature`), which would check for a
  // literal `tauri: true` — the wrong field name — and pass vacuously
  // without proving findInPage is actually omitted.
  it("selecting tauri emits findInPage: true", () => {
    const result = generateZfbConfig({ ...baseChoices, features: ["tauri"] });
    expect(result).toContain("findInPage: true");
  });

  it("NOT selecting tauri omits findInPage entirely (matches its false default)", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).not.toContain("findInPage");
  });
});

describe("generateZfbConfig — designTokenPanel headerRightItems trigger", () => {
  it("prepends the design-token-panel trigger when enabled", () => {
    const result = generateZfbConfig({
      ...baseChoices,
      features: ["designTokenPanel"],
    });
    expect(result).toContain('trigger: "design-token-panel"');
    // Trigger remains the first item in the default builder. With no GitHub
    // URL, the inert github-link is omitted.
    expect(result.indexOf('trigger: "design-token-panel"')).toBeLessThan(
      result.indexOf('component: "theme-toggle"'),
    );
    expect(result).not.toContain('component: "github-link"');
  });

  it("omits the trigger when disabled", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).not.toContain("design-token-panel");
  });
});

describe("generateZfbConfig — bodyFootUtilArea", () => {
  it("emits bodyFootUtilArea with docHistory/viewSourceLink derived from other choices", () => {
    const result = generateZfbConfig({
      ...baseChoices,
      features: ["bodyFootUtil"],
      githubUrl: "https://github.com/x/y",
    });
    expect(result).toContain("bodyFootUtilArea: {");
    // bodyFootUtil auto-enables docHistory at the scaffold() layer, but
    // zfb-config-gen operates on `choices.features` as given — this unit
    // test exercises the generator directly, so docHistory here reflects
    // exactly what's in `features`.
    expect(result).toContain("viewSourceLink: true");
  });

  it("viewSourceLink is false when no githubUrl is set", () => {
    const result = generateZfbConfig({
      ...baseChoices,
      features: ["bodyFootUtil"],
    });
    expect(result).toContain("viewSourceLink: false");
  });

  it("omits bodyFootUtilArea entirely when the feature is not selected", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).not.toContain("bodyFootUtilArea");
  });
});

describe("generateZfbConfig — versioning", () => {
  it("emits versions: [] and a version-switcher header item when enabled", () => {
    const result = generateZfbConfig({
      ...baseChoices,
      features: ["versioning"],
    });
    expect(result).toContain("versions: []");
    expect(result).toContain('component: "version-switcher"');
  });

  it("omits versions when disabled (matches the false default)", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).not.toContain("versions:");
  });
});

describe("generateZfbConfig — claudeResources", () => {
  it("emits claudeResources, defaultLocaleOnlyPrefixes, and a Claude headerNav entry", () => {
    const result = generateZfbConfig({
      ...baseChoices,
      features: ["claudeResources"],
    });
    expect(result).toContain("claudeResources: {");
    expect(result).toContain('claudeDir: ".claude"');
    expect(result).toContain('"/docs/claude-md/"');
    expect(result).toContain('"/docs/claude-skills/"');
    expect(result).toContain('"/docs/claude-agents/"');
    expect(result).toContain('"/docs/claude-commands/"');
    expect(result).toContain('label: "Claude"');
    expect(result).toContain('path: "/docs/claude"');
  });

  it("omits claudeResources and defaultLocaleOnlyPrefixes when disabled", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).not.toContain("claudeResources");
    expect(result).not.toContain("defaultLocaleOnlyPrefixes");
  });
});

describe("generateZfbConfig — footer (footerNavGroup / footerCopyright / footerTaglist)", () => {
  it("emits footer.links when footerNavGroup is enabled", () => {
    const result = generateZfbConfig({
      ...baseChoices,
      features: ["footerNavGroup"],
    });
    expect(result).toContain("footer: {");
    expect(result).toContain('title: "Docs"');
    expect(result).toContain('href: "/docs/getting-started"');
  });

  it("emits footer.copyright when footerCopyright is enabled", () => {
    const result = generateZfbConfig({
      ...baseChoices,
      features: ["footerCopyright"],
    });
    expect(result).toContain("copyright:");
    expect(result).toContain("Built with zudo-doc.");
  });

  it("emits footer.taglist when footerTaglist is enabled", () => {
    const result = generateZfbConfig({
      ...baseChoices,
      features: ["footerTaglist"],
    });
    expect(result).toContain("taglist: {");
    expect(result).toContain("enabled: true");
    expect(result).toContain('groupBy: "group"');
  });

  it("omits footer entirely when no footer feature is selected (matches the false default)", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).not.toContain("footer:");
  });
});

describe("generateZfbConfig — changelog headerNav entry", () => {
  it("adds a Changelog headerNav item when the changelog feature is on", () => {
    const result = generateZfbConfig({
      ...baseChoices,
      features: ["changelog"],
    });
    expect(result).toContain('label: "Changelog"');
    expect(result).toContain('path: "/docs/changelog"');
  });

  it("does not add a Changelog headerNav item when off", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).not.toContain("Changelog");
  });
});

describe("generateZfbConfig — headerRightItems override", () => {
  it("emits a user-supplied headerRightItems array verbatim", () => {
    const result = generateZfbConfig({
      ...baseChoices,
      features: ["search", "i18n"],
      headerRightItems: [
        { type: "component", component: "github-link" },
        { type: "trigger", trigger: "ai-chat" },
      ],
    });
    const githubIndex = result.indexOf('component: "github-link"');
    const aiChatIndex = result.indexOf('trigger: "ai-chat"');
    expect(githubIndex).toBeGreaterThan(-1);
    expect(result).toContain('trigger: "ai-chat"');
    expect(githubIndex).toBeLessThan(aiChatIndex);
    // No URL is configured, but explicit items are preserved. Feature-based
    // defaults are not added to the override.
    expect(result).not.toContain('component: "theme-toggle"');
    expect(result).not.toContain('component: "search"');
    expect(result).not.toContain('component: "language-switcher"');
  });

  it("honors an explicit empty array (user wants no header-right items)", () => {
    const result = generateZfbConfig({ ...baseChoices, headerRightItems: [] });
    expect(result).toContain("headerRightItems: []");
  });

  it("does not filter a design-token-panel trigger from an explicit override when the feature is off", () => {
    const result = generateZfbConfig({
      ...baseChoices,
      headerRightItems: [
        { type: "trigger", trigger: "design-token-panel" },
        { type: "component", component: "theme-toggle" },
        { type: "component", component: "github-link" },
      ],
    });
    expect(result).toContain('trigger: "design-token-panel"');
    expect(result).toContain('component: "theme-toggle"');
    expect(result).toContain('component: "github-link"');
  });

  it("keeps the remaining default items in order around a URL-backed github-link", () => {
    const result = generateZfbConfig({
      ...baseChoices,
      githubUrl: "https://github.com/x/y",
      features: ["designTokenPanel", "versioning", "search", "i18n"],
    });
    const headerRightItems = result.match(
      /headerRightItems: \[([\s\S]*?)\n    \],/,
    );
    expect(headerRightItems).not.toBeNull();
    const itemNames = [
      ...headerRightItems![1]!.matchAll(/(?:trigger|component): "([^"]+)"/g),
    ].map((match) => match[1]);
    expect(itemNames).toEqual([
      "design-token-panel",
      "version-switcher",
      "github-link",
      "theme-toggle",
      "search",
      "language-switcher",
    ]);
  });
});

describe("generateZfbConfig — metaTags override", () => {
  it("omits metaTags entirely when not supplied in choices", () => {
    const result = generateZfbConfig(baseChoices);
    expect(result).not.toContain("metaTags");
  });

  it("emits the metaTags block with S4-style defaults filled in when partially supplied", () => {
    const result = generateZfbConfig({
      ...baseChoices,
      metaTags: { ogImage: "/img/og.png" },
    });
    expect(result).toContain("metaTags: {");
    expect(result).toContain("description: true");
    expect(result).toContain('ogImage: "/img/og.png"');
    expect(result).toContain("ogSiteName: true");
    expect(result).toContain("twitterCard: false");
  });

  it("emits twitterSite/twitterCreator only when twitterCard is set", () => {
    const result = generateZfbConfig({
      ...baseChoices,
      metaTags: {
        twitterCard: "summary_large_image",
        twitterSite: "@brand",
        twitterCreator: "@author",
      },
    });
    expect(result).toContain('twitterCard: "summary_large_image"');
    expect(result).toContain('twitterSite: "@brand"');
    expect(result).toContain('twitterCreator: "@author"');
  });
});

describe("generateZfbConfig — misc scalar fields", () => {
  it("emits minifyHtml: false when explicitly chosen (diffs from the true default)", () => {
    const result = generateZfbConfig({ ...baseChoices, minifyHtml: false });
    expect(result).toContain("minifyHtml: false");
  });

  it("omits minifyHtml when it matches the true default", () => {
    const result = generateZfbConfig({ ...baseChoices, minifyHtml: true });
    expect(result).not.toContain("minifyHtml");
  });

  it("emits cjkFriendly: true when chosen", () => {
    const result = generateZfbConfig({ ...baseChoices, cjkFriendly: true });
    expect(result).toContain("cjkFriendly: true");
  });

  it("emits a trimmed githubUrl and default github-link when set", () => {
    const withUrl = generateZfbConfig({
      ...baseChoices,
      githubUrl: "  https://github.com/x/y  ",
    });
    expect(withUrl).toContain('githubUrl: "https://github.com/x/y"');
    expect(withUrl).toContain('component: "github-link"');
    expect(withUrl.indexOf('component: "github-link"')).toBeLessThan(
      withUrl.indexOf('component: "theme-toggle"'),
    );
  });

  it.each([
    ["omitted", undefined],
    ["false", false],
    ["empty", ""],
    ["whitespace-only", "  \t  "],
  ])("omits githubUrl and the default github-link when %s", (_label, githubUrl) => {
    const result = generateZfbConfig({
      ...baseChoices,
      githubUrl: githubUrl as UserChoices["githubUrl"],
    });
    expect(result).not.toContain("githubUrl");
    expect(result).not.toContain('component: "github-link"');
  });
});

describe("generateZfbConfig — field order mirrors ZudoDocConfig's declared order", () => {
  it("emits fields in the documented FIELD_ORDER sequence, not choice-input order", () => {
    // designTokenPanel is selected AFTER tagGovernance in `features`, but
    // FIELD_ORDER declares tagGovernance/tagVocabulary before
    // designTokenPanel — the emitted file must follow FIELD_ORDER, not
    // array-input order.
    const result = generateZfbConfig({
      ...baseChoices,
      features: ["designTokenPanel", "tagGovernance", "llmsTxt"],
    });
    const idxTagGovernance = result.indexOf("tagGovernance:");
    const idxLlmsTxt = result.indexOf("llmsTxt:");
    const idxDesignTokenPanel = result.indexOf("designTokenPanel:");
    expect(idxTagGovernance).toBeGreaterThan(-1);
    expect(idxLlmsTxt).toBeGreaterThan(-1);
    expect(idxDesignTokenPanel).toBeGreaterThan(-1);
    expect(idxTagGovernance).toBeLessThan(idxLlmsTxt);
    expect(idxLlmsTxt).toBeLessThan(idxDesignTokenPanel);
  });
});

describe("generateZfbConfig — never emits escape-hatch / shell / package-only fields", () => {
  // These ZudoDocConfig fields exist on the package's config type but have
  // no CLI/prompt/preset surface in create-zudo-doc — the generator must
  // never accidentally leak one of them into the emitted file. Exercised
  // against the "all-on" combination so every emission branch is live.
  it("omits non-serializable escape hatches, shell passthrough, and unexposed settings fields", () => {
    const result = generateZfbConfig({
      ...baseChoices,
      features: [
        "i18n",
        "search",
        "docTags",
        "tagGovernance",
        "llmsTxt",
        "designTokenPanel",
        "sidebarResizer",
        "sidebarToggle",
        "imageEnlarge",
        "dynamicPageTransition",
        "docHistory",
        "bodyFootUtil",
        "versioning",
        "claudeResources",
        "footerNavGroup",
        "footerCopyright",
        "footerTaglist",
        "changelog",
        "noindex",
      ],
      githubUrl: "https://github.com/x/y",
    });
    const forbidden = [
      "buildDocsSchema",
      "colorSchemes:",
      "translations:",
      "directives:",
      "port:",
      "adapter:",
      "bundle:",
      "chromeBindingsModule",
      "packageOwnedRoutes",
      "docsDir:",
      "base:",
      "trailingSlash:",
      "home:",
      "siteDescription:",
      "mermaid:",
      "editUrl:",
      "githubAutolinksRepo",
      "siteUrl:",
      "head:",
      "sitemap:",
      "docMetainfo:",
      "tagPlacement:",
      "changelogs:",
      "math:",
      "onBrokenMarkdownLinks",
      "aiAssistant",
      "aiChatDemoMode",
      "aiChatAllowedOrigins",
      "aiChatGlobalDailyLimit",
      "tocMinDepth",
      "tocMaxDepth",
      "headingIdStrategy",
      "frontmatterPreview",
      "htmlPreview",
    ];
    for (const token of forbidden) {
      expect(result, `must not contain "${token}"`).not.toContain(token);
    }
  });
});

describe("orderDesiredKeys — leftover keys are appended, never dropped", () => {
  it("orders FIELD_ORDER keys first (declaration order), then the rest", () => {
    // siteName (idx 2) declared after colorScheme (idx 0) in FIELD_ORDER, so
    // it must come out in that order regardless of input order.
    const ordered = orderDesiredKeys(["siteName", "colorScheme"]);
    expect(ordered.indexOf("colorScheme")).toBeLessThan(
      ordered.indexOf("siteName"),
    );
  });

  it("appends a key NOT in FIELD_ORDER at the end (proves it is emitted, not silently dropped)", () => {
    const ordered = orderDesiredKeys(["zzzUnlisted", "colorScheme", "siteName"]);
    // The unlisted key survives...
    expect(ordered).toContain("zzzUnlisted");
    // ...and lands after every FIELD_ORDER key.
    expect(ordered[ordered.length - 1]).toBe("zzzUnlisted");
  });

  it("appends multiple leftover keys in alphabetical (deterministic) order", () => {
    const ordered = orderDesiredKeys(["yyy", "siteName", "aaa"]);
    const leftover = ordered.filter((k) => k === "aaa" || k === "yyy");
    expect(leftover).toEqual(["aaa", "yyy"]);
  });
});

describe("generateZfbConfig — imageEnlarge IS a real zudoDoc() field (not the old Astro rehype plugin)", () => {
  // Historical note: the old Astro-era generator implemented imageEnlarge as
  // an inline rehype plugin and this suite asserted it must NEVER appear as
  // a config field. Post-cutover, `imageEnlarge` is a genuine `ZudoDocConfig`
  // boolean (packages/zudo-doc/src/config.ts) — the assertion direction
  // flips: it MUST appear when selected, and rehypeImageEnlarge must still
  // never appear (that mechanism is gone for good).
  it("emits imageEnlarge: true when selected and never emits rehypeImageEnlarge", () => {
    const result = generateZfbConfig({
      ...baseChoices,
      features: ["imageEnlarge"],
    });
    expect(result).toContain("imageEnlarge: true");
    expect(result).not.toContain("rehypeImageEnlarge");
  });
});
