import { describe, expect, it } from "vitest";
import { getTocTitle } from "../toc-title";

describe("getTocTitle", () => {
  it("returns English label for undefined input", () => {
    expect(getTocTitle(undefined)).toBe("On this page");
  });

  it("returns English label for EN locale", () => {
    expect(getTocTitle("en")).toBe("On this page");
  });

  it("returns Japanese label for JA locale", () => {
    expect(getTocTitle("ja")).toBe("目次");
  });

  it("returns German label for DE locale", () => {
    expect(getTocTitle("de")).toBe("Auf dieser Seite");
  });

  it("handles BCP-47 full tags by checking primary subtag first", () => {
    expect(getTocTitle("en-US")).toBe("On this page");
    expect(getTocTitle("ja-JP")).toBe("目次");
    expect(getTocTitle("de-DE")).toBe("Auf dieser Seite");
  });

  it("falls back to English for unknown locales", () => {
    expect(getTocTitle("zh")).toBe("On this page");
    expect(getTocTitle("fr")).toBe("On this page");
  });

  it("falls back to English for empty string", () => {
    // Empty string: primary subtag is also empty, not in map, falls through
    expect(getTocTitle("")).toBe("On this page");
  });
});
