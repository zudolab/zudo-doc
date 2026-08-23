import { test, expect } from "@playwright/test";
import { makeDistReader } from "./dist-helper";

const { readDistFile } = makeDistReader("sidebar");

test.describe("Sidebar note trays: static dist", () => {
  test("the index tray exposes zero-padded stable ranks for all five items", () => {
    const html = readDistFile("docs/notes/index.html");

    expect(html).toMatch(/<li\b[^>]*border-y border-muted[^>]*>/);
    for (const rank of ["01", "02", "03", "04", "05"]) {
      expect(html).toMatch(
        new RegExp(`<span\\b(?![^>]*aria-hidden)(?=[^>]*tabular-nums)[^>]*>${rank}</span>`),
      );
    }
    expect(html).toContain("First Note");
    expect(html).toContain("Fifth Note");
  });

  test("the three NoteTrayIndex styles render their distinct static shapes", () => {
    const indexHtml = readDistFile("docs/notes/index.html");
    const timelineHtml = readDistFile("docs/journal/index.html");
    const cardsHtml = readDistFile("docs/series-year/index.html");

    expect(indexHtml).toMatch(/<li\b[^>]*border-y border-muted[^>]*>/);
    expect(timelineHtml).toMatch(/class=(?:"space-y-vsp-lg"|space-y-vsp-lg)/);
    expect(timelineHtml).toContain("2026 August");
    expect(timelineHtml).toContain("2026 July");
    expect(timelineHtml).toContain("2026 June");
    expect(cardsHtml).toContain('class="grid grid-cols-1 gap-vsp-md"');
    expect(cardsHtml).toContain("Series Early");
    expect(cardsHtml).toContain("Nov 1, 2025");
    expect(cardsHtml).toContain("Series Current");
    expect(cardsHtml).toContain("Mar 22, 2026");
  });

  test("the home page contains blocks for all three trays", () => {
    const html = readDistFile("index.html");

    expect(html).toContain("data-site-nav");
    expect(html).toContain("Notes");
    expect(html).toContain("Journal");
    expect(html).toContain("Series by Year");
    expect(html).toContain('data-note-tray-row');
    expect(html).toMatch(/data-note-tray-group=(?:"2026-08"|2026-08)\b/);
    expect(html).toMatch(/data-note-tray-group=(?:"2026"|2026)\b/);
  });

  test("updated authored dates stay on the data-doc-date line", () => {
    const html = readDistFile("docs/journal/journal-middle/index.html");

    expect(html).toContain("data-doc-date");
    expect(html).toContain("Aug 10, 2026 · Updated Aug 21, 2026");
  });
});
