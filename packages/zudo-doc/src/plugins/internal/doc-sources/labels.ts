import type { LabelRef } from "./model.js";

export type Translations = Record<string, Record<string, string>>;

/**
 * Resolve a generated-section label with the same fallback order as `t()`:
 * requested locale → configured default locale → English → literal fallback.
 * The literal keeps a missing translation from leaking a key into output.
 */
export function resolveLabel(
  label: LabelRef,
  locale: string,
  defaultLocale: string,
  translations: Translations,
): string {
  if (label.key === undefined) return label.fallback;
  return (
    translations[locale]?.[label.key] ??
    translations[defaultLocale]?.[label.key] ??
    translations.en?.[label.key] ??
    label.fallback
  );
}
