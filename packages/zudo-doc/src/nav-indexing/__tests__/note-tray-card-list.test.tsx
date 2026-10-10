/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
import { describe, expect, it } from "vitest";
import { NoteTrayIndex } from "../note-tray-index.js";
import { hasClass, renderNav } from "./helpers.js";
import { base, item } from "./note-tray-test-helpers.js";

describe("NoteTrayIndex card style", () => {
  it("renders cards with h2 links, excerpts, tags, and showDate-gated dates", () => {
    const tagged = item("card", {
      date: "2026-08-22",
      tagLinks: [{ tag: "preact", href: "/docs/tags/preact" }],
    });
    const shown = renderNav(NoteTrayIndex({ ...base, style: "cards", showDate: true, items: [tagged] }));
    const hidden = renderNav(NoteTrayIndex({ ...base, style: "cards", items: [tagged] }));
    const card = shown.querySelector('a[href="/docs/card"]');
    expect(card?.querySelector("h2")).not.toBeNull();
    expect(shown.textContent).toContain("About card");
    expect(shown.querySelector('a[href="/docs/tags/preact"]')?.textContent).toContain("#preact");
    expect(shown.textContent).toContain("Aug 22, 2026");
    expect(shown.querySelector("time")?.textContent).toContain("Aug 22");
    expect(hidden.textContent).not.toContain("Aug 22, 2026");
    expect(card?.classList.contains("grid-rows-subgrid")).toBe(true);
    expect(card?.classList.contains("border-muted")).toBe(true);
    expect(hasClass(shown, "zd-card-links-interactive")).toBe(true);
    expect(hasClass(shown, "ml-[calc(var(--spacing-hsp-xl)_+_1px)]")).toBe(true);
    expect(hasClass(shown, "mr-[calc(var(--spacing-hsp-xl)_+_1px)]")).toBe(true);
    const tagLink = shown.querySelector('a[href="/docs/tags/preact"]');
    expect(card).not.toBeNull();
    expect(tagLink).not.toBeNull();
    expect(card!.compareDocumentPosition(tagLink!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("does not create subgrid rows when the item has no tags", () => {
    const root = renderNav(NoteTrayIndex({
      ...base,
      style: "cards",
      showDate: true,
      items: [item("plain", { date: "2026-08-22" })],
    }));
    expect(hasClass(root, "grid-rows-subgrid")).toBe(false);
    expect(root.textContent).toContain("Aug 22, 2026");
  });

  it("renders updated dates in narrow and wide representations", () => {
    const root = renderNav(NoteTrayIndex({
      ...base,
      style: "cards",
      showDate: true,
      items: [item("updated", { date: "2026-08-22", updated: "2026-08-23" })],
    }));
    expect(root.textContent).toContain("Updated Aug 23");
    expect(root.querySelector('time[datetime="2026-08-23"]')).not.toBeNull();
  });

  it("shows an updated-only DateLine at all widths without a date stamp", () => {
    const root = renderNav(NoteTrayIndex({
      ...base,
      style: "cards",
      showDate: true,
      items: [item("updated-only", { updated: "2026-08-23" })],
    }));
    expect(root.textContent).toContain("Updated Aug 23");
    expect(root.querySelector('time[datetime="2026-08-23"]')?.parentElement?.classList.contains("sm:hidden")).toBe(false);
    expect(root.querySelector("time")?.parentElement?.classList.contains("hidden")).toBe(false);
  });

  it("renders a non-link frame without link interaction styles", () => {
    const root = renderNav(NoteTrayIndex({
      ...base,
      style: "cards",
      items: [item("heading", {
        href: undefined,
        tagLinks: [{ tag: "preact", href: "/docs/tags/preact" }],
      })],
    }));
    expect(root.querySelector("h2")).not.toBeNull();
    expect(root.querySelector('a[href="/docs/tags/preact"]')).not.toBeNull();
    expect(root.querySelector('a[href="/docs/heading"]')).toBeNull();
    expect(hasClass(root, "hover:border-accent")).toBe(false);
    expect(hasClass(root, "group-hover:text-accent")).toBe(false);
  });

  it("applies the monthDay, year, and full role patterns from dateFormats", () => {
    const root = renderNav(NoteTrayIndex({
      ...base,
      style: "cards",
      showDate: true,
      items: [item("card", { date: "2026-08-22", updated: "2026-08-23" })],
      dateFormats: {
        full: "YYYY/MM/DD",
        monthDay: "MM-DD",
        year: "[FY]YYYY",
        yearMonth: "locale",
        numericMonthDay: "locale",
      },
    }));
    expect(Array.from(root.querySelectorAll(".text-title")).some((node) => node.textContent === "08-22")).toBe(true);
    expect(Array.from(root.querySelectorAll(".text-caption")).some((node) => node.textContent === "FY2026")).toBe(true);
    expect(root.textContent).toContain("Updated 08-23");
    expect(root.textContent).not.toContain("Aug 22");
    expect(root.textContent).toContain("2026/08/22");
    expect(root.textContent).not.toContain("Aug 22, 2026");
    expect(root.querySelector('time[datetime="2026-08-22"]')).not.toBeNull();
    expect(root.querySelector('time[datetime="2026-08-23"]')).not.toBeNull();
  });

  it("resolves distinct dateFormats patterns per locale", () => {
    const tagged = item("card", { date: "2026-08-22" });
    const en = renderNav(NoteTrayIndex({
      ...base,
      locale: "en",
      style: "cards",
      showDate: true,
      items: [tagged],
      dateFormats: { full: "locale", monthDay: "MM/DD", year: "locale", yearMonth: "locale", numericMonthDay: "locale" },
    }));
    const ja = renderNav(NoteTrayIndex({
      ...base,
      locale: "ja",
      style: "cards",
      showDate: true,
      items: [tagged],
      dateFormats: { full: "locale", monthDay: "M-D", year: "locale", yearMonth: "locale", numericMonthDay: "locale" },
    }));
    expect(Array.from(en.querySelectorAll(".text-title")).some((node) => node.textContent === "08/22")).toBe(true);
    expect(Array.from(ja.querySelectorAll(".text-title")).some((node) => node.textContent === "8-22")).toBe(true);
    expect(Array.from(ja.querySelectorAll(".text-title")).some((node) => node.textContent === "08/22")).toBe(false);
  });

  it("keeps the linked title's static color on text-fg with no bare text-accent or underline token", () => {
    const root = renderNav(NoteTrayIndex({ ...base, style: "cards", items: [item("card")] }));
    expect(hasClass(root, "text-fg")).toBe(true);
    expect(hasClass(root, "text-accent")).toBe(false);
    expect(hasClass(root, "underline")).toBe(false);
    expect(hasClass(root, "group-hover:text-accent")).toBe(true);
    expect(hasClass(root, "group-hover:underline")).toBe(true);
  });
});
