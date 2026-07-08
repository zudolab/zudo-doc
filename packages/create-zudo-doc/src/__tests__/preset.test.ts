import { describe, it, expect } from "vitest";
import { presetToChoices, validatePreset } from "../preset.js";
// F4 (S4 #2013) — project-name validation on preset path

describe("presetToChoices — cjkFriendly", () => {
  it("forwards cjkFriendly: true", () => {
    const choices = presetToChoices({ cjkFriendly: true });
    expect(choices.cjkFriendly).toBe(true);
  });

  it("forwards cjkFriendly: false", () => {
    const choices = presetToChoices({ cjkFriendly: false });
    expect(choices.cjkFriendly).toBe(false);
  });

  it("leaves cjkFriendly undefined when omitted", () => {
    const choices = presetToChoices({});
    expect(choices.cjkFriendly).toBeUndefined();
  });
});

describe("presetToChoices — minifyHtml", () => {
  it("forwards minifyHtml: true", () => {
    const choices = presetToChoices({ minifyHtml: true });
    expect(choices.minifyHtml).toBe(true);
  });

  it("forwards minifyHtml: false", () => {
    const choices = presetToChoices({ minifyHtml: false });
    expect(choices.minifyHtml).toBe(false);
  });

  it("leaves minifyHtml undefined when omitted", () => {
    const choices = presetToChoices({});
    expect(choices.minifyHtml).toBeUndefined();
  });
});

describe("validatePreset — cjkFriendly", () => {
  it("accepts boolean true", () => {
    expect(validatePreset({ cjkFriendly: true })).toBeNull();
  });

  it("accepts boolean false", () => {
    expect(validatePreset({ cjkFriendly: false })).toBeNull();
  });

  it("rejects non-boolean values", () => {
    expect(validatePreset({ cjkFriendly: "yes" })).toMatch(
      /cjkFriendly.*must be a boolean/,
    );
  });
});

describe("validatePreset — minifyHtml", () => {
  it("accepts boolean true", () => {
    expect(validatePreset({ minifyHtml: true })).toBeNull();
  });

  it("accepts boolean false", () => {
    expect(validatePreset({ minifyHtml: false })).toBeNull();
  });

  it("rejects non-boolean values", () => {
    expect(validatePreset({ minifyHtml: "yes" })).toMatch(
      /minifyHtml.*must be a boolean/,
    );
  });
});

describe("validatePreset — headerRightItems (sub #440)", () => {
  it("accepts a valid mix of component and trigger items", () => {
    expect(
      validatePreset({
        headerRightItems: [
          { type: "component", component: "theme-toggle" },
          { type: "trigger", trigger: "design-token-panel" },
          { type: "component", component: "github-link" },
          { type: "trigger", trigger: "ai-chat" },
          { type: "component", component: "search" },
          { type: "component", component: "version-switcher" },
          { type: "component", component: "language-switcher" },
        ],
      }),
    ).toBeNull();
  });

  it("accepts an empty array (user wants no items)", () => {
    expect(validatePreset({ headerRightItems: [] })).toBeNull();
  });

  it("accepts the field being omitted entirely", () => {
    expect(validatePreset({})).toBeNull();
  });

  it("rejects non-array values", () => {
    expect(validatePreset({ headerRightItems: "nope" })).toMatch(
      /headerRightItems.*must be an array/,
    );
  });

  it("rejects an unknown component name", () => {
    expect(
      validatePreset({
        headerRightItems: [{ type: "component", component: "not-a-real-thing" }],
      }),
    ).toMatch(/unknown component "not-a-real-thing"/);
  });

  it("rejects an unknown trigger name", () => {
    expect(
      validatePreset({
        headerRightItems: [{ type: "trigger", trigger: "imaginary-trigger" }],
      }),
    ).toMatch(/unknown trigger "imaginary-trigger"/);
  });

  it("rejects link items in v1 of preset support", () => {
    expect(
      validatePreset({
        headerRightItems: [
          {
            type: "link",
            href: "https://example.com",
            label: "Custom",
          },
        ],
      }),
    ).toMatch(/type "link" is not supported in presets/);
  });

  it("rejects html items in v1 of preset support", () => {
    expect(
      validatePreset({
        headerRightItems: [{ type: "html", html: "<span>x</span>" }],
      }),
    ).toMatch(/type "html" is not supported in presets/);
  });

  it("rejects items missing a discriminating type field", () => {
    expect(
      validatePreset({
        headerRightItems: [{ component: "theme-toggle" }],
      }),
    ).toMatch(/must have type "component" or "trigger"/);
  });

  it("rejects items where component is not a string", () => {
    expect(
      validatePreset({
        headerRightItems: [{ type: "component", component: 42 }],
      }),
    ).toMatch(/component must be a string/);
  });

  it("rejects items where trigger is not a string", () => {
    expect(
      validatePreset({
        headerRightItems: [{ type: "trigger", trigger: 42 }],
      }),
    ).toMatch(/trigger must be a string/);
  });

  it("rejects non-object items", () => {
    expect(
      validatePreset({ headerRightItems: ["theme-toggle"] }),
    ).toMatch(/must be an object/);
  });
});

describe("presetToChoices — headerRightItems (sub #440)", () => {
  it("forwards a valid headerRightItems array", () => {
    const items = [
      { type: "component" as const, component: "theme-toggle" as const },
      { type: "trigger" as const, trigger: "design-token-panel" as const },
    ];
    const choices = presetToChoices({ headerRightItems: items });
    expect(choices.headerRightItems).toEqual(items);
  });

  it("leaves headerRightItems undefined when omitted", () => {
    const choices = presetToChoices({});
    expect(choices.headerRightItems).toBeUndefined();
  });

  it("forwards an empty array as-is", () => {
    const choices = presetToChoices({ headerRightItems: [] });
    expect(choices.headerRightItems).toEqual([]);
  });
});

