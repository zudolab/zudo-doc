import { describe, expect, it } from "vitest";
import { formatDate, formatMonthDay, formatYearMonth } from "../index.js";

describe("format-date", () => {
  it("formats date-only values in UTC with the established locale mapping", () => {
    expect(formatDate("2026-08-22", "en")).toBe("Aug 22, 2026");
    expect(formatDate("2026-08-22", "ja")).toBe("2026年8月22日");
  });

  it("formats full git-history timestamps in UTC", () => {
    expect(formatDate("2026-08-22T23:30:00-05:00", "en")).toBe("Aug 23, 2026");
  });

  it("formats year-month and month-day labels", () => {
    expect(formatYearMonth("2026-08-22", "en")).toBe("2026 August");
    expect(formatYearMonth("2026-08-22", "ja")).toBe("2026年8月");
    expect(formatMonthDay("2026-08-22")).toBe("08-22");
  });

  it("returns invalid input unchanged", () => {
    expect(formatDate("not-a-date", "en")).toBe("not-a-date");
    expect(formatYearMonth("2026-13", "en")).toBe("2026-13");
    expect(formatMonthDay("2026-02-31")).toBe("2026-02-31");
  });
});
