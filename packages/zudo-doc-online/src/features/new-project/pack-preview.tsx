/**
 * The miniature docs-site thumbnail a pack card (and the finish sheet's
 * larger preview) paints, plus the inline `--pack-*` custom-prop builder
 * that feeds it.
 *
 * Pack colors are DATA (epic #3345 contract 4): every color comes from the
 * catalog's `meta.preview[<current app mode>]` swatches and reaches CSS only
 * through the inline style string this module builds — `wizard.css` never
 * mentions a concrete color. This re-implements the framework's
 * theme-pack-card PATTERN on this app's own chrome; it deliberately does not
 * import any framework component or CSS.
 */

import type { ThemePackMeta } from "@takazudo/zudo-doc/catalog";
import type { ColorSchemeMode } from "../../theme/color-scheme-sync.js";

/**
 * Caption/heading font: the pack's display face when it names one, else its
 * body sans. The face is usually not loaded in this app (packs ship their own
 * webfonts), so the UI font is the explicit fallback — the caption then still
 * renders in a believable weight instead of an unstyled serif default.
 */
export function packFontFamily(pack: ThemePackMeta): string {
  const name = (pack.fonts.display ?? pack.fonts.sans).replaceAll('"', "");
  return `"${name}", var(--font-ui)`;
}

/** Inline style string carrying the pack's swatches as `--pack-*` custom props. */
export function packStyleVars(pack: ThemePackMeta, mode: ColorSchemeMode): string {
  const swatches = pack.preview[mode];
  return [
    `--pack-bg:${swatches.bg}`,
    `--pack-fg:${swatches.fg}`,
    `--pack-accent:${swatches.accent}`,
    `--pack-syn-keyword:${swatches.syntax.keyword}`,
    `--pack-syn-string:${swatches.syntax.string}`,
    `--pack-syn-comment:${swatches.syntax.comment}`,
    `--pack-syn-callable:${swatches.syntax.callable}`,
    `--pack-font:${packFontFamily(pack)}`,
  ].join(";");
}

export interface PackMiniProps {
  pack: ThemePackMeta;
}

/**
 * Purely decorative (`aria-hidden`) and built from spans throughout so it
 * stays valid phrasing content inside the pack `<button>`. Expects a
 * `--pack-*`-carrying ancestor (the card root or the preview wrapper).
 */
export function PackMini({ pack }: PackMiniProps) {
  return (
    <span className="zdo-wiz-mini" aria-hidden="true">
      <span className="zdo-wiz-mini-bar">
        <span className="zdo-wiz-mini-logo" />
        <span className="zdo-wiz-mini-brand">{pack.name}</span>
        <span className="zdo-wiz-mini-nav">
          <i />
          <i />
          <i />
        </span>
        <span className="zdo-wiz-mini-search" />
      </span>
      <span className="zdo-wiz-mini-body">
        <span className="zdo-wiz-mini-side">
          <span className="zdo-wiz-mini-slabel" />
          <span className="zdo-wiz-mini-sitem">
            <i style="width:74%" />
          </span>
          <span className="zdo-wiz-mini-sitem zdo-wiz-mini-sitem-active">
            <i style="width:58%" />
          </span>
          <span className="zdo-wiz-mini-sitem">
            <i style="width:84%" />
          </span>
          <span className="zdo-wiz-mini-slabel" />
          <span className="zdo-wiz-mini-sitem">
            <i style="width:66%" />
          </span>
          <span className="zdo-wiz-mini-sitem">
            <i style="width:78%" />
          </span>
        </span>
        <span className="zdo-wiz-mini-main">
          <span className="zdo-wiz-mini-crumb">
            <i />
            <i />
          </span>
          <span className="zdo-wiz-mini-h">Getting started</span>
          <span className="zdo-wiz-mini-p">
            <i />
            <i />
            <i />
          </span>
          <span className="zdo-wiz-mini-cta">Read the guide</span>
          <span className="zdo-wiz-mini-code">
            <i className="zdo-wiz-mini-code-kw" />
            <i className="zdo-wiz-mini-code-str" />
            <i className="zdo-wiz-mini-code-cm" />
            <i className="zdo-wiz-mini-code-fn" />
          </span>
        </span>
      </span>
    </span>
  );
}
