"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// BARE (non-island-wrapped) theme toggle — the single ThemeToggle
// implementation (#2012 E2). Published as the dedicated
// `@takazudo/zudo-doc/theme-toggle` subpath so hosts can compose it
// into their own `<Island>` wrappers (or nest it inside another island,
// e.g. the mobile sidebar footer) without inheriting an extra island
// layer. The island-wrapped variant for the `./theme` barrel lives in
// `../theme/theme-toggle.tsx`, which wraps this component.
//
// Use the preact hook entrypoints directly — zfb's esbuild step does
// not alias "react" to "preact/compat", so importing from "react" here
// would fail to resolve.
import { useState, useEffect } from "preact/hooks";
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

export interface ThemeToggleProps {
  defaultMode?: ColorSchemeMode;
}

export default function ThemeToggle({
  defaultMode = "dark",
}: ThemeToggleProps) {
  // Initial state must match server render to avoid hydration mismatch.
  // Actual theme is synced from DOM in useEffect below.
  const [mode, setMode] = useState<ColorSchemeMode>(defaultMode);

  useEffect(() => {
    const sync = () => setMode(readColorSchemeFromDom(defaultMode));
    sync();
    // Cross-instance sync (#2012 E3): every mounted toggle re-reads the
    // DOM whenever any instance (or the zdtp panel) applies a scheme,
    // so the header toggle and the sidebar-footer toggle never disagree.
    return subscribeColorSchemeChanged(sync);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle() {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    applyColorScheme(next);
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
// Pin the island marker name to "ThemeToggle" regardless of bundler
// identifier mangling: zfb's Island() derives the SSR marker via
// `displayName ?? name`, and esbuild may rename the function when
// another binding shares the name in the same bundle. Setting
// displayName explicitly keeps the emitted marker aligned with the
// island-manifest entry. zudolab/zudo-doc#1446.
ThemeToggle.displayName = "ThemeToggle";
