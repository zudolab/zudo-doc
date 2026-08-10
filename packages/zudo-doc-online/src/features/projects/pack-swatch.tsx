/**
 * Theme-pack swatch artwork for the dashboard, painted from the catalog's
 * per-pack `meta.preview` swatches.
 *
 * The catalog import is the ONE `@takazudo/zudo-doc` import this app is
 * allowed (epic #3345 contract 3): `./catalog` is a browser-safe, data-only
 * module — no CSS, no components, no node-touching chain — so it does not
 * couple this app to the framework's design system. Pack colors are DATA,
 * not chrome (contract 4): they reach CSS exclusively as inline `--pack-*`
 * custom props on the artwork root; `projects-chrome.css` falls back to
 * neutral `--zdo-*` roles when the props are absent, which is exactly the
 * spec's "neutral chip otherwise" state.
 */

import catalog, { type ThemePackMeta } from "@takazudo/zudo-doc/catalog";
import { useEffect, useState } from "preact/hooks";
import {
  readColorSchemeFromDom,
  subscribeColorSchemeChanged,
  type ColorSchemeMode,
} from "../../theme/color-scheme-sync";
import type { ProjectPreset } from "../../store/projects-directory";

export function findCatalogPack(slug: string | undefined): ThemePackMeta | null {
  if (slug === undefined) return null;
  return catalog.packs.find((pack) => pack.slug === slug) ?? null;
}

export function packForPreset(preset: ProjectPreset | undefined): ThemePackMeta | null {
  return findCatalogPack(preset?.themePack);
}

/**
 * The app's CURRENT color scheme — the mode whose `meta.preview` swatches the
 * chips paint with — kept live across theme-toggle flips so the artwork
 * follows the chrome without a remount.
 */
export function useCurrentColorScheme(): ColorSchemeMode {
  const [mode, setMode] = useState<ColorSchemeMode>(() => readColorSchemeFromDom("light"));
  useEffect(
    () => subscribeColorSchemeChanged(() => setMode(readColorSchemeFromDom("light"))),
    [],
  );
  return mode;
}

function packVars(
  pack: ThemePackMeta | null,
  mode: ColorSchemeMode,
): Record<string, string> {
  if (pack === null) return {};
  const preview = pack.preview[mode];
  return {
    "--pack-bg": preview.bg,
    "--pack-fg": preview.fg,
    "--pack-accent": preview.accent,
  };
}

export interface PackArtworkProps {
  /** `null` renders the neutral (no theme pack) variant. */
  pack: ThemePackMeta | null;
  mode: ColorSchemeMode;
}

/** The compact rail-row chip (d3's `.chip`). */
export function PackChip({ pack, mode }: PackArtworkProps) {
  return (
    <span className="zdo-pj-chip" style={packVars(pack, mode)} aria-hidden="true">
      <i></i>
      <i></i>
      <i></i>
    </span>
  );
}

/** The theme card's mini site thumbnail (d3's `.mini`, simplified). */
export function PackMiniPreview({ pack, mode }: PackArtworkProps) {
  return (
    <div className="zdo-pj-mini" style={packVars(pack, mode)} aria-hidden="true">
      <div className="zdo-pj-mini-bar">
        <div className="zdo-pj-mini-logo"></div>
        <div className="zdo-pj-mini-brand"></div>
      </div>
      <div className="zdo-pj-mini-body">
        <div className="zdo-pj-mini-side">
          <i className="on"></i>
          <i className="w1"></i>
          <i className="w2"></i>
          <i className="w1"></i>
        </div>
        <div className="zdo-pj-mini-main">
          <div className="zdo-pj-mini-h"></div>
          <div className="zdo-pj-mini-lines">
            <i className="w1"></i>
            <i className="w2"></i>
            <i className="w3"></i>
          </div>
          <div className="zdo-pj-mini-chip"></div>
        </div>
      </div>
    </div>
  );
}

/** The theme card's flat bg/accent/text swatch row (d3's `.swatches`). */
export function PackSwatchRow({ pack, mode }: { pack: ThemePackMeta; mode: ColorSchemeMode }) {
  const preview = pack.preview[mode];
  const stops: Array<[string, string]> = [
    ["Bg", preview.bg],
    ["Accent", preview.accent],
    ["Text", preview.fg],
  ];
  return (
    <div className="flex gap-hsp-lg">
      {stops.map(([label, color]) => (
        <div key={label} className="flex flex-col items-start gap-vsp-2xs">
          <span className="zdo-pj-sw" style={{ background: color }}></span>
          <small className="text-caption uppercase tracking-(--zdo-pj-label-tracking) text-muted">
            {label}
          </small>
        </div>
      ))}
    </div>
  );
}
