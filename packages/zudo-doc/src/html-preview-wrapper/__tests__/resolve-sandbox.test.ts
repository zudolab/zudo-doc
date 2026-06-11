import { describe, expect, it } from "vitest";
import { containsScript, resolveSandbox } from "../html-preview.js";

describe("containsScript", () => {
  it("is false when neither head nor js is provided", () => {
    expect(containsScript(undefined, undefined)).toBe(false);
  });

  it("is true when a js prop is present", () => {
    expect(containsScript(undefined, "console.log(1)")).toBe(true);
  });

  it("is true when head contains a <script> tag (case-insensitive)", () => {
    expect(containsScript("<SCRIPT src='x'></SCRIPT>", undefined)).toBe(true);
  });

  it("is false when head has markup but no script tag", () => {
    expect(containsScript("<link rel='stylesheet'>", undefined)).toBe(false);
  });
});

describe("resolveSandbox — default (no explicit prop)", () => {
  it("keeps allow-same-origin only when there are no scripts", () => {
    expect(resolveSandbox(undefined, false)).toBe("allow-same-origin");
  });

  it("adds allow-scripts when scripts are present", () => {
    expect(resolveSandbox(undefined, true)).toBe(
      "allow-scripts allow-same-origin",
    );
  });
});

describe("resolveSandbox — explicit override", () => {
  it("uses the provided value verbatim when scripts are present", () => {
    expect(resolveSandbox("allow-scripts", true)).toBe("allow-scripts");
  });

  it("uses the provided value verbatim when no scripts are present", () => {
    expect(resolveSandbox("allow-forms allow-popups", false)).toBe(
      "allow-forms allow-popups",
    );
  });

  it("honors the empty string (maximally restrictive) — not nullish, no fallback", () => {
    expect(resolveSandbox("", true)).toBe("");
    expect(resolveSandbox("", false)).toBe("");
  });
});
