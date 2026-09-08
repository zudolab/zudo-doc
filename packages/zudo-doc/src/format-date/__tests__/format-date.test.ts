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

describe("format-date token patterns", () => {
  const iso = "2026-08-05";

  it("keeps the Intl path bit-for-bit when the pattern is absent or \"locale\"", () => {
    expect(formatDate(iso, "en", "locale")).toBe(formatDate(iso, "en"));
    expect(formatDate(iso, "ja", "locale")).toBe(formatDate(iso, "ja"));
    expect(formatMonthDayLabel(iso, "ja", "locale")).toBe(formatMonthDayLabel(iso, "ja"));
    expect(formatYear(iso, "ja", "locale")).toBe(formatYear(iso, "ja"));
    expect(formatYearMonth(iso, "ja", "locale")).toBe(formatYearMonth(iso, "ja"));
    expect(formatMonthDay(iso, "locale")).toBe(formatMonthDay(iso));
  });

  it("renders each token individually", () => {
    expect(formatDate(iso, "en", "YYYY")).toBe("2026");
    expect(formatDate(iso, "en", "YY")).toBe("26");
    expect(formatDate(iso, "en", "MMMM")).toBe("August");
    expect(formatDate(iso, "en", "MMM")).toBe("Aug");
    expect(formatDate(iso, "en", "MM")).toBe("08");
    expect(formatDate(iso, "en", "M")).toBe("8");
    expect(formatDate(iso, "en", "DD")).toBe("05");
    expect(formatDate(iso, "en", "D")).toBe("5");
  });

  it("matches the longest token first", () => {
    expect(formatDate(iso, "en", "YYYY|YY")).toBe("2026|26");
    expect(formatDate(iso, "en", "MMMM|MMM|MM|M")).toBe("August|Aug|08|8");
    expect(formatDate(iso, "en", "DD|D")).toBe("05|5");
  });

  it("escapes bracketed literals, including empty, nested, and unmatched brackets", () => {
    expect(formatDate(iso, "en", "[at] YYYY")).toBe("at 2026");
    expect(formatDate(iso, "en", "[YYYY]")).toBe("YYYY");
    expect(formatDate(iso, "en", "[]YYYY[]")).toBe("2026");
    // Brackets do not nest: the first "]" closes, the trailing "]" is literal.
    expect(formatDate(iso, "en", "[[YYYY]]")).toBe("[YYYY]");
    // An unmatched "[" is literal and scanning continues, so YYYY still resolves.
    expect(formatDate(iso, "en", "[YYYY")).toBe("[2026");
    expect(formatDate(iso, "en", "YYYY]")).toBe("2026]");
  });

  it("renders an empty pattern as an empty string", () => {
    expect(formatDate(iso, "en", "")).toBe("");
  });

  it("renders repeated tokens independently", () => {
    expect(formatDate(iso, "en", "YYYY-YYYY")).toBe("2026-2026");
    expect(formatDate(iso, "en", "MMM MMM DD DD")).toBe("Aug Aug 05 05");
  });

  it("degrades predictably on unsupported sequences", () => {
    // YYYY consumes four Y's; the fifth has no token and passes through.
    expect(formatDate(iso, "en", "YYYYY")).toBe("2026Y");
    expect(formatDate(iso, "en", "MMMMM")).toBe("August8");
    // Lowercase day-of-week tokens are not in the vocabulary.
    expect(formatDate(iso, "en", "dddd")).toBe("dddd");
    expect(formatDate(iso, "en", "HH:mm")).toBe("HH:mm");
  });

  it("never reprocesses letters inside a substituted month name", () => {
    // "March" and "May" both contain M; "December" contains D.
    expect(formatDate("2026-03-05", "en", "MMMM")).toBe("March");
    expect(formatDate("2026-05-05", "en", "MMMM")).toBe("May");
    expect(formatDate("2026-12-05", "en", "MMMM")).toBe("December");
    expect(formatDate("2026-03-05", "en", "MMMM D")).toBe("March 5");
  });

  it("passes non-token characters through literally", () => {
    expect(formatDate(iso, "en", "YYYY/MM/DD")).toBe("2026/08/05");
    expect(formatDate(iso, "en", "YYYY-MM-DD")).toBe("2026-08-05");
    expect(formatDate(iso, "en", "YYYY.MM.DD")).toBe("2026.08.05");
    expect(formatDate(iso, "ja", "YYYY年M月D日")).toBe("2026年8月5日");
  });

  it("resolves month names through the established locale map", () => {
    expect(formatDate(iso, "ja", "MMMM")).toBe("8月");
    expect(formatDate(iso, "ja", "MMM")).toBe("8月");
    expect(formatDate(iso, "de", "MMMM")).toBe("August");
    // Outside the map the fallback is en-US, so month names stay English.
    expect(formatDate(iso, "fr", "MMMM")).toBe("August");
    expect(formatDate(iso, "fr", "MMM")).toBe("Aug");
  });

  it("returns invalid input unchanged even when a pattern is given", () => {
    expect(formatDate("not-a-date", "en", "YYYY")).toBe("not-a-date");
    expect(formatMonthDayLabel("not-a-date", "en", "MM-DD")).toBe("not-a-date");
    expect(formatYear("2026-13-01", "en", "YYYY")).toBe("2026-13-01");
    expect(formatYearMonth("2026-13", "en", "YYYY")).toBe("2026-13");
    expect(formatMonthDay("2026-02-31", "MM-DD")).toBe("2026-02-31");
  });

  it("resolves full git timestamps in UTC under a pattern", () => {
    expect(formatDate("2026-08-22T23:30:00-05:00", "en", "YYYY-MM-DD")).toBe("2026-08-23");
    expect(formatYear("2026-12-31T23:30:00-05:00", "en", "YYYY")).toBe("2027");
    // formatMonthDay stays strictly date-only in both paths.
    expect(formatMonthDay("2026-08-22T23:30:00-05:00", "MM-DD")).toBe(
      "2026-08-22T23:30:00-05:00",
    );
  });

  it("formats a leap day", () => {
    expect(formatDate("2028-02-29", "en", "YYYY-MM-DD")).toBe("2028-02-29");
    expect(formatDate("2028-02-29", "en", "MMM D, YYYY")).toBe("Feb 29, 2028");
  });

  it("zero-pads years 0000-0099", () => {
    expect(formatDate("0000-01-01", "en", "YYYY")).toBe("0000");
    expect(formatDate("0000-01-01", "en", "YY")).toBe("00");
    expect(formatDate("0007-03-05", "en", "YYYY")).toBe("0007");
    expect(formatDate("0007-03-05", "en", "YY")).toBe("07");
    expect(formatDate("0099-12-31", "en", "YYYY-MM-DD")).toBe("0099-12-31");
  });

  it("accepts a 7-character YYYY-MM input in formatYearMonth", () => {
    expect(formatYearMonth("2026-08", "en", "YYYY/MM")).toBe("2026/08");
    expect(formatYearMonth("2026-08", "ja", "YYYY年M月")).toBe("2026年8月");
    // The synthesised day-of-month is the first.
    expect(formatYearMonth("2026-08", "en", "DD")).toBe("01");
  });

  it("applies patterns through the remaining public functions", () => {
    expect(formatMonthDayLabel(iso, "en", "MM/DD")).toBe("08/05");
    expect(formatYear(iso, "en", "[FY]YY")).toBe("FY26");
    expect(formatYearMonth(iso, "en", "MMMM YYYY")).toBe("August 2026");
  });

  it("takes locale as the trailing argument in formatMonthDay", () => {
    expect(formatMonthDay(iso)).toBe("08-05");
    expect(formatMonthDay(iso, "M/D")).toBe("8/5");
    // Without a locale the month-name tokens fall back to English.
    expect(formatMonthDay(iso, "MMM D")).toBe("Aug 5");
    expect(formatMonthDay(iso, "MMM D", "ja")).toBe("8月 5");
    expect(formatMonthDay(iso, "M月D日", "ja")).toBe("8月5日");
  });
});
