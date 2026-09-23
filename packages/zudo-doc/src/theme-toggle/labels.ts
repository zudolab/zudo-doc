import type { ThemeToggleLabels } from "./index.js";

/** Resolve labels before island serialization so host translation overrides apply. */
export function themeToggleLabels(
  t: (key: string, locale: string) => string,
  locale: string,
): ThemeToggleLabels {
  return {
    appearance: t("appearance.title", locale),
    light: t("appearance.light", locale),
    dark: t("appearance.dark", locale),
    system: t("appearance.system", locale),
    systemHelper: t("appearance.systemHelper", locale),
  };
}
