// Browser-safe, locale-aware date formatting shared by metadata and note-tray
// surfaces. Date-only values are constructed explicitly in UTC so formatting
// never shifts a day in negative-offset time zones.

export interface IsoDateParts {
  year: number;
  month: number;
  day: number;
}

/** "locale" keeps today's Intl behaviour; anything else is a token pattern. */
export type DateFormatPattern = "locale" | (string & {});

const LOCALE_TO_BCP47: Record<string, string> = {
  en: "en-US",
  ja: "ja-JP",
  de: "de-DE",
};

export function parseIsoDate(iso: string): IsoDateParts | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = utcDateFromParts({ year, month, day });
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return { year, month, day };
}

// setUTCFullYear (not the Date constructor) so years 0-99 stay themselves
// instead of being remapped into the 1900s.
function utcDateFromParts(parts: IsoDateParts): Date {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  return date;
}

function toUtcDate(iso: string): Date | undefined {
  const parts = parseIsoDate(iso);
  if (parts) return utcDateFromParts(parts);
  // Git-history metadata includes full ISO timestamps. Preserve that accepted
  // input while making its display deterministic through timeZone: "UTC".
  if (!/^\d{4}-\d{2}-\d{2}T/.test(iso)) return undefined;
  const timestamp = new Date(iso);
  return Number.isNaN(timestamp.getTime()) ? undefined : timestamp;
}

// ── Token pattern engine ────────────────────────────────────────────────────
// A deliberately bounded subset of the Day.js token conventions — users already
// know the spelling, but this is NOT Day.js compatibility and must never be
// documented as such. Ordered longest-first so YYYY beats YY and MMMM beats
// MMM/MM/M at the same position.
const PATTERN_TOKENS = ["YYYY", "YY", "MMMM", "MMM", "MM", "M", "DD", "D"] as const;

type PatternToken = (typeof PATTERN_TOKENS)[number];

function monthName(date: Date, locale: string, width: "long" | "short"): string {
  return new Intl.DateTimeFormat(LOCALE_TO_BCP47[locale] ?? "en-US", {
    month: width,
    timeZone: "UTC",
  }).format(date);
}

// Typed against the token tuple so adding a token to PATTERN_TOKENS without a
// case here is a compile error rather than a silent wrong rendering.
function renderToken(token: PatternToken, date: Date, locale: string): string {
  switch (token) {
    case "YYYY":
      return String(date.getUTCFullYear()).padStart(4, "0");
    case "YY":
      return String(date.getUTCFullYear() % 100).padStart(2, "0");
    case "MMMM":
      return monthName(date, locale, "long");
    case "MMM":
      return monthName(date, locale, "short");
    case "MM":
      return String(date.getUTCMonth() + 1).padStart(2, "0");
    case "M":
      return String(date.getUTCMonth() + 1);
    case "DD":
      return String(date.getUTCDate()).padStart(2, "0");
    case "D":
      return String(date.getUTCDate());
  }
}

/**
 * Substitute pattern tokens against a UTC date.
 *
 * Rules that are contract, not incidental:
 * - Output is built by appending, never by replacing in place, so a substituted
 *   month name ("March", "May") is never rescanned for M/D tokens.
 * - `[...]` escapes its contents literally. Brackets do not nest — the first
 *   `]` closes — and an unmatched `[` is emitted as a literal `[` while
 *   scanning continues, so tokens after it still resolve.
 * - Anything that is not a token passes through literally, which is what makes
 *   `/`, `-`, `.`, spaces and `年 月 日` work with no extra vocabulary. A
 *   sequence longer than a token degrades rather than erroring: `YYYYY` renders
 *   as the year followed by a literal `Y`, and `dddd` stays `dddd`.
 * - An empty pattern renders an empty string.
 */
function applyPattern(date: Date, pattern: string, locale: string): string {
  let out = "";
  let index = 0;
  while (index < pattern.length) {
    const char = pattern[index]!;
    if (char === "[") {
      const close = pattern.indexOf("]", index + 1);
      if (close !== -1) {
        out += pattern.slice(index + 1, close);
        index = close + 1;
        continue;
      }
      out += char;
      index += 1;
      continue;
    }
    const token = PATTERN_TOKENS.find((candidate) => pattern.startsWith(candidate, index));
    if (token) {
      out += renderToken(token, date, locale);
      index += token.length;
      continue;
    }
    out += char;
    index += 1;
  }
  return out;
}

function usesPattern(pattern: DateFormatPattern | undefined): pattern is string {
  return pattern !== undefined && pattern !== "locale";
}

/** Format an ISO date for display while retaining the established locale map. */
export function formatDate(iso: string, locale: string, pattern?: DateFormatPattern): string {
  const date = toUtcDate(iso);
  if (!date) return iso;
  if (usesPattern(pattern)) return applyPattern(date, pattern, locale);
  return new Intl.DateTimeFormat(LOCALE_TO_BCP47[locale] ?? "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Format the localized month/day portion of an ISO date in UTC. */
export function formatMonthDayLabel(
  iso: string,
  locale: string,
  pattern?: DateFormatPattern,
): string {
  const date = toUtcDate(iso);
  if (!date) return iso;
  if (usesPattern(pattern)) return applyPattern(date, pattern, locale);
  return new Intl.DateTimeFormat(LOCALE_TO_BCP47[locale] ?? "en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Format the localized year portion of an ISO date in UTC. */
export function formatYear(iso: string, locale: string, pattern?: DateFormatPattern): string {
  const date = toUtcDate(iso);
  if (!date) return iso;
  if (usesPattern(pattern)) return applyPattern(date, pattern, locale);
  return new Intl.DateTimeFormat(LOCALE_TO_BCP47[locale] ?? "en-US", {
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Format a year/month label with the year first in every locale. */
export function formatYearMonth(
  iso: string,
  locale: string,
  pattern?: DateFormatPattern,
): string {
  const date = toUtcDate(iso.length === 7 ? `${iso}-01` : iso);
  if (!date) return iso;
  if (usesPattern(pattern)) return applyPattern(date, pattern, locale);
  const year = new Intl.DateTimeFormat(LOCALE_TO_BCP47[locale] ?? "en-US", {
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  const month = new Intl.DateTimeFormat(LOCALE_TO_BCP47[locale] ?? "en-US", {
    month: "long",
    timeZone: "UTC",
  }).format(date);
  return locale === "ja" ? `${year}${month}` : `${year} ${month}`;
}

/**
 * Return the stable numeric month/day portion of a calendar-valid ISO date.
 *
 * The parameter order is deliberately `(iso, pattern, locale)`: this formatter
 * had no locale parameter at all, so `locale` is appended last and is only
 * consulted for the `MMM`/`MMMM` tokens. Input stays strictly date-only in both
 * the default and the pattern path — full timestamps are returned unchanged.
 */
export function formatMonthDay(
  iso: string,
  pattern?: DateFormatPattern,
  locale?: string,
): string {
  const parts = parseIsoDate(iso);
  if (!parts) return iso;
  if (usesPattern(pattern)) {
    return applyPattern(utcDateFromParts(parts), pattern, locale ?? "en");
  }
  return `${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}
