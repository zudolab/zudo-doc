/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { NoteTrayIndex } from "../note-tray-index.js";
import { serialize } from "./helpers.js";
import { base, item } from "./note-tray-test-helpers.js";

describe("NoteTrayIndex timeline style", () => {
  it.each([
    ["en", "2026 August"],
    ["ja", "2026年8月"],
  ])("renders localized timeline month headers in %s", (locale, label) => {
    const html = serialize(
      NoteTrayIndex({
        ...base,
        locale,
        style: "timeline",
        items: [item("dated", { date: "2026-08-22" })],
      }),
    );
    expect(html).toContain(label);
    expect(html).toContain(locale === "ja" ? "2026年8月22日" : "Aug 22, 2026");
    expect(html.indexOf("dated")).toBeLessThan(html.indexOf("About dated"));
  });

  it("honors descending group and rank order", () => {
    const html = serialize(
      NoteTrayIndex({
        ...base,
        style: "timeline",
        order: "desc",
        items: [
          item("older-low", { date: "2026-07-01", rank: 1 }),
          item("new-low", { date: "2026-08-01", rank: 2 }),
          item("new-high", { date: "2026-08-02", rank: 3 }),
        ],
      }),
    );
    expect(html.indexOf("2026 August")).toBeLessThan(html.indexOf("2026 July"));
    expect(html.indexOf("new-high")).toBeLessThan(html.indexOf("new-low"));
  });

  it("throws clearly when timeline is used on a non-dated tray", () => {
    expect(() =>
      NoteTrayIndex({ ...base, dated: false, style: "timeline", items: [item("one")] }),
    ).toThrow(/requires a dated note tray/);
  });
});
