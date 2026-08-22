import { describe, expect, it } from "vitest";
import {
  findContainingNoteTray,
  findNoteTray,
  formatDate,
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
