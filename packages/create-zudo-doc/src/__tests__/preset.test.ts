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
