// Browser-safe, locale-aware date formatting shared by metadata and note-tray
// surfaces. Date-only values are constructed explicitly in UTC so formatting
// never shifts a day in negative-offset time zones.

export interface IsoDateParts {
  year: number;
  month: number;
  day: number;
}

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
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return { year, month, day };
}

function toUtcDate(iso: string): Date | undefined {
  const parts = parseIsoDate(iso);
  if (parts) {
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
    return date;
  }
  // Git-history metadata includes full ISO timestamps. Preserve that accepted
  // input while making its display deterministic through timeZone: "UTC".
  if (!/^\d{4}-\d{2}-\d{2}T/.test(iso)) return undefined;
  const timestamp = new Date(iso);
  return Number.isNaN(timestamp.getTime()) ? undefined : timestamp;
}

/** Format an ISO date for display while retaining the established locale map. */
export function formatDate(iso: string, locale: string): string {
  const date = toUtcDate(iso);
  if (!date) return iso;
  return new Intl.DateTimeFormat(LOCALE_TO_BCP47[locale] ?? "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Format the localized month/day portion of an ISO date in UTC. */
export function formatMonthDayLabel(iso: string, locale: string): string {
  const date = toUtcDate(iso);
  if (!date) return iso;
  return new Intl.DateTimeFormat(LOCALE_TO_BCP47[locale] ?? "en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Format the localized year portion of an ISO date in UTC. */
export function formatYear(iso: string, locale: string): string {
  const date = toUtcDate(iso);
  if (!date) return iso;
  return new Intl.DateTimeFormat(LOCALE_TO_BCP47[locale] ?? "en-US", {
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Format a year/month label with the year first in every locale. */
export function formatYearMonth(iso: string, locale: string): string {
  const date = toUtcDate(iso.length === 7 ? `${iso}-01` : iso);
  if (!date) return iso;
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

/** Return the stable numeric month/day portion of a calendar-valid ISO date. */
export function formatMonthDay(iso: string): string {
  const parts = parseIsoDate(iso);
  return parts
    ? `${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`
    : iso;
}