describe("validatePreset — projectName (F4 #2013)", () => {
  it("accepts a valid lowercase kebab name", () => {
    expect(validatePreset({ projectName: "my-docs" })).toBeNull();
  });

  it("accepts name starting with a digit", () => {
    expect(validatePreset({ projectName: "1my-docs" })).toBeNull();
  });

  it("accepts name with dots and underscores", () => {
    expect(validatePreset({ projectName: "my.docs_v2" })).toBeNull();
  });

  it("accepts preset with no projectName (omitted = fill later by prompts)", () => {
    expect(validatePreset({})).toBeNull();
  });

  it("rejects a name with uppercase letters", () => {
    expect(validatePreset({ projectName: "My-Docs" })).toMatch(/Invalid projectName/);
  });

  it("rejects a name with spaces", () => {
    expect(validatePreset({ projectName: "my docs" })).toMatch(/Invalid projectName/);
  });

  it("rejects a name starting with a hyphen", () => {
    expect(validatePreset({ projectName: "-my-docs" })).toMatch(/Invalid projectName/);
  });

  it("rejects a name with a slash (path-like)", () => {
    expect(validatePreset({ projectName: "my/docs" })).toMatch(/Invalid projectName/);
  });

  it("rejects a name longer than 214 characters", () => {
    expect(validatePreset({ projectName: "a".repeat(215) })).toMatch(/Invalid projectName/);
  });

  it("accepts a name exactly 214 characters long", () => {
    expect(validatePreset({ projectName: "a".repeat(214) })).toBeNull();
  });

  // Codex review finding: RegExp.test coerces non-strings (123 → "123",
  // true → "true"), which would pass the grammar and crash later at
  // path.resolve/scaffold. The type guard must fire first.
  it("rejects a numeric projectName (non-string JSON value)", () => {
    expect(validatePreset({ projectName: 123 })).toMatch(/must be a string/);
  });

  it("rejects a boolean projectName (non-string JSON value)", () => {
    expect(validatePreset({ projectName: true })).toMatch(/must be a string/);
  });

  it("rejects a null projectName (non-string JSON value)", () => {
    expect(validatePreset({ projectName: null })).toMatch(/must be a string/);
  });
});

describe("validatePreset — metaTags (S5 #2079)", () => {
  it("accepts absent metaTags", () => {
    expect(validatePreset({})).toBeNull();
  });

  it("accepts a minimal valid metaTags object", () => {
    expect(validatePreset({ metaTags: { description: true } })).toBeNull();
  });

  it("accepts a full valid metaTags object", () => {
    expect(
      validatePreset({
        metaTags: {
          description: true,
          keywords: "docs, guide",
          ogImage: "/img/ogp.png",
          ogSiteName: true,
          twitterCard: "summary_large_image",
          twitterSite: "@brand",
          twitterCreator: "@author",
        },
      }),
    ).toBeNull();
  });

  it("accepts metaTags with false values", () => {
    expect(
      validatePreset({
        metaTags: { keywords: false, ogImage: false, twitterCard: false },
      }),
    ).toBeNull();
  });

  it("rejects metaTags as a non-object", () => {
    expect(validatePreset({ metaTags: "yes" })).toMatch(/"metaTags" must be an object/);
  });

  it("rejects metaTags.description as non-boolean", () => {
    expect(validatePreset({ metaTags: { description: "yes" } })).toMatch(
      /"metaTags.description" must be a boolean/,
    );
  });

  it("rejects metaTags.keywords as a non-string/non-false value", () => {
    expect(validatePreset({ metaTags: { keywords: 42 } })).toMatch(
      /"metaTags.keywords" must be a string or false/,
    );
  });

  it("rejects metaTags.ogImage as a non-string/non-false value", () => {
    expect(validatePreset({ metaTags: { ogImage: 42 } })).toMatch(
      /"metaTags.ogImage" must be a string or false/,
    );
  });

  it("rejects metaTags.ogSiteName as non-boolean", () => {
    expect(validatePreset({ metaTags: { ogSiteName: "yes" } })).toMatch(
      /"metaTags.ogSiteName" must be a boolean/,
    );
  });

  it("rejects metaTags.twitterCard with an invalid enum value", () => {
    expect(validatePreset({ metaTags: { twitterCard: "player" } })).toMatch(
      /"metaTags.twitterCard" must be "summary", "summary_large_image", or false/,
    );
  });

  it("rejects metaTags.twitterSite as non-string", () => {
    expect(validatePreset({ metaTags: { twitterSite: 42 } })).toMatch(
      /"metaTags.twitterSite" must be a string/,
    );
  });

  it("rejects metaTags.twitterCreator as non-string", () => {
    expect(validatePreset({ metaTags: { twitterCreator: 42 } })).toMatch(
      /"metaTags.twitterCreator" must be a string/,
    );
  });
});

describe("presetToChoices — metaTags (S5 #2079)", () => {
  it("forwards metaTags when present", () => {
    const mt = { description: false, twitterCard: "summary" as const };
    const choices = presetToChoices({ metaTags: mt });
    expect(choices.metaTags).toEqual(mt);
  });

  it("leaves metaTags undefined when omitted", () => {
    const choices = presetToChoices({});
    expect(choices.metaTags).toBeUndefined();
  });

  it("forwards a full metaTags config", () => {
    const mt = {
      description: true,
      keywords: "a, b",
      ogImage: "/img/og.png",
      ogSiteName: false,
      twitterCard: "summary_large_image" as const,
      twitterSite: "@x",
      twitterCreator: "@y",
    };
    const choices = presetToChoices({ metaTags: mt });
    expect(choices.metaTags).toEqual(mt);
  });
});
