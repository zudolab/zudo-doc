"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { colorSchemes, type ColorScheme } from "@/config/color-schemes";
import { colorTweakPresets } from "@/config/color-tweak-presets";
import { SEMANTIC_DEFAULTS } from "@/config/color-scheme-utils";
import { hexToHsl, hslToHex } from "@/utils/color-convert";
import {
  type ColorTweakState,
  SHIKI_THEMES,
  applyShikiTheme,
  initColorFromSchemeData,
} from "../state/tweak-state";
import type { PersistColor } from "../state/persist";

const allPresets: Record<string, ColorScheme> = { ...colorTweakPresets, ...colorSchemes };
const bundledNames = Object.keys(colorSchemes);
const presetNames = Object.keys(colorTweakPresets).sort();

// --- Shared popover helpers (Color-tab scoped) ---

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
      className="border border-muted bg-surface p-[12px]"
      style={getFixedPopoverStyle(anchorRef.current, 380, 280, { width: 380 })}
    >
      <div className="flex items-center gap-[10px] mb-[10px]">
        <div
          className="shrink-0 border border-muted"
          style={{
            backgroundColor: hslToHex(hsl.h, hsl.s, hsl.l),
            width: "3.5rem",
            height: "3.5rem",
            borderRadius: "var(--radius-DEFAULT)",
          }}
        />
        <input
          type="text"
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          className="bg-surface text-fg border border-muted px-[6px] py-[4px] font-mono"
          style={{ fontSize: "1rem", width: "8rem", borderRadius: "var(--radius-DEFAULT)" }}
          spellCheck={false}
          aria-label="Hex color value"
        />
      </div>
      {sliders.map(({ label, value, max, key }) => (
        <div key={key} className="flex items-center gap-[8px] mb-[6px]">
          <span className="text-muted shrink-0" style={{ fontSize: "0.875rem", width: "1rem" }}>
            {label}
          </span>
          <input
            type="range"
            min={0}
            max={max}
            value={value}
            onChange={(e) => updateFromHsl({ ...hsl, [key]: parseInt(e.target.value, 10) })}
            className="flex-1"
            style={{ height: "1.5rem", accentColor: "var(--color-accent)" }}
            aria-label={`${label === "H" ? "Hue" : label === "S" ? "Saturation" : "Lightness"}`}
          />
          <span className="text-fg shrink-0 text-right" style={{ fontSize: "0.875rem", width: "2.5rem" }}>
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
    <div className="flex flex-col items-center gap-[4px]">
      <button
        ref={buttonRef}
        type="button"
        className="block border border-muted hover:border-fg transition-colors cursor-pointer"
        style={{
          backgroundColor: color,
          width: "3.5rem",
          height: "3.5rem",
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
        style={{ fontSize: "0.875rem", lineHeight: 1 }}
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
    <div className="relative w-full" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-[4px] w-full border border-muted bg-surface px-[6px] py-[4px] hover:border-fg transition-colors"
        style={{ fontSize: "0.75rem", borderRadius: "var(--radius-DEFAULT)" }}
        aria-label={`${label}: ${valueLabel}`}
        aria-expanded={isOpen}
      >
        <span className="flex-1 text-left text-muted truncate">{label}</span>
        <div
          className="shrink-0 border border-muted"
          style={{
            backgroundColor: resolvedColor,
            width: "14px",
            height: "14px",
            borderRadius: "2px",
          }}
        />
        <span className="shrink-0 text-fg" style={{ width: "2.5em" }}>{valueLabel}</span>
        <svg className="text-muted shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={`${label} color options`}
          className="border border-muted bg-surface p-[10px]"
          style={getFixedPopoverStyle(buttonRef.current, 440, extraOptions ? 160 : 120)}
        >
          {/* Extra options (bg/fg) */}
          {extraOptions && extraOptions.length > 0 && (
            <div className="flex gap-[6px] mb-[8px] pb-[8px] border-b border-muted">
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
                    className={`flex items-center gap-[6px] px-[8px] py-[4px] transition-colors ${isSelected ? "bg-accent/20" : "hover:bg-fg/10"}`}
                    style={{ borderRadius: "4px", fontSize: "1rem" }}
                  >
                    <div
                      style={{
                        backgroundColor: optColor,
                        width: "1.75rem",
                        height: "1.75rem",
                        borderRadius: "3px",
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
          <div className="grid grid-cols-8 gap-[5px]">
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
                  className={`transition-colors ${isSelected ? "ring-2 ring-accent" : "hover:ring-2 hover:ring-fg"}`}
                  style={{
                    backgroundColor: color,
                    width: "3rem",
                    height: "3rem",
                    borderRadius: "3px",
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

// --- Color tab body ---

interface ColorTabProps {
  state: ColorTweakState;
  persistColor: PersistColor;
}

export default function ColorTab({ state, persistColor }: ColorTabProps) {
  const handlePaletteChange = useCallback(
    (index: number, hex: string) => {
      persistColor((prev) => ({
        ...prev,
        palette: prev.palette.map((c, i) => (i === index ? hex : c)),
      }));
    },
    [persistColor],
  );

  const handleBaseIndexChange = useCallback(
    (key: "background" | "foreground" | "cursor" | "selectionBg" | "selectionFg", val: number | "bg" | "fg") => {
      if (typeof val !== "number") return;
      persistColor((prev) => ({ ...prev, [key]: val }));
    },
    [persistColor],
  );

  const handleSemanticChange = useCallback(
    (key: string, val: number | "bg" | "fg") => {
      persistColor((prev) => ({
        ...prev,
        semanticMappings: { ...prev.semanticMappings, [key]: val },
      }));
    },
    [persistColor],
  );

  const handleLoadPreset = useCallback(
    (name: string) => {
      const scheme = allPresets[name];
      if (!scheme) return;
      const newState = initColorFromSchemeData(scheme);
      persistColor(() => newState);
      applyShikiTheme(newState.shikiTheme);
    },
    [persistColor],
  );

  return (
    <div className="flex flex-col gap-vsp-sm">
      {/* Preset loader — tab-scoped so the outer header row stays general */}
      <div className="flex items-center gap-hsp-md">
        <select
          onChange={(e) => {
            const name = e.target.value;
            if (name) {
              handleLoadPreset(name);
              e.target.value = "";
            }
          }}
          className="bg-surface text-fg border border-muted px-hsp-sm py-[2px] hover:border-fg transition-colors"
          style={{ fontSize: "0.75rem", borderRadius: "var(--radius-DEFAULT)", maxWidth: "14rem" }}
          aria-label="Load color scheme preset"
          defaultValue=""
        >
          <option value="" disabled>Scheme...</option>
          {bundledNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
          <hr />
          {presetNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {/* Section A: Raw Palette */}
      <div className="shrink-0">
        <h3
          className="text-muted font-semibold mb-vsp-2xs"
          style={{ fontSize: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}
        >
          Palette
        </h3>
        <div className="grid grid-cols-8 gap-hsp-sm">
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

      {/* Base + Semantic wrapper */}
      <div className="flex flex-col gap-vsp-sm">
        {/* Section B: Base Theme */}
        <div className="shrink-0">
          <h3
            className="text-muted font-semibold mb-vsp-2xs"
            style={{ fontSize: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}
          >
            Base
          </h3>
          <div className="grid grid-cols-3 gap-[6px]">
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
          </div>
        </div>

        {/* Section C: Semantic Token Mappings */}
        <div className="shrink-0">
          <h3
            className="text-muted font-semibold mb-vsp-2xs"
            style={{ fontSize: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}
          >
            Semantic Tokens
          </h3>
          <div className="grid grid-cols-3 gap-[6px]">
            {Object.entries(SEMANTIC_DEFAULTS).map(([key, defaultVal]) => {
              return (
                <PaletteSelector
                  key={key}
                  label={key}
                  value={state.semanticMappings[key] ?? defaultVal}
                  palette={state.palette}
                  onChange={(v) => handleSemanticChange(key, v)}
                  background={state.palette[state.background]}
                  foreground={state.palette[state.foreground]}
                />
              );
            })}
          </div>
        </div>

        {/* Divider + shikiTheme (non-token setting) */}
        <div className="border-t border-muted pt-vsp-xs">
          <div className="flex items-center gap-[6px]">
            <span className="text-muted shrink-0" style={{ fontSize: "0.75rem" }}>
              shikiTheme
            </span>
            <select
              value={state.shikiTheme}
              onChange={(e) => {
                const val = e.target.value;
                persistColor((prev) => ({ ...prev, shikiTheme: val }));
                applyShikiTheme(val);
              }}
              className="bg-surface text-fg border border-muted px-[6px] py-[4px] hover:border-fg transition-colors"
              style={{ fontSize: "0.75rem", borderRadius: "var(--radius-DEFAULT)" }}
            >
              {SHIKI_THEMES.map((theme) => (
                <option key={theme} value={theme}>{theme}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
