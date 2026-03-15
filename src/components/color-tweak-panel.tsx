import { useState, useEffect, useCallback, useRef } from "react";
import ColorTweakExportModal from "./color-tweak-export-modal";
import { colorSchemes, type ColorRef, type ColorScheme } from "@/config/color-schemes";
import { SEMANTIC_DEFAULTS, SEMANTIC_CSS_NAMES } from "@/config/color-scheme-utils";
import { settings } from "@/config/settings";
import { hexToHsl, hslToHex } from "@/utils/color-convert";

const STORAGE_KEY = "zudo-doc-tweak-state";
const OPEN_KEY = "zudo-doc-tweak-open";

/** Re-highlight all code blocks on the page with a new Shiki theme (lazy-loaded) */
async function applyShikiTheme(themeName: string): Promise<void> {
  const codeBlocks = document.querySelectorAll<HTMLPreElement>("pre.astro-code[data-language]");
  if (codeBlocks.length === 0) return;

  const langs = new Set<string>();
  for (const pre of codeBlocks) {
    const lang = pre.getAttribute("data-language");
    if (lang) langs.add(lang);
  }

  let highlighter: Awaited<ReturnType<typeof import("shiki")["createHighlighter"]>>;
  try {
    const { createHighlighter } = await import("shiki");
    highlighter = await createHighlighter({
      themes: [themeName],
      langs: [...langs],
    });
  } catch (err) {
    console.warn(`[tweak] Failed to load Shiki theme "${themeName}":`, err);
    return;
  }

  for (const pre of codeBlocks) {
    const lang = pre.getAttribute("data-language") || "text";
    const codeEl = pre.querySelector("code");
    if (!codeEl) continue;
    const text = codeEl.textContent || "";

    try {
      // Generate dual-theme output (same theme for both) so existing
      // light-dark() CSS picks up the new colors automatically
      const html = highlighter.codeToHtml(text, {
        lang,
        themes: { light: themeName, dark: themeName },
        defaultColor: false,
      });
      const temp = document.createElement("div");
      temp.innerHTML = html;
      const newPre = temp.querySelector("pre");
      if (!newPre) continue;

      const newCode = newPre.querySelector("code");
      if (newCode) codeEl.innerHTML = newCode.innerHTML;
      // Update CSS custom properties on the <pre> for background
      const newStyle = newPre.getAttribute("style") || "";
      for (const prop of ["--shiki-light", "--shiki-dark", "--shiki-light-bg", "--shiki-dark-bg"]) {
        const match = newStyle.match(new RegExp(`${prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:([^;]+)`));
        if (match) pre.style.setProperty(prop, match[1].trim());
      }
    } catch {
      // Skip blocks with unsupported languages
    }
  }
  highlighter.dispose();
}

const SHIKI_THEMES = [
  "dracula",
  "github-light",
  "github-dark",
  "nord",
  "tokyo-night",
  "one-dark-pro",
  "catppuccin-mocha",
  "catppuccin-latte",
  "gruvbox-dark-medium",
  "min-light",
  "min-dark",
  "vitesse-dark",
  "vitesse-light",
];

/**
 * TweakState models the 3-tier color strategy:
 * - palette: 16 editable raw colors
 * - background/foreground: independent base colors (color pickers)
 * - cursor/selectionBg/selectionFg: palette index references
 * - semanticMappings: palette index (or "bg"/"fg") references for each semantic token
 */
interface TweakState {
  palette: string[];
  background: number;
  foreground: number;
  cursor: number;
  selectionBg: number;
  selectionFg: number;
  semanticMappings: Record<string, number | "bg" | "fg">;
  shikiTheme: string;
}

