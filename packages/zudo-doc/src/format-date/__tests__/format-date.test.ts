import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatMonthDay,
  formatMonthDayLabel,
  formatYear,
  formatYearMonth,
} from "../index.js";

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

  it("formats localized month-day and year labels", () => {
    expect(formatMonthDayLabel("2026-03-27", "en")).toBe("Mar 27");
    expect(formatMonthDayLabel("2026-03-27", "ja")).toBe("3月27日");
    expect(formatYear("2026-03-27", "en")).toBe("2026");
    expect(formatYear("2026-03-27", "ja")).toBe("2026年");
  });

  it("formats month-day and year labels from full timestamps in UTC", () => {
    const timestamp = "2026-12-31T23:30:00-05:00";
    expect(formatMonthDayLabel(timestamp, "en")).toBe("Jan 1");
    expect(formatYear(timestamp, "en")).toBe("2027");
  });

  it("returns invalid input unchanged", () => {
    expect(formatDate("not-a-date", "en")).toBe("not-a-date");
    expect(formatYearMonth("2026-13", "en")).toBe("2026-13");
    expect(formatMonthDay("2026-02-31")).toBe("2026-02-31");
    expect(formatMonthDayLabel("not-a-date", "en")).toBe("not-a-date");
    expect(formatYear("not-a-date", "ja")).toBe("not-a-date");
  });
});
