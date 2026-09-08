import { describe, expect, it } from "vitest";
import { resolveDateFormats } from "../index.js";

describe("resolveDateFormats", () => {
  it("defaults every role to \"locale\" for undefined input", () => {
    expect(resolveDateFormats(undefined, "en")).toEqual({
      full: "locale",
      monthDay: "locale",
      year: "locale",
      yearMonth: "locale",
      numericMonthDay: "locale",
    });
  });

  it("normalises a bare pattern string to the full role, other roles default", () => {
    expect(resolveDateFormats("YYYY-MM-DD", "en")).toEqual({
      full: "YYYY-MM-DD",
      monthDay: "locale",
      year: "locale",
      yearMonth: "locale",
      numericMonthDay: "locale",
    });
  });

  it("applies a top-level role object, unset roles default to \"locale\"", () => {
    expect(resolveDateFormats({ full: "YYYY-MM-DD", year: "YYYY" }, "en")).toEqual({
      full: "YYYY-MM-DD",
      monthDay: "locale",
      year: "YYYY",
      yearMonth: "locale",
      numericMonthDay: "locale",
    });
  });

  it("layers a matching locale's roles over the top-level roles", () => {
    const setting = {
      full: "YYYY-MM-DD",
      year: "YYYY",
      locales: {
        ja: { full: "YYYY年MM月DD日" },
      },
    };
    expect(resolveDateFormats(setting, "ja")).toEqual({
      full: "YYYY年MM月DD日",
      monthDay: "locale",
      // `year` isn't overridden for "ja" — falls through to the top-level role.
      year: "YYYY",
      yearMonth: "locale",
      numericMonthDay: "locale",
    });
  });

  it("falls through to top-level roles for a locale with no override entry", () => {
    const setting = {
      full: "YYYY-MM-DD",
      locales: {
        ja: { full: "YYYY年MM月DD日" },
      },
    };
    expect(resolveDateFormats(setting, "de")).toEqual({
      full: "YYYY-MM-DD",
      monthDay: "locale",
      year: "locale",
      yearMonth: "locale",
      numericMonthDay: "locale",
    });
  });

  it("every role defaults to \"locale\" when the config supplies no roles at all", () => {
    expect(resolveDateFormats({}, "en")).toEqual({
      full: "locale",
      monthDay: "locale",
      year: "locale",
      yearMonth: "locale",
      numericMonthDay: "locale",
    });
  });
});
