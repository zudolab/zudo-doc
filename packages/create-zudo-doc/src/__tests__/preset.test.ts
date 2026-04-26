import { describe, it, expect } from "vitest";
import { presetToChoices, validatePreset } from "../preset.js";

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
