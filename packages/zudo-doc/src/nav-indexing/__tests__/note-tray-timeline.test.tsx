/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
import { describe, expect, it } from "vitest";
import { NoteTrayIndex } from "../note-tray-index.js";
import { hasClass, renderNav } from "./helpers.js";
import { base, item } from "./note-tray-test-helpers.js";

describe("NoteTrayIndex timeline style", () => {
  it.each([
    ["en", "2026 August", "Aug 22, 2026"],
    ["ja", "2026年8月", "2026年8月22日"],
  ])("renders localized timeline month headers in %s", (locale, label, dateLabel) => {
    const root = renderNav(NoteTrayIndex({
      ...base,
      locale,
      style: "timeline",
      items: [item("dated", { date: "2026-08-22", updated: "2026-08-23" })],
    }));
    expect(root.querySelector("h2")?.textContent).toBe(label);
    expect(root.querySelector("time[datetime]")?.textContent).toContain("22");
    expect(root.textContent).toContain(dateLabel);
    expect(root.textContent).not.toContain("Updated");
    expect(root.querySelector('a[href="/docs/dated"]')?.textContent).toBe("dated");
    expect(root.textContent).toContain("About dated");
  });

  it("honors descending group and rank order", () => {
    const root = renderNav(NoteTrayIndex({
      ...base,
      style: "timeline",
      order: "desc",
      items: [
        item("older-low", { date: "2026-07-01", rank: 1 }),
        item("new-low", { date: "2026-08-01", rank: 2 }),
        item("new-high", { date: "2026-08-02", rank: 3 }),
      ],
    }));
    const months = Array.from(root.querySelectorAll("h2")).map((heading) => heading.textContent);
    expect(months).toEqual(["2026 August", "2026 July"]);
    const links = Array.from(root.querySelectorAll("a[href^='/docs/']")).map((link) => link.textContent);
    expect(links.slice(0, 2)).toEqual(["new-high", "new-low"]);
  });

  it("throws clearly when timeline is used on a non-dated tray", () => {
    expect(() => NoteTrayIndex({ ...base, dated: false, style: "timeline", items: [item("one")] }))
      .toThrow(/requires a dated note tray/);
  });

  it("applies the yearMonth and full role patterns from dateFormats", () => {
    const root = renderNav(NoteTrayIndex({
      ...base,
      style: "timeline",
      items: [item("dated", { date: "2026-08-22" })],
      dateFormats: {
        full: "YYYY.MM.DD",
        monthDay: "locale",
        year: "locale",
        yearMonth: "MMM YYYY",
        numericMonthDay: "locale",
      },
    }));
    expect(root.querySelector("h2")?.textContent).toBe("Aug 2026");
    expect(hasClass(root, "leading-none")).toBe(true);
    expect(root.querySelector("h2")?.textContent).not.toBe("2026 August");
    expect(root.querySelector("time .sr-only")?.textContent).toBe("2026.08.22");
    expect(root.textContent).not.toContain("Aug 22, 2026");
    expect(root.querySelector('time[datetime="2026-08-22"]')).not.toBeNull();
  });

  it("resolves distinct dateFormats patterns per locale", () => {
    const en = renderNav(NoteTrayIndex({
      ...base,
      locale: "en",
      style: "timeline",
      items: [item("dated", { date: "2026-08-22" })],
      dateFormats: { full: "locale", monthDay: "locale", year: "locale", yearMonth: "MMM YYYY", numericMonthDay: "locale" },
    }));
    const ja = renderNav(NoteTrayIndex({
      ...base,
      locale: "ja",
      style: "timeline",
      items: [item("dated", { date: "2026-08-22" })],
      dateFormats: { full: "locale", monthDay: "locale", year: "locale", yearMonth: "YYYY年M月度", numericMonthDay: "locale" },
    }));
    expect(en.querySelector("h2")?.textContent).toBe("Aug 2026");
    expect(ja.querySelector("h2")?.textContent).toBe("2026年8月度");
  });

  it("keeps the linked item's static color on text-fg with no bare text-accent, underline, or decoration token", () => {
    const root = renderNav(NoteTrayIndex({ ...base, style: "timeline", items: [item("dated", { date: "2026-08-22" })] }));
    expect(hasClass(root, "text-accent")).toBe(false);
    expect(hasClass(root, "underline")).toBe(false);
    expect(Array.from(root.querySelectorAll("[class]"))
      .some((node) => (node.getAttribute("class") ?? "").split(/\s+/).some((name) => name.startsWith("decoration-"))))
      .toBe(false);
    expect(hasClass(root, "hover:text-accent")).toBe(true);
    expect(hasClass(root, "hover:underline")).toBe(true);
  });
});
