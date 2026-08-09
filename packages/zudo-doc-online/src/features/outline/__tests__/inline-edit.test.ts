import { describe, expect, it } from "vitest";
import {
  IME_KEY_CODE,
  inlineEditIntent,
  isCompositionKey,
  isUnchangedValue,
  normalizeInlineValue,
} from "../inline-edit.js";

describe("isCompositionKey", () => {
  it("is false for a plain keystroke with no composition signal", () => {
    expect(isCompositionKey({ key: "Enter" }, false)).toBe(false);
  });

  it("is true from our own compositionstart flag alone", () => {
    // Safari has fired compositionend before the keydown that ended the
    // composition; the other two signals are what cover that case, and this
    // one covers engines where they are absent.
    expect(isCompositionKey({ key: "Enter" }, true)).toBe(true);
  });

  it("is true from the standard isComposing property alone", () => {
    expect(isCompositionKey({ key: "Enter", isComposing: true }, false)).toBe(true);
  });

  it("is true from the legacy keyCode 229 sentinel alone", () => {
    expect(isCompositionKey({ key: "Enter", keyCode: IME_KEY_CODE }, false)).toBe(
      true,
    );
  });

  it("ignores a keyCode that is not the IME sentinel", () => {
    expect(isCompositionKey({ key: "Enter", keyCode: 13 }, false)).toBe(false);
  });
});

describe("inlineEditIntent", () => {
  it("commits on Enter and cancels on Escape", () => {
    expect(inlineEditIntent({ key: "Enter" }, false)).toBe("commit");
    expect(inlineEditIntent({ key: "Escape" }, false)).toBe("cancel");
  });

  it("ignores every other key", () => {
    expect(inlineEditIntent({ key: "a" }, false)).toBe("none");
    expect(inlineEditIntent({ key: "Tab" }, false)).toBe("none");
  });

  it("never commits or cancels while an input method owns the keystroke", () => {
    for (const guard of [
      { event: { key: "Enter" }, composing: true },
      { event: { key: "Enter", isComposing: true }, composing: false },
      { event: { key: "Enter", keyCode: IME_KEY_CODE }, composing: false },
      { event: { key: "Escape" }, composing: true },
      { event: { key: "Escape", isComposing: true }, composing: false },
      { event: { key: "Escape", keyCode: IME_KEY_CODE }, composing: false },
    ]) {
      expect(inlineEditIntent(guard.event, guard.composing)).toBe("none");
    }
  });
});

describe("normalizeInlineValue", () => {
  it("trims a usable value", () => {
    expect(normalizeInlineValue("  Getting started  ")).toBe("Getting started");
  });

  it("returns null for a field holding only whitespace", () => {
    expect(normalizeInlineValue("   ")).toBeNull();
    expect(normalizeInlineValue("")).toBeNull();
  });
});

describe("isUnchangedValue", () => {
  it("compares trimmed", () => {
    expect(isUnchangedValue("  Guides ", "Guides")).toBe(true);
    expect(isUnchangedValue("Guides!", "Guides")).toBe(false);
  });
});
