// Click-toggle for the color scheme. Its `aria-label` always names the
// mode it is ABOUT to switch to, not the current one — matches
// @takazudo/zudo-doc's ThemeToggle contract.
import { useEffect, useState } from "preact/hooks";
import {
  applyColorScheme,
  readColorSchemeFromDom,
  subscribeColorSchemeChanged,
  type ColorSchemeMode,
} from "./color-scheme-sync.js";

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "var(--icon-sm)", height: "var(--icon-sm)" }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export interface ThemeToggleProps {
  defaultMode?: ColorSchemeMode;
}

export function ThemeToggle({ defaultMode = "light" }: ThemeToggleProps) {
  // Initial state must match the FOUC bootstrap's default to avoid a flash;
  // actual theme is synced from the DOM in the effect below.
  const [mode, setMode] = useState<ColorSchemeMode>(defaultMode);

  useEffect(() => {
    const sync = () => setMode(readColorSchemeFromDom(defaultMode));
    sync();
    return subscribeColorSchemeChanged(sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle() {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    applyColorScheme(next);
  }

  const nextMode = mode === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${nextMode} mode`}
      className="p-hsp-sm text-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
    >
      {mode === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