/** Convert any CSS color to hex using a canvas (cached context) */
let _canvasCtx: CanvasRenderingContext2D | null = null;
function cssColorToHex(color: string): string {
  if (!color || color === "initial" || color === "inherit") return "#000000";
  if (/^#[0-9a-fA-F]{6}$/.test(color.trim())) return color.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(color.trim())) {
    const c = color.trim();
    return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
  }
  try {
    if (!_canvasCtx) _canvasCtx = document.createElement("canvas").getContext("2d");
    if (!_canvasCtx) return "#000000";
    _canvasCtx.fillStyle = color;
    const resolved = _canvasCtx.fillStyle;
    if (resolved.startsWith("#")) return resolved;
    const match = resolved.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
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

function setCssVar(name: string, value: string) {
  document.documentElement.style.setProperty(name, value);
}

/** Resolve a ColorRef to a palette index. If it's already a number, use it.
 *  If it's a string, find matching palette color or use fallback index. */
function colorRefToIndex(ref: ColorRef | undefined, palette: string[], fallback: number): number {
  if (ref === undefined) return fallback;
  if (typeof ref === "number") return ref;
  // String: try to find in palette
  const idx = palette.indexOf(ref);
  return idx >= 0 ? idx : fallback;
}

/** Resolve the active scheme name, considering light/dark mode and picker selection */
function getActiveSchemeName(): string {
  // Check if a scheme was explicitly selected via the picker
  try {
    const saved = localStorage.getItem("zudo-doc-color-scheme");
    if (saved && colorSchemes[saved]) return saved;
  } catch { /* ignore */ }
  // Check light/dark mode
  if (settings.colorMode) {
    const theme = document.documentElement.getAttribute("data-theme");
    if (theme === "light") return settings.colorMode.lightScheme;
    if (theme === "dark") return settings.colorMode.darkScheme;
  }
  return settings.colorScheme;
}

/** Initialize state from the active color scheme data (not computed styles) */
function initFromScheme(): TweakState {
  const schemeName = getActiveSchemeName();
  const scheme = colorSchemes[schemeName];
  if (!scheme) {
    const first = Object.values(colorSchemes)[0];
    return initFromSchemeData(first);
  }
  return initFromSchemeData(scheme);
}

function initFromSchemeData(scheme: ColorScheme): TweakState {
  const palette = scheme.palette.map((c) => cssColorToHex(c));
  const semanticMappings: Record<string, number | "bg" | "fg"> = {};
  for (const [key, defaultVal] of Object.entries(SEMANTIC_DEFAULTS)) {
    const schemeVal = scheme.semantic?.[key as keyof typeof scheme.semantic];
    if (schemeVal === undefined) {
      semanticMappings[key] = defaultVal;
    } else if (typeof schemeVal === "number") {
      semanticMappings[key] = schemeVal;
    } else {
      // String value — find in palette or keep default
      const idx = scheme.palette.indexOf(schemeVal);
      semanticMappings[key] = idx >= 0 ? idx : defaultVal;
    }
  }

  return {
    palette,
    background: colorRefToIndex(scheme.background, scheme.palette, 0),
    foreground: colorRefToIndex(scheme.foreground, scheme.palette, 15),
    cursor: colorRefToIndex(scheme.cursor, scheme.palette, 6),
    selectionBg: colorRefToIndex(scheme.selectionBg, scheme.palette, 0),
    selectionFg: colorRefToIndex(scheme.selectionFg, scheme.palette, 15),
    semanticMappings,
    shikiTheme: String(scheme.shikiTheme ?? "dracula"),
  };
}

/** Resolve a semantic mapping to an actual color */
function resolveMapping(
  mapping: number | "bg" | "fg",
  palette: string[],
  bgIndex: number,
  fgIndex: number,
): string {
  if (mapping === "bg") return palette[bgIndex] ?? "#000000";
  if (mapping === "fg") return palette[fgIndex] ?? "#ffffff";
  return palette[mapping] ?? "#000000";
}

/** Load and validate persisted TweakState from localStorage, with shikiTheme backfill */
function loadPersistedState(): TweakState | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as TweakState;
    if (parsed.palette?.length === 16 && parsed.background !== undefined && parsed.semanticMappings) {
      if (!parsed.shikiTheme) {
        parsed.shikiTheme = String(colorSchemes[getActiveSchemeName()]?.shikiTheme ?? "dracula");
      }
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

function applyFullState(state: TweakState) {
  // Apply palette
  for (let i = 0; i < 16; i++) {
    setCssVar(`--zd-${i}`, state.palette[i]);
  }
  // Apply base colors (all reference palette)
  setCssVar("--zd-bg", state.palette[state.background]);
  setCssVar("--zd-fg", state.palette[state.foreground]);
  setCssVar("--zd-cursor", state.palette[state.cursor]);
  setCssVar("--zd-sel-bg", state.palette[state.selectionBg]);
  setCssVar("--zd-sel-fg", state.palette[state.selectionFg]);
  // Apply semantic
  for (const [key, cssName] of Object.entries(SEMANTIC_CSS_NAMES)) {
    const mapping = state.semanticMappings[key] ?? SEMANTIC_DEFAULTS[key];
    setCssVar(cssName, resolveMapping(mapping, state.palette, state.background, state.foreground));
  }
}

// --- Shared hooks & utilities ---

/** Close popover on outside click, Escape, or ancestor scroll */
function usePopoverClose(
  containerRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  isOpen: boolean,
) {
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose, containerRef]);

  useEffect(() => {
    if (!isOpen) return;
    function handleScroll() { onClose(); }
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [isOpen, onClose]);
}

/** Compute fixed popover position with viewport-aware flip */
function getFixedPopoverStyle(
  anchor: HTMLElement | null,
  estW: number,
  estH: number,
  extraStyle?: React.CSSProperties,
): React.CSSProperties {
  if (!anchor) return { position: "fixed", zIndex: 70, ...extraStyle };
  const rect = anchor.getBoundingClientRect();
  const gap = 4;
  const pad = 8;
  const below = window.innerHeight - rect.bottom - pad;
  const above = rect.top - pad;
  const flipAbove = below < estH && above > below;
  let left = rect.left;
  if (left + estW > window.innerWidth - pad) left = window.innerWidth - pad - estW;
  if (left < pad) left = pad;
  const style: React.CSSProperties = {
    position: "fixed",
    left,
    zIndex: 70,
    borderRadius: "var(--radius-DEFAULT)",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    ...extraStyle,
  };
  if (flipAbove) {
    style.bottom = window.innerHeight - rect.top + gap;
  } else {
    style.top = rect.bottom + gap;
  }
  return style;
}

// --- UI Components ---

function HslPicker({
  color,
  onChange,
  onClose,
  anchorRef,
}: {
  color: string;
  onChange: (hex: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hsl, setHsl] = useState(() => hexToHsl(color));
  const [hexInput, setHexInput] = useState(color);

  useEffect(() => {
    setHsl(hexToHsl(color));
    setHexInput(color);
  }, [color]);

  usePopoverClose(containerRef, onClose, true);

  function updateFromHsl(newHsl: { h: number; s: number; l: number }) {
    setHsl(newHsl);
    const hex = hslToHex(newHsl.h, newHsl.s, newHsl.l);
    setHexInput(hex);
    onChange(hex);
  }

  function handleHexChange(value: string) {
    setHexInput(value);
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      setHsl(hexToHsl(value));
      onChange(value);
    }
  }

  const sliders = [
    { label: "H", value: hsl.h, max: 360, key: "h" as const },
    { label: "S", value: hsl.s, max: 100, key: "s" as const },
    { label: "L", value: hsl.l, max: 100, key: "l" as const },
  ];

  return (
    <div
      ref={containerRef}
      className="border border-muted bg-surface p-[8px]"
      style={getFixedPopoverStyle(anchorRef.current, 240, 180, { width: 240 })}
    >
      <div className="flex items-center gap-[6px] mb-[6px]">
        <div
          className="shrink-0 border border-muted"
          style={{
            backgroundColor: hslToHex(hsl.h, hsl.s, hsl.l),
            width: "2rem",
            height: "2rem",
            borderRadius: "var(--radius-DEFAULT)",
          }}
        />
        <input
          type="text"
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          className="bg-surface text-fg border border-muted px-[4px] py-[2px] font-mono"
          style={{ fontSize: "0.6875rem", width: "5.5rem", borderRadius: "var(--radius-DEFAULT)" }}
          spellCheck={false}
          aria-label="Hex color value"
        />
      </div>
      {sliders.map(({ label, value, max, key }) => (
        <div key={key} className="flex items-center gap-[4px] mb-[3px]">
          <span className="text-muted shrink-0" style={{ fontSize: "0.625rem", width: "0.75rem" }}>
            {label}
          </span>
          <input
            type="range"
            min={0}
            max={max}
            value={value}
            onChange={(e) => updateFromHsl({ ...hsl, [key]: parseInt(e.target.value, 10) })}
            className="flex-1"
            style={{ height: "1rem", accentColor: "var(--color-accent)" }}
            aria-label={`${label === "H" ? "Hue" : label === "S" ? "Saturation" : "Lightness"}`}
          />
          <span className="text-fg shrink-0 text-right" style={{ fontSize: "0.625rem", width: "1.75rem" }}>
            {value}{key === "h" ? "" : "%"}
          </span>
        </div>
      ))}
    </div>
  );
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
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const handleClose = useCallback(() => setIsOpen(false), []);
  return (
    <div className="flex flex-col items-center gap-[2px]">
      <button
        ref={buttonRef}
        type="button"
        className="block border border-muted hover:border-fg transition-colors cursor-pointer"
        style={{
          backgroundColor: color,
          width: "2rem",
          height: "2rem",
          borderRadius: "var(--radius-DEFAULT)",
        }}
        onClick={() => setIsOpen((prev) => !prev)}
        title={`${label}: ${color}`}
      />
      {isOpen && (
        <HslPicker
          color={color}
          onChange={onChange}
          onClose={handleClose}
          anchorRef={buttonRef}
        />
      )}
      <span
        className="text-muted select-none"
        style={{ fontSize: "0.625rem", lineHeight: 1 }}
      >
        {label}
      </span>
    </div>
  );
}

/** Palette index selector — fixed-position dropdown with viewport-aware flip */
function PaletteSelector({
  label,
  value,
  palette,
  onChange,
  extraOptions,
  background,
  foreground,
}: {
  label: string;
  value: number | "bg" | "fg";
  palette: string[];
  onChange: (val: number | "bg" | "fg") => void;
  extraOptions?: ("bg" | "fg")[];
  background?: string;
  foreground?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const handleClose = useCallback(() => setIsOpen(false), []);

  const resolvedColor =
    value === "bg" ? (background ?? "#000000") :
    value === "fg" ? (foreground ?? "#ffffff") :
    palette[value] ?? "#000000";

  const valueLabel =
    value === "bg" ? "bg" :
    value === "fg" ? "fg" :
    `p${value}`;

  usePopoverClose(containerRef, handleClose, isOpen);

  function select(val: number | "bg" | "fg") {
    onChange(val);
    setIsOpen(false);
  }

  return (
    <div className="flex items-center gap-hsp-xs" ref={containerRef} style={{ position: "relative" }}>
      <span className="text-fg shrink-0" style={{ fontSize: "0.75rem", minWidth: "4.5rem" }}>
        {label}
      </span>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-[4px] border border-muted bg-surface px-[4px] py-[2px] hover:border-fg transition-colors"
        style={{ fontSize: "0.6875rem", borderRadius: "var(--radius-DEFAULT)" }}
        aria-label={`${label}: ${valueLabel}`}
        aria-expanded={isOpen}
      >
        <div
          className="shrink-0 border border-muted"
          style={{
            backgroundColor: resolvedColor,
            width: "0.875rem",
            height: "0.875rem",
            borderRadius: "2px",
          }}
        />
        <span className="text-fg">{valueLabel}</span>
        <svg className="text-muted" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={`${label} color options`}
          className="border border-muted bg-surface p-[6px]"
          style={getFixedPopoverStyle(buttonRef.current, 280, extraOptions ? 110 : 80)}
        >
          {/* Extra options (bg/fg) */}
          {extraOptions && extraOptions.length > 0 && (
            <div className="flex gap-[3px] mb-[4px] pb-[4px] border-b border-muted">
              {extraOptions.map((opt) => {
                const optColor = opt === "bg" ? (background ?? "#000000") : (foreground ?? "#ffffff");
                const isSelected = value === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => select(opt)}
                    className={`flex items-center gap-[4px] px-[6px] py-[2px] transition-colors ${isSelected ? "bg-accent/20" : "hover:bg-fg/10"}`}
                    style={{ borderRadius: "3px", fontSize: "0.6875rem" }}
                  >
                    <div
                      style={{
                        backgroundColor: optColor,
                        width: "1rem",
                        height: "1rem",
                        borderRadius: "2px",
                        border: "1px solid var(--color-muted)",
                      }}
                    />
                    <span className="text-fg">{opt}</span>
                  </button>
                );
              })}
            </div>
          )}
          {/* Palette grid */}
          <div className="grid grid-cols-8 gap-[3px]">
            {palette.map((color, i) => {
              const isSelected = value === i;
              return (
                <button
                  key={i}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => select(i)}
                  title={`p${i}: ${color}`}
                  className={`transition-colors ${isSelected ? "ring-1 ring-accent" : "hover:ring-1 hover:ring-fg"}`}
                  style={{
                    backgroundColor: color,
                    width: "1.75rem",
                    height: "1.75rem",
                    borderRadius: "2px",
                    border: "1px solid var(--color-muted)",
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Component ---

export default function ColorTweakPanel() {
  const [open, setOpen] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [state, setState] = useState<TweakState | null>(null);

  // Restore open state from localStorage after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    try {
      if (localStorage.getItem(OPEN_KEY) === "1") setOpen(true);
    } catch { /* ignore */ }
  }, []);

  // Persist open state
  useEffect(() => {
    try {
      if (open) localStorage.setItem(OPEN_KEY, "1");
      else localStorage.removeItem(OPEN_KEY);
    } catch { /* ignore */ }
  }, [open]);

  // Toggle panel via custom event from header icon
  useEffect(() => {
    function handleToggle() {
      setOpen((prev) => !prev);
    }
    window.addEventListener("toggle-color-tweak-panel", handleToggle);
    return () =>
      window.removeEventListener("toggle-color-tweak-panel", handleToggle);
  }, []);

  // Re-initialize when the color scheme or light/dark mode changes
  useEffect(() => {
    function handleSchemeChange() {
      // Clear all inline style overrides so the new scheme's <style> tag takes effect
      for (let i = 0; i < 16; i++) {
        document.documentElement.style.removeProperty(`--zd-${i}`);
      }
      for (const prop of ["--zd-bg", "--zd-fg", "--zd-cursor", "--zd-sel-bg", "--zd-sel-fg"]) {
        document.documentElement.style.removeProperty(prop);
      }
      for (const cssName of Object.values(SEMANTIC_CSS_NAMES)) {
        document.documentElement.style.removeProperty(cssName);
      }
      setState(initFromScheme());
    }
    window.addEventListener("color-scheme-changed", handleSchemeChange);
    return () =>
      window.removeEventListener("color-scheme-changed", handleSchemeChange);
  }, []);

  // Initialize state on first open
  useEffect(() => {
    if (!open || state) return;
    const persisted = loadPersistedState();
    if (persisted) {
      applyFullState(persisted);
      setState(persisted);
      return;
    }
    // No saved state — page already has correct colors from ColorSchemeProvider.
    // Just read scheme data for panel display; don't apply (avoids oklch->hex lossy conversion).
    setState(initFromScheme());
  }, [open, state]);

  // Re-apply tweak state after View Transition page swaps
  useEffect(() => {
    function handleSwap() {
      const persisted = loadPersistedState();
      if (persisted) {
        applyFullState(persisted);
        if (state) setState(persisted);
      }
    }
    document.addEventListener("astro:after-swap", handleSwap);
    return () => document.removeEventListener("astro:after-swap", handleSwap);
  }, [state]);

  const persist = useCallback(
    (updater: (prev: TweakState) => TweakState) => {
      setState((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        applyFullState(next);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // storage full
        }
        return next;
      });
    },
    [],
  );

  const handlePaletteChange = useCallback(
    (index: number, hex: string) => {
      persist((prev) => ({
        ...prev,
        palette: prev.palette.map((c, i) => (i === index ? hex : c)),
      }));
    },
    [persist],
  );

  const handleBaseIndexChange = useCallback(
    (key: "background" | "foreground" | "cursor" | "selectionBg" | "selectionFg", val: number | "bg" | "fg") => {
      if (typeof val !== "number") return;
      persist((prev) => ({ ...prev, [key]: val }));
    },
    [persist],
  );

  const handleSemanticChange = useCallback(
    (key: string, val: number | "bg" | "fg") => {
      persist((prev) => ({
        ...prev,
        semanticMappings: { ...prev.semanticMappings, [key]: val },
      }));
    },
    [persist],
  );

  const handleResetAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    // Remove all inline styles to restore CSS-provided values
    for (let i = 0; i < 16; i++) {
      document.documentElement.style.removeProperty(`--zd-${i}`);
    }
    const baseCssProps = ["--zd-bg", "--zd-fg", "--zd-cursor", "--zd-sel-bg", "--zd-sel-fg"];
    for (const prop of baseCssProps) {
      document.documentElement.style.removeProperty(prop);
    }
    for (const cssName of Object.values(SEMANTIC_CSS_NAMES)) {
      document.documentElement.style.removeProperty(cssName);
    }
    const fresh = initFromScheme();
    setState(fresh);
  }, []);

  if (!open) return null;

  return (
    <>
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-muted bg-surface lg:left-auto lg:border-l"
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
          <div className="flex flex-col gap-vsp-sm lg:flex-row lg:gap-hsp-xl">
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

            {/* Base + Semantic wrapper: 2-col at md, dissolves into outer row at lg */}
            <div className="flex flex-col gap-vsp-sm md:flex-row md:gap-hsp-xl lg:contents">
              {/* Section B: Base Theme */}
              <div className="shrink-0">
                <h3
                  className="text-muted font-semibold mb-vsp-2xs"
                  style={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}
                >
                  Base
                </h3>
                <div className="flex flex-col gap-[4px]">
                  <PaletteSelector
                    label="bg"
                    value={state.background}
                    palette={state.palette}
                    onChange={(v) => handleBaseIndexChange("background", v)}
                  />
                  <PaletteSelector
                    label="fg"
                    value={state.foreground}
                    palette={state.palette}
                    onChange={(v) => handleBaseIndexChange("foreground", v)}
                  />
                  <PaletteSelector
                    label="cursor"
                    value={state.cursor}
                    palette={state.palette}
                    onChange={(v) => handleBaseIndexChange("cursor", v)}
                  />
                  <PaletteSelector
                    label="sel-bg"
                    value={state.selectionBg}
                    palette={state.palette}
                    onChange={(v) => handleBaseIndexChange("selectionBg", v)}
                  />
                  <PaletteSelector
                    label="sel-fg"
                    value={state.selectionFg}
                    palette={state.palette}
                    onChange={(v) => handleBaseIndexChange("selectionFg", v)}
                  />
                  <div className="flex items-center gap-hsp-xs mt-[4px]">
                    <span className="text-fg shrink-0" style={{ fontSize: "0.75rem", minWidth: "4.5rem" }}>
                      shikiTheme
                    </span>
                    <select
                      value={state.shikiTheme}
                      onChange={(e) => {
                        const val = e.target.value;
                        persist((prev) => ({ ...prev, shikiTheme: val }));
                        applyShikiTheme(val);
                      }}
                      className="bg-surface text-fg border border-muted px-[4px] py-[2px] hover:border-fg transition-colors"
                      style={{ fontSize: "0.6875rem", borderRadius: "var(--radius-DEFAULT)" }}
                    >
                      {SHIKI_THEMES.map((theme) => (
                        <option key={theme} value={theme}>{theme}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section C: Semantic Token Mappings */}
              <div className="shrink-0">
                <h3
                  className="text-muted font-semibold mb-vsp-2xs"
                  style={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}
                >
                  Semantic Tokens
                </h3>
                <div className="grid grid-cols-2 gap-x-hsp-lg gap-y-[4px]">
                  {Object.entries(SEMANTIC_DEFAULTS).map(([key, defaultVal]) => {
                    const hasBaseOptions = defaultVal === "bg" || defaultVal === "fg";
                    return (
                      <PaletteSelector
                        key={key}
                        label={key}
                        value={state.semanticMappings[key] ?? defaultVal}
                        palette={state.palette}
                        onChange={(v) => handleSemanticChange(key, v)}
                        extraOptions={hasBaseOptions ? ["bg", "fg"] : undefined}
                        background={state.palette[state.background]}
                        foreground={state.palette[state.foreground]}
                      />
                    );
                  })}
                </div>
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
          background: state.background,
          foreground: state.foreground,
          cursor: state.cursor,
          selectionBg: state.selectionBg,
          selectionFg: state.selectionFg,
          palette: state.palette,
          semanticMappings: state.semanticMappings,
          shikiTheme: state.shikiTheme,
        }}
      />
    )}
    </>
  );
}
