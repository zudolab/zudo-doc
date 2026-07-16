/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// ThemePackCard — the browse-all dialog's per-pack mini preview (#2825, ADR
// `docs/adr/theme-packs.md` Decision 7 "Switcher data flow" + the sub-issue's
// "Card contents" spec). Painted ENTIRELY from `meta.preview[<mode>]`
// resolved plain-color swatches — no pack stylesheet or webfont is ever
// loaded to render this preview (the whole reason the `preview` field exists
// in `meta.json`, ADR Decision 1).
//
// Kept in its own file WITHOUT "use client" (the `switcher-state.ts`
// convention in the sibling `theme-pack-switcher/` directory) so
// `preact-render-to-string` fixture tests can render it directly, and so it
// stays a plain reachable component in the parent island's static-import
// graph rather than a second scanner-registered island (zfb's island scanner
// registers every exported binding of a "use client" file as an island).

import type { VNode } from "preact";
import type { ThemePackMeta } from "../theme-packs-registry/index.js";

export interface ThemePackCardProps {
  /** Full pack meta (incl. resolved preview swatches) for one registry entry. */
  meta: ThemePackMeta;
  /** Current light/dark UI mode — selects which `meta.preview` swatch set
   *  paints the card (NOT `meta.mode`, which is only the designed-primary
   *  badge shown alongside the name). */
  mode: "light" | "dark";
  /** Whether this card's pack is the currently active one (selected ring). */
  isActive: boolean;
  /** Apply this pack — the caller wires this to `applyThemePack(meta.slug)`;
   *  this component stays a plain presentational click forwarder. */
  onSelect: () => void;
}

/**
 * One theme-pack preview card: a mini "Aa Heading" / prose+link / code-line
 * sample painted from `meta.preview[mode]`, plus name, Light/Dark badge, and
 * description. Clicking applies the pack immediately (the dialog stays open
 * — ADR Decision 7 — so the selected ring is driven by `isActive`, not by
 * the click itself).
 */
export function ThemePackCard({ meta, mode, isActive, onSelect }: ThemePackCardProps): VNode {
  const swatches = meta.preview[mode];
  const fontCaption = meta.fonts.display ?? meta.fonts.sans;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isActive}
      aria-label={`Apply ${meta.name} theme pack — ${meta.mode === "dark" ? "Dark" : "Light"}. ${meta.description}`}
      className={`flex flex-col gap-vsp-2xs rounded-lg border p-hsp-sm text-left transition-colors focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 ${
        isActive ? "border-accent ring-2 ring-accent" : "border-muted hover:border-accent"
      }`}
    >
      <div
        aria-hidden="true"
        className="flex flex-col gap-vsp-3xs rounded-md border p-hsp-sm"
        style={{
          backgroundColor: swatches.bg,
          color: swatches.fg,
          borderColor: `color-mix(in oklch, ${swatches.fg} 15%, transparent)`,
        }}
      >
        <p className="text-title font-bold">Aa Heading</p>
        <p className="text-small">
          The quick brown fox jumps over{" "}
          <span className="underline" style={{ color: swatches.accent }}>
            the lazy dog
          </span>
          .
        </p>
        <p
          className="rounded px-hsp-2xs py-hsp-3xs font-mono text-caption"
          style={{ backgroundColor: `color-mix(in oklch, ${swatches.fg} 8%, transparent)` }}
        >
          <span style={{ color: swatches.syntax.keyword }}>const</span>{" "}
          <span style={{ color: swatches.syntax.callable }}>theme</span> ={" "}
          <span style={{ color: swatches.syntax.string }}>"{meta.slug}"</span>;{" "}
          <span style={{ color: swatches.syntax.comment }}>// {meta.mode}</span>
        </p>
      </div>
      <div className="flex items-center justify-between gap-hsp-sm">
        <span className="min-w-0 truncate text-body font-bold text-fg">{meta.name}</span>
        <span className="shrink-0 rounded-full border border-muted px-hsp-sm text-micro tracking-wide text-muted uppercase">
          {meta.mode === "dark" ? "Dark" : "Light"}
        </span>
      </div>
      <p className="text-caption text-muted">{meta.description}</p>
      <p className="text-micro text-muted">{fontCaption}</p>
    </button>
  );
}
