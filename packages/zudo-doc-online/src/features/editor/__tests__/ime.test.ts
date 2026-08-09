import { describe, expect, it } from "vitest";
import { isImeKeyEvent } from "../ime";

describe("isImeKeyEvent", () => {
  it("is true when the component's own composition flag is up", () => {
    expect(isImeKeyEvent({ isComposing: false, keyCode: 13 }, true)).toBe(true);
  });

  it("is true on the standard isComposing property", () => {
    expect(isImeKeyEvent({ isComposing: true, keyCode: 13 }, false)).toBe(true);
  });

  it("is true on the legacy keyCode 229 sentinel alone", () => {
    // The case that makes the guard a TRIPLE one: some IME/browser pairs
    // report neither a composition event nor `isComposing` on keydown.
    expect(isImeKeyEvent({ keyCode: 229 }, false)).toBe(true);
  });

  it("is false for an ordinary key press", () => {
    expect(isImeKeyEvent({ isComposing: false, keyCode: 13 }, false)).toBe(false);
    expect(isImeKeyEvent({}, false)).toBe(false);
  });
});
