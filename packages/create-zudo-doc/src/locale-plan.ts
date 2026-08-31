/**
 * A locale code is also used as a directory and URL-path segment. Keep this
 * grammar deliberately smaller than the full BCP 47 grammar: an ASCII
 * language followed by optional ASCII alphanumeric subtags.
 */
const LOCALE_RE = /^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/;

export interface LocalePlanInput {
  defaultLang: string;
  additionalLangs?: readonly string[];
  i18n: boolean;
  /** Whether the original input explicitly contained `--no-i18n`. */
  i18nExplicitlyDisabled?: boolean;
}

export interface LocalePlan {
  defaultLang: string;
  additionalLangs: string[];
  i18n: boolean;
  /** A non-empty explicit list won over an explicit `--no-i18n`. */
  overridesExplicitDisable: boolean;
}

function normalizeLocale(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  const normalized = value.trim().toLowerCase();
  if (!LOCALE_RE.test(normalized)) {
    throw new Error(
      `Invalid ${field} ${JSON.stringify(value)}. Locale codes must match /^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/`,
    );
  }
  return normalized;
}

/**
 * Resolve every locale input path to one canonical, filesystem-safe plan.
 * This function is pure and is the sole owner of locale normalization,
 * validation, legacy inference, and explicit-list precedence.
 */
export function resolveLocalePlan(input: LocalePlanInput): LocalePlan {
  const defaultLang = normalizeLocale(input.defaultLang, "defaultLang");

  if (input.additionalLangs === undefined) {
    const additionalLangs = input.i18n
      ? [defaultLang === "en" ? "ja" : "en"]
      : [];
    return {
      defaultLang,
      additionalLangs,
      i18n: input.i18n,
      overridesExplicitDisable: false,
    };
  }

  if (!Array.isArray(input.additionalLangs)) {
    throw new Error("additionalLangs must be an array");
  }
  if (input.additionalLangs.length === 0) {
    throw new Error("additionalLangs must contain at least one locale");
  }

  const additionalLangs = input.additionalLangs.map((locale, index) =>
    normalizeLocale(locale, `additionalLangs[${index}]`),
  );
  const seen = new Set<string>();
  for (const locale of additionalLangs) {
    if (locale === defaultLang) {
      throw new Error(
        `additionalLangs must not include defaultLang ${JSON.stringify(defaultLang)}`,
      );
    }
    if (seen.has(locale)) {
      throw new Error(`Duplicate locale ${JSON.stringify(locale)} in additionalLangs`);
    }
    seen.add(locale);
  }

  return {
    defaultLang,
    additionalLangs,
    i18n: true,
    overridesExplicitDisable: input.i18nExplicitlyDisabled === true,
  };
}
