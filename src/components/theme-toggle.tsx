"use client";

// Use preact hook entrypoints directly — zfb's esbuild step doesn't alias
// "react" to "preact/compat" the way Astro's `@astrojs/preact` integration
// did, so importing from "react" here would fail to resolve at SSR/island
// bundle time. Same pattern as packages/zudo-doc-v2/src/theme/theme-toggle.tsx.
import { useState, useEffect } from "preact/hooks";

const STORAGE_KEY = "zudo-doc-theme";

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
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
      width="20"
      height="20"
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

interface ThemeToggleProps {
  defaultMode?: "light" | "dark";
}

export default function ThemeToggle({ defaultMode = "dark" }: ThemeToggleProps) {
  // Initial state must match server render to avoid hydration mismatch.
  // Actual theme is synced from DOM in useEffect below.
  const [mode, setMode] = useState<"light" | "dark">(defaultMode);

  useEffect(() => {
    const actual =
      (document.documentElement.getAttribute("data-theme") as
        | "light"
        | "dark") || defaultMode;
    if (actual !== mode) {
      setMode(actual);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle() {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    document.documentElement.setAttribute("data-theme", next);
    document.documentElement.style.colorScheme = next;
    localStorage.setItem(STORAGE_KEY, next);
    // Clear both v1 and v2 tweak state so the new scheme's palette takes effect.
    localStorage.removeItem("zudo-doc-tweak-state");
    localStorage.removeItem("zudo-doc-tweak-state-v2");
    window.dispatchEvent(new CustomEvent("color-scheme-changed"));
  }

  const nextMode = mode === "dark" ? "light" : "dark";

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${nextMode} mode`}
      className="text-muted hover:text-fg transition-colors p-hsp-sm focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
    >
      {mode === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
// Pin the island marker name to "ThemeToggle" regardless of esbuild's
// identifier deduplication. Both this host component and the v2 package's
// ThemeToggleInner share the plain name "ThemeToggle"; when both land in the
// same SSR bundle esbuild renames one to "ThemeToggle2", making
// captureComponentName() emit "ThemeToggle2" — a name that has no entry in
// the island manifest. Setting displayName explicitly ensures Island() reads
// the attribute-level name (displayName is preferred over .name) and emits
// the correct data-zfb-island="ThemeToggle" marker. zudolab/zudo-doc#1446.
ThemeToggle.displayName = "ThemeToggle";
