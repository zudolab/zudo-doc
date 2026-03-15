import { useState, useEffect, useCallback, useRef } from "react";
import ColorTweakExportModal from "./color-tweak-export-modal";

const STORAGE_KEY = "zudo-doc-tweak-state";

/** Default mapping: semantic token name → palette index (or "bg"/"fg" for codeBg/codeFg) */
const SEMANTIC_DEFAULTS: Record<string, number | "bg" | "fg"> = {
  surface: 0,
  muted: 8,
  accent: 6,
  accentHover: 14,
  codeBg: "fg",
  codeFg: "bg",
  success: 2,
  danger: 1,
  warning: 3,
  info: 4,
};

const SEMANTIC_CSS_NAMES: Record<string, string> = {
  surface: "--zd-surface",
  muted: "--zd-muted",
  accent: "--zd-accent",
  accentHover: "--zd-accent-hover",
  codeBg: "--zd-code-bg",
  codeFg: "--zd-code-fg",
  success: "--zd-success",
  danger: "--zd-danger",
  warning: "--zd-warning",
  info: "--zd-info",
};

const BASE_PROPS = [
  { key: "background", css: "--zd-bg", label: "bg" },
  { key: "foreground", css: "--zd-fg", label: "fg" },
  { key: "cursor", css: "--zd-cursor", label: "cursor" },
  { key: "selectionBg", css: "--zd-sel-bg", label: "sel-bg" },
  { key: "selectionFg", css: "--zd-sel-fg", label: "sel-fg" },
] as const;

interface TweakState {
  palette: string[];
  base: Record<string, string>;
  semanticOverrides: Record<string, string | null>;
}

/** Convert any CSS color to hex using a canvas */
function cssColorToHex(color: string): string {
  if (!color || color === "initial" || color === "inherit") return "#000000";
  // Already hex
  if (/^#[0-9a-fA-F]{6}$/.test(color.trim())) return color.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(color.trim())) {
    const c = color.trim();
    return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
  }
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return "#000000";
    ctx.fillStyle = color;
    const resolved = ctx.fillStyle;
    // ctx.fillStyle returns hex or rgb()
    if (resolved.startsWith("#")) return resolved;
    const match = resolved.match(
      /^rgba?\((\d+),\s*(\d+),\s*(\d+)/,
    );
    if (match) {
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
    }
    return "#000000";
  } catch {
    return "#000000";
  }
}

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function setCssVar(name: string, value: string) {
  document.documentElement.style.setProperty(name, value);
}

function readCurrentState(): TweakState {
  const palette: string[] = [];
  for (let i = 0; i < 16; i++) {
    palette.push(cssColorToHex(getCssVar(`--zd-${i}`)));
  }
  const base: Record<string, string> = {};
  for (const prop of BASE_PROPS) {
    base[prop.key] = cssColorToHex(getCssVar(prop.css));
  }
  const semanticOverrides: Record<string, string | null> = {};
  for (const key of Object.keys(SEMANTIC_DEFAULTS)) {
    semanticOverrides[key] = null; // start with defaults
  }
  return { palette, base, semanticOverrides };
}

function resolveSemanticDefault(
  key: string,
  palette: string[],
  base: Record<string, string>,
): string {
  const mapping = SEMANTIC_DEFAULTS[key];
  if (mapping === "bg") return base.background;
  if (mapping === "fg") return base.foreground;
  return palette[mapping as number] ?? "#000000";
}

function applyFullState(state: TweakState) {
  // Apply palette
  for (let i = 0; i < 16; i++) {
    setCssVar(`--zd-${i}`, state.palette[i]);
  }
  // Apply base
  for (const prop of BASE_PROPS) {
    setCssVar(prop.css, state.base[prop.key]);
  }
  // Apply semantic
  for (const [key, cssName] of Object.entries(SEMANTIC_CSS_NAMES)) {
    const override = state.semanticOverrides[key];
    if (override) {
      setCssVar(cssName, override);
    } else {
      setCssVar(cssName, resolveSemanticDefault(key, state.palette, state.base));
    }
  }
}

