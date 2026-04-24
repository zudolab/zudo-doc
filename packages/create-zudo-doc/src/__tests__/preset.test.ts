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
