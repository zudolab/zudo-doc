/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
import { describe, expect, it } from "vitest";
import { NoteTrayIndex } from "../note-tray-index.js";
import { hasClass, renderNav } from "./helpers.js";
import { base, item } from "./note-tray-test-helpers.js";

describe("NoteTrayIndex index style", () => {
  it("renders zero-padded index rows, descriptions, and optional date/updated", () => {
    const root = renderNav(NoteTrayIndex({
      ...base,
      showDate: true,
      items: [item("one", { rank: 1, date: "2026-08-22", updated: "2026-08-23" })],
    }));
    expect(root.querySelector("ol.zd-list-items-no-margin > li")).not.toBeNull();
    expect(root.querySelector("li .text-heading")?.textContent).toBe("01");
    expect(root.querySelector('a[href="/docs/one"]')?.textContent).toContain("one");
    expect(root.textContent).toContain("About one");
    expect(root.textContent).toContain("Aug 22, 2026");
    expect(root.querySelector('time[datetime="2026-08-22"]')).not.toBeNull();
    expect(root.querySelector('time[datetime="2026-08-23"]')).not.toBeNull();
    expect(root.querySelector("ol")?.classList.contains("border-t")).toBe(false);
    expect(root.querySelector("li")?.classList.contains("border-y")).toBe(true);
    expect(root.querySelector("li")?.classList.contains("border-muted")).toBe(true);
    expect(hasClass(root, "leading-none")).toBe(true);
  });

  it("keeps the visible stable rank accessible and never invents rank 00", () => {
    const ranked = renderNav(NoteTrayIndex({ ...base, items: [item("sixth", { rank: 6 })] }));
    const missing = renderNav(NoteTrayIndex({ ...base, items: [item("missing", { rank: undefined })] }));
    const rank = ranked.querySelector("li .text-heading");
    expect(rank?.textContent).toBe("06");
    expect(rank?.hasAttribute("aria-hidden")).toBe(false);
    expect(missing.querySelector("li .text-heading")?.textContent).toBe("");
  });

  it("applies the full role pattern from dateFormats, keeping <time datetime> raw", () => {
    const root = renderNav(NoteTrayIndex({
      ...base,
      showDate: true,
      items: [item("one", { rank: 1, date: "2026-08-22" })],
      dateFormats: {
        full: "YYYY-MM-DD",
        monthDay: "locale",
        year: "locale",
        yearMonth: "locale",
        numericMonthDay: "locale",
      },
    }));
    expect(root.textContent).toContain("2026-08-22");
    expect(root.textContent).not.toContain("Aug 22, 2026");
    expect(root.querySelector('time[datetime="2026-08-22"]')).not.toBeNull();
  });

  it("resolves distinct full-role dateFormats patterns per locale", () => {
    const en = renderNav(NoteTrayIndex({
      ...base,
      locale: "en",
      showDate: true,
      items: [item("one", { rank: 1, date: "2026-08-22" })],
      dateFormats: { full: "MM/DD/YYYY", monthDay: "locale", year: "locale", yearMonth: "locale", numericMonthDay: "locale" },
    }));
    const ja = renderNav(NoteTrayIndex({
      ...base,
      locale: "ja",
      showDate: true,
      items: [item("one", { rank: 1, date: "2026-08-22" })],
      dateFormats: { full: "YYYY.MM.DD", monthDay: "locale", year: "locale", yearMonth: "locale", numericMonthDay: "locale" },
    }));
    expect(en.textContent).toContain("08/22/2026");
    expect(ja.textContent).toContain("2026.08.22");
    expect(ja.textContent).not.toContain("2026年8月22日");
  });

  it("keeps the linked label's static color on text-fg with no bare text-accent, underline, or decoration token", () => {
    const root = renderNav(NoteTrayIndex({ ...base, items: [item("one", { rank: 1 })] }));
    expect(hasClass(root, "text-accent")).toBe(false);
    expect(hasClass(root, "underline")).toBe(false);
    expect(Array.from(root.querySelectorAll("[class]")).some((node) => node.className.toString().includes("decoration-"))).toBe(false);
    expect(hasClass(root, "group-hover:text-accent")).toBe(true);
  });
});