function ColorSwatch({
  color,
  onChange,
  label,
}: {
  color: string;
  onChange: (hex: string) => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col items-center gap-[2px]">
      <button
        type="button"
        className="block border border-muted hover:border-fg transition-colors cursor-pointer"
        style={{
          backgroundColor: color,
          width: "2rem",
          height: "2rem",
          borderRadius: "var(--radius-DEFAULT)",
        }}
        onClick={() => inputRef.current?.click()}
        title={`${label}: ${color}`}
      />
      <input
        ref={inputRef}
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        aria-label={label}
      />
      <span
        className="text-muted select-none"
        style={{ fontSize: "0.625rem", lineHeight: 1 }}
      >
        {label}
      </span>
    </div>
  );
}

function SemanticRow({
  label,
  tokenKey,
  currentColor,
  isOverridden,
  onOverride,
  onReset,
}: {
  label: string;
  tokenKey: string;
  currentColor: string;
  isOverridden: boolean;
  onOverride: (hex: string) => void;
  onReset: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const defaultIndex = SEMANTIC_DEFAULTS[tokenKey];
  const defaultLabel =
    defaultIndex === "bg"
      ? "bg"
      : defaultIndex === "fg"
        ? "fg"
        : `p${defaultIndex}`;

  return (
    <div className="flex items-center gap-hsp-sm">
      <button
        type="button"
        className="shrink-0 block border border-muted hover:border-fg transition-colors cursor-pointer"
        style={{
          backgroundColor: currentColor,
          width: "1.5rem",
          height: "1.5rem",
          borderRadius: "var(--radius-DEFAULT)",
        }}
        onClick={() => inputRef.current?.click()}
        title={`${label}: ${currentColor}`}
      />
      <input
        ref={inputRef}
        type="color"
        value={currentColor}
        onChange={(e) => onOverride(e.target.value)}
        className="sr-only"
        aria-label={label}
      />
      <span className="text-fg" style={{ fontSize: "0.75rem", minWidth: "5rem" }}>
        {label}
      </span>
      <span
        className="text-muted"
        style={{ fontSize: "0.625rem" }}
      >
        {defaultLabel}
      </span>
      {isOverridden && (
        <button
          type="button"
          onClick={onReset}
          className="text-accent hover:text-accent-hover transition-colors"
          style={{ fontSize: "0.625rem" }}
          title="Reset to palette default"
        >
          reset
        </button>
      )}
    </div>
  );
}

export default function ColorTweakPanel() {
  const [open, setOpen] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [state, setState] = useState<TweakState | null>(null);

  // Toggle panel via custom event from header icon
  useEffect(() => {
    function handleToggle() {
      setOpen((prev) => !prev);
    }
    window.addEventListener("toggle-color-tweak-panel", handleToggle);
    return () =>
      window.removeEventListener("toggle-color-tweak-panel", handleToggle);
  }, []);

  // Initialize state on first open
  useEffect(() => {
    if (!open || state) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as TweakState;
        // Validate shape
        if (parsed.palette?.length === 16 && parsed.base && parsed.semanticOverrides) {
          applyFullState(parsed);
          setState(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
    setState(readCurrentState());
  }, [open, state]);

  // Re-apply tweak state after View Transition page swaps
  useEffect(() => {
    function handleSwap() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as TweakState;
          if (parsed.palette?.length === 16 && parsed.base && parsed.semanticOverrides) {
            applyFullState(parsed);
            if (state) setState(parsed);
          }
        }
      } catch {
        // ignore
      }
    }
    document.addEventListener("astro:after-swap", handleSwap);
    return () => document.removeEventListener("astro:after-swap", handleSwap);
  }, [state]);

  const persist = useCallback(
    (next: TweakState) => {
      setState(next);
      applyFullState(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage full
      }
    },
    [],
  );

  const handlePaletteChange = useCallback(
    (index: number, hex: string) => {
      if (!state) return;
      const next = {
        ...state,
        palette: state.palette.map((c, i) => (i === index ? hex : c)),
      };
      persist(next);
    },
    [state, persist],
  );

  const handleBaseChange = useCallback(
    (key: string, hex: string) => {
      if (!state) return;
      const next = {
        ...state,
        base: { ...state.base, [key]: hex },
      };
      persist(next);
    },
    [state, persist],
  );

  const handleSemanticOverride = useCallback(
    (key: string, hex: string) => {
      if (!state) return;
      const next = {
        ...state,
        semanticOverrides: { ...state.semanticOverrides, [key]: hex },
      };
      persist(next);
    },
    [state, persist],
  );

  const handleSemanticReset = useCallback(
    (key: string) => {
      if (!state) return;
      const next = {
        ...state,
        semanticOverrides: { ...state.semanticOverrides, [key]: null },
      };
      persist(next);
    },
    [state, persist],
  );

  const handleResetAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    // Remove all inline styles to restore CSS-provided values
    for (let i = 0; i < 16; i++) {
      document.documentElement.style.removeProperty(`--zd-${i}`);
    }
    for (const prop of BASE_PROPS) {
      document.documentElement.style.removeProperty(prop.css);
    }
    for (const cssName of Object.values(SEMANTIC_CSS_NAMES)) {
      document.documentElement.style.removeProperty(cssName);
    }
    // Re-read from computed styles
    setState(readCurrentState());
  }, []);

  if (!open) return null;

  return (
    <>
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-muted bg-surface"
      style={{ maxHeight: "40vh" }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-hsp-lg py-vsp-2xs border-b border-muted">
        <span className="text-fg font-semibold" style={{ fontSize: "0.75rem" }}>
          Color Tweak Panel
        </span>
        <div className="flex items-center gap-hsp-md">
          <button
            type="button"
            onClick={() => setShowExport(true)}
            className="text-accent hover:text-accent-hover transition-colors"
            style={{ fontSize: "0.6875rem" }}
          >
            Export
          </button>
          <button
            type="button"
            onClick={handleResetAll}
            className="text-accent hover:text-accent-hover transition-colors"
            style={{ fontSize: "0.6875rem" }}
          >
            Reset all
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-muted hover:text-fg transition-colors"
            aria-label="Close panel"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className="overflow-y-auto px-hsp-lg py-vsp-xs"
        style={{ maxHeight: "calc(40vh - 2.5rem)" }}
      >
        {state && (
          <div className="flex flex-col gap-vsp-sm lg:flex-row lg:gap-hsp-2xl">
            {/* Section A: Raw Palette */}
            <div className="shrink-0">
              <h3
                className="text-muted font-semibold mb-vsp-2xs"
                style={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}
              >
                Palette
              </h3>
              <div className="grid grid-cols-8 gap-hsp-xs">
                {state.palette.map((color, i) => (
                  <ColorSwatch
                    key={i}
                    color={color}
                    label={`p${i}`}
                    onChange={(hex) => handlePaletteChange(i, hex)}
                  />
                ))}
              </div>
            </div>

            {/* Section B: Base Theme */}
            <div className="shrink-0">
              <h3
                className="text-muted font-semibold mb-vsp-2xs"
                style={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}
              >
                Base
              </h3>
              <div className="flex flex-wrap gap-hsp-xs">
                {BASE_PROPS.map((prop) => (
                  <ColorSwatch
                    key={prop.key}
                    color={state.base[prop.key]}
                    label={prop.label}
                    onChange={(hex) => handleBaseChange(prop.key, hex)}
                  />
                ))}
              </div>
            </div>

            {/* Section C: Semantic Overrides */}
            <div className="flex-1 min-w-0">
              <h3
                className="text-muted font-semibold mb-vsp-2xs"
                style={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}
              >
                Semantic Tokens
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-hsp-lg gap-y-[4px]">
                {Object.keys(SEMANTIC_DEFAULTS).map((key) => {
                  const override = state.semanticOverrides[key];
                  const defaultColor = resolveSemanticDefault(
                    key,
                    state.palette,
                    state.base,
                  );
                  const currentColor = override ?? defaultColor;
                  return (
                    <SemanticRow
                      key={key}
                      label={key}
                      tokenKey={key}
                      currentColor={currentColor}
                      isOverridden={!!override}
                      onOverride={(hex) => handleSemanticOverride(key, hex)}
                      onReset={() => handleSemanticReset(key)}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    {showExport && state && (
      <ColorTweakExportModal
        onClose={() => setShowExport(false)}
        colorState={{
          background: state.base.background,
          foreground: state.base.foreground,
          cursor: state.base.cursor,
          selectionBg: state.base.selectionBg,
          selectionFg: state.base.selectionFg,
          palette: state.palette,
          semantic: Object.fromEntries(
            Object.keys(SEMANTIC_DEFAULTS).map((key) => {
              const override = state.semanticOverrides[key];
              return [key, override ?? resolveSemanticDefault(key, state.palette, state.base)];
            }),
          ),
          shikiTheme: "dracula",
        }}
      />
    )}
    </>
  );
}
