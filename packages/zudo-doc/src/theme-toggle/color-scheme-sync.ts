// Browser color-scheme state shared by the pre-paint bootstrap and client islands.
// The selected preference is distinct from the effective light/dark appearance.
export type ColorSchemeMode = "light" | "dark";
export type ThemePreference = ColorSchemeMode | "system";

export const COLOR_SCHEME_CHANGED_EVENT = "color-scheme-changed";
export const THEME_PREFERENCE_CHANGED_EVENT = "theme-preference-changed";
export const COLOR_SCHEME_RUNTIME_GLOBAL = "__zudoDocColorScheme";
export const COLOR_SCHEME_STORAGE_KEY = "zudo-doc-theme";

export interface ColorSchemeRuntime {
  // null means no valid persisted or live explicit choice.
  choice: ThemePreference | null;
  defaultMode: ColorSchemeMode;
  respectPrefersColorScheme: boolean;
  lastMode?: ColorSchemeMode;
  cleanup?: () => void;
}

// Keep these pure functions self-contained: the provider serializes their JS
// bodies into the inline pre-paint script, so both paths use identical rules.
export function normalizeThemePreference(value: unknown): ThemePreference | null {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : null;
}

export function resolveThemePreference(
  choice: ThemePreference | null,
  defaultMode: ColorSchemeMode,
  respectPrefersColorScheme: boolean,
): ThemePreference {
  return choice ?? (respectPrefersColorScheme ? "system" : defaultMode);
}

export function resolveColorScheme(
  preference: ThemePreference,
  systemIsDark: boolean,
): ColorSchemeMode {
  return preference === "system" ? (systemIsDark ? "dark" : "light") : preference;
}

function runtime(): ColorSchemeRuntime | null {
  return ((window as unknown as Record<string, unknown>)[COLOR_SCHEME_RUNTIME_GLOBAL] ??
    null) as ColorSchemeRuntime | null;
}

function readStorage(): ThemePreference | null {
  try {
    return normalizeThemePreference(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

function getRuntime(): ColorSchemeRuntime {
  const existing = runtime();
  if (existing) return existing;
  const initial: ColorSchemeRuntime = {
    choice: readStorage(),
    defaultMode: "dark",
    respectPrefersColorScheme: true,
  };
  (window as unknown as Record<string, unknown>)[COLOR_SCHEME_RUNTIME_GLOBAL] = initial;
  return initial;
}

export function readThemePreference(
  defaultMode: ColorSchemeMode = "dark",
  respectPrefersColorScheme = true,
): ThemePreference {
  const state = runtime();
  return resolveThemePreference(
    state ? state.choice : readStorage(),
    state?.defaultMode ?? defaultMode,
    state?.respectPrefersColorScheme ?? respectPrefersColorScheme,
  );
}

export function readColorSchemeFromDom(defaultMode: ColorSchemeMode): ColorSchemeMode {
  const actual = document.documentElement.getAttribute("data-theme");
  return actual === "light" || actual === "dark" ? actual : defaultMode;
}

/** Select a preference. Storage is best effort; the live choice survives errors. */
export function applyThemePreference(next: ThemePreference): void {
  const state = getRuntime();
  const previousPreference = resolveThemePreference(
    state.choice,
    state.defaultMode,
    state.respectPrefersColorScheme,
  );
  const previousMode = state.lastMode ?? document.documentElement.getAttribute("data-theme");
  state.choice = next;
  try {
    localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, next);
  } catch {
    // Private browsing or disabled storage must not block theme changes.
  }
  const systemIsDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  const mode = resolveColorScheme(next, systemIsDark);
  document.documentElement.setAttribute("data-theme", mode);
  document.documentElement.style.colorScheme = mode;
  state.lastMode = mode;
  if (previousMode !== mode) {
    window.dispatchEvent(new CustomEvent(COLOR_SCHEME_CHANGED_EVENT));
  }
  if (previousPreference !== next) {
    window.dispatchEvent(new CustomEvent(THEME_PREFERENCE_CHANGED_EVENT));
  }
}

/** Existing light/dark callers explicitly select the corresponding preference. */
export function applyColorScheme(next: ColorSchemeMode): void {
  applyThemePreference(next);
}

export function subscribeColorSchemeChanged(listener: () => void): () => void {
  window.addEventListener(COLOR_SCHEME_CHANGED_EVENT, listener);
  return () => window.removeEventListener(COLOR_SCHEME_CHANGED_EVENT, listener);
}

export function subscribeThemePreferenceChanged(listener: () => void): () => void {
  window.addEventListener(THEME_PREFERENCE_CHANGED_EVENT, listener);
  return () => window.removeEventListener(THEME_PREFERENCE_CHANGED_EVENT, listener);
}
