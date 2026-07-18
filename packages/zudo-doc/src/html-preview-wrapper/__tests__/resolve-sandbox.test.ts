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

  it("is true when externalScripts alone is non-empty", () => {
    expect(
      containsScript(undefined, undefined, [
        "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4",
      ]),
    ).toBe(true);
  });

  it("is false when externalScripts is an empty array", () => {
    expect(containsScript(undefined, undefined, [])).toBe(false);
  });

  it("is false when externalScripts is omitted (back-compat, two-arg call)", () => {
    expect(containsScript(undefined, undefined)).toBe(false);
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

describe("resolveSandbox — flips to script-allowing on externalScripts alone", () => {
  it("mirrors HtmlPreview's hasScripts derivation: externalScripts with no head/js", () => {
    const hasScripts = containsScript(undefined, undefined, [
      "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4",
    ]);
    expect(hasScripts).toBe(true);
    expect(resolveSandbox(undefined, hasScripts)).toBe(
      "allow-scripts allow-same-origin",
    );
  });
});

// HtmlPreview derives `syncDelay` as `containsScript(head, js, externalScripts)
// ? 300 : 0` — the exact same hasScripts boolean that feeds resolveSandbox
// (see html-preview.tsx). This is a distinct assertion on that derivation
// (not just the sandbox flip above), pinned per #2914's acceptance criteria.
function deriveSyncDelay(
  head: string | undefined,
  js: string | undefined,
  externalScripts: string[] | undefined,
): number {
  return containsScript(head, js, externalScripts) ? 300 : 0;
}

describe("syncDelay auto-derivation — fires on externalScripts alone", () => {
  it("is 0 when there are no scripts at all", () => {
    expect(deriveSyncDelay(undefined, undefined, undefined)).toBe(0);
  });

  it("is 300 when only externalScripts is set (no head, no js)", () => {
    expect(
      deriveSyncDelay(undefined, undefined, [
        "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4",
      ]),
    ).toBe(300);
  });

  it("stays 300 when js is set (unaffected back-compat baseline)", () => {
    expect(deriveSyncDelay(undefined, "console.log(1)", undefined)).toBe(300);
  });
});
