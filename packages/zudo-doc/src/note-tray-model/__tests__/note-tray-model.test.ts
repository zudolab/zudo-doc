import { describe, expect, it } from "vitest";
import {
  findContainingNoteTray,
  findNoteTray,
  formatDate,
  formatYearLabel,
  formatYearMonthLabel,
  getNoteTrayItems,
  groupItems,
  parseIsoDate,
  rankWidth,
  yearKey,
  yearMonthKey,
  type NoteTrayNode,
} from "../index.js";

const items: NoteTrayNode[] = [
  { slug: "notes/one", rank: 1, date: "2025-12-10", children: [] },
  { slug: "notes/two", rank: 2, date: "2026-08-20", children: [] },
  { slug: "notes/three", rank: 3, date: "2026-08-21", children: [] },
];
const tray: NoteTrayNode = {
  slug: "notes",
  shape: "note-tray",
  sortOrder: "asc",
  children: items,
};

describe("note-tray-model", () => {
  it("looks up trays, containing trays, and routed items", () => {
    expect(findNoteTray([tray], "notes")).toBe(tray);
    expect(findContainingNoteTray([tray], "notes/two")).toBe(tray);
    expect(getNoteTrayItems(tray)).toEqual(items);
  });

  it("computes the zero-padding width", () => {
    expect(rankWidth(0)).toBe(2);
    expect(rankWidth(new Array(9))).toBe(2);
    expect(rankWidth(100)).toBe(3);
  });

  it("parses strict calendar-valid ISO dates without local-time shifts", () => {
    expect(parseIsoDate("2026-08-22")).toEqual({ year: 2026, month: 8, day: 22 });
    expect(parseIsoDate("2026-02-31")).toBeUndefined();
    expect(parseIsoDate("2026-8-22")).toBeUndefined();
    expect(yearKey("2026-08-22")).toBe("2026");
    expect(yearMonthKey("2026-08-22")).toBe("2026-08");
  });

  it("formats UTC dates and year-month labels", () => {
    expect(formatDate("2026-08-22", "en")).toBe("Aug 22, 2026");
    expect(formatYearMonthLabel("2026-08", "en")).toBe("2026 August");
    expect(formatYearMonthLabel("2026-08", "ja")).toBe("2026年8月");
  });

  it("forwards an optional date-format pattern to the shared formatter", () => {
    expect(formatYearMonthLabel("2026-08", "en", "locale")).toBe("2026 August");
    expect(formatYearMonthLabel("2026-08", "en", "YYYY/MM")).toBe("2026/08");
    expect(formatYearMonthLabel("2026-08", "ja", "YYYY年M月")).toBe("2026年8月");
  });

  it("returns a year-group key verbatim unless a pattern opts in", () => {
    // The default must stay the bare key in every locale — an Intl year would
    // render "2026年" in JA and change today's headings (#4078).
    expect(formatYearLabel("2026", "en")).toBe("2026");
    expect(formatYearLabel("2026", "ja")).toBe("2026");
    expect(formatYearLabel("2026", "ja", "locale")).toBe("2026");
  });

  it("applies a year pattern against January 1 of the year key", () => {
    expect(formatYearLabel("2026", "en", "[FY]YYYY")).toBe("FY2026");
    expect(formatYearLabel("2026", "en", "YY")).toBe("26");
    expect(formatYearLabel("2026", "en", "YYYY-MM-DD")).toBe("2026-01-01");
    // A full ISO date passes straight through to the shared formatter.
    expect(formatYearLabel("2026-08-22", "en", "[FY]YYYY")).toBe("FY2026");
    expect(formatYearLabel("not-a-year", "en", "[FY]YYYY")).toBe("not-a-year");
  });

  it("orders groups chronologically and items by rank in the tray direction", () => {
    expect(groupItems(items, "month", "asc").map((g) => [g.key, g.items.map((i) => i.rank)])).toEqual([
      ["2025-12", [1]],
      ["2026-08", [2, 3]],
    ]);
    expect(groupItems(items, "month", "desc").map((g) => [g.key, g.items.map((i) => i.rank)])).toEqual([
      ["2026-08", [3, 2]],
      ["2025-12", [1]],
    ]);
  });
});
