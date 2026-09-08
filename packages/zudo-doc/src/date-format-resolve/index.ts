// date-format-resolve — pure per-locale resolver for the `dateFormat` setting.
//
// Turns the flexible `DateFormatSetting` (a bare pattern, or a `DateFormatConfig`
// with per-role and per-locale overrides) into a fully-populated set of roles
// ready to hand to `format-date`'s formatters. Must stay pure, node-free and
// browser-safe — its output is serialized into island props downstream.

import type {
  DateFormatRoles,
  DateFormatSetting,
  ResolvedDateFormats,
} from "../settings.js";

// Derived from a `Record<keyof DateFormatRoles, true>` rather than written as
// a literal tuple: a plain `satisfies readonly (keyof DateFormatRoles)[]` only
// checks that every LISTED key is a real role, not that every real role is
// listed — so a role added to `DateFormatRoles` and forgotten here would be
// missing from the returned object while `ResolvedDateFormats`
// (`Required<DateFormatRoles>`) still claims it is present. The Record makes
// the omission a compile error.
const DATE_FORMAT_ROLE_PRESENCE: Record<keyof DateFormatRoles, true> = {
  full: true,
  monthDay: true,
  year: true,
  yearMonth: true,
  numericMonthDay: true,
};

const DATE_FORMAT_ROLE_KEYS = Object.keys(
  DATE_FORMAT_ROLE_PRESENCE,
) as (keyof DateFormatRoles)[];

/**
 * Resolve a `dateFormat` setting into every role's pattern for one locale.
 *
 * Precedence per role: `locales[locale][role]` → top-level `[role]` →
 * `"locale"`. `undefined` input (the setting is optional) resolves to every
 * role defaulting to `"locale"`. A bare pattern string normalises to `{ full:
 * <pattern> }` before the same layering applies.
 */
export function resolveDateFormats(
  setting: DateFormatSetting | undefined,
  locale: string,
): ResolvedDateFormats {
  // A bare pattern is a string; `DateFormatConfig` is always an object, so
  // `typeof` alone tells the two apart (and undefined is handled first).
  const topLevelRoles: DateFormatRoles =
    setting === undefined ? {} : typeof setting === "string" ? { full: setting } : setting;
  const localeRoles: DateFormatRoles | undefined =
    setting !== undefined && typeof setting !== "string" ? setting.locales?.[locale] : undefined;

  const resolved = {} as ResolvedDateFormats;
  for (const role of DATE_FORMAT_ROLE_KEYS) {
    resolved[role] = localeRoles?.[role] ?? topLevelRoles[role] ?? "locale";
  }
  return resolved;
}
