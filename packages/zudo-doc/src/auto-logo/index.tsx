/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// auto-logo — deterministic generated fallback logo for the home hero.
//
// A fresh scaffold ships no `/img/logo.svg`, which used to leave the hero's
// mask block rendering against a missing asset. When `settings.logo` is
// `"auto"` (the default), `HomePageView` renders this component instead: a
// "decorated plate" SVG — plate + thin inner frame + diagonal corner rays +
// centered disc + a line-art glyph — generated purely from the site name.
// Same seed always produces the same logo; no stored asset, no client JS.
//
// Color contract: the plate fills `currentColor` (give the element `text-fg`)
// and every frame line / disc knockout uses `var(--color-bg)` so the logo
// sits visually "knocked out" against the page background and adapts to
// light/dark automatically. The visual recipe is the `plate-rays-icon`
// variant picked from the design prototype (cclogs `auto-logo-gen`).

import type { JSX } from "preact";

/** FNV-1a 32-bit hash — the deterministic seed source. */
function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Knockout color — page background (see the color contract above). */
const KO = "var(--color-bg)";

/** Line-art glyphs drawn in a 100×100 box centered at (50,50). */
const GLYPHS: Record<string, () => JSX.Element> = {
  book: () => (
    <g>
      <path
        d="M50 30 C42 24, 30 23, 22 26 L22 68 C30 65, 42 66, 50 72 C58 66, 70 65, 78 68 L78 26 C70 23, 58 24, 50 30 Z"
        fill="none"
        stroke="currentColor"
        stroke-width="6"
        stroke-linejoin="round"
      />
      <line x1="50" y1="30" x2="50" y2="72" stroke="currentColor" stroke-width="5" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <line x1="29" y1={38 + i * 10} x2="43" y2={40 + i * 10} stroke="currentColor" stroke-width="4" stroke-linecap="round" />
          <line x1="57" y1={40 + i * 10} x2="71" y2={38 + i * 10} stroke="currentColor" stroke-width="4" stroke-linecap="round" />
        </g>
      ))}
    </g>
  ),
  doc: () => (
    <g>
      <path d="M32 22 L60 22 L70 32 L70 78 L32 78 Z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round" />
      <path d="M60 22 L60 32 L70 32" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round" />
      {[0, 1, 2].map((i) => (
        <line key={i} x1="40" y1={44 + i * 11} x2="62" y2={44 + i * 11} stroke="currentColor" stroke-width="4" stroke-linecap="round" />
      ))}
    </g>
  ),
  bookmark: () => (
    <g>
      <path d="M34 22 L66 22 L66 78 L50 64 L34 78 Z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round" />
      <line x1="42" y1="36" x2="58" y2="36" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
    </g>
  ),
  compass: () => (
    <g>
      <circle cx="50" cy="50" r="26" fill="none" stroke="currentColor" stroke-width="6" />
      <path d="M60 40 L54 56 L40 60 L46 44 Z" fill="currentColor" />
    </g>
  ),
  terminal: () => (
    <g>
      <rect x="24" y="30" width="52" height="40" rx="5" fill="none" stroke="currentColor" stroke-width="6" />
      <path d="M33 42 L41 50 L33 58" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
      <line x1="47" y1="58" x2="60" y2="58" stroke="currentColor" stroke-width="5" stroke-linecap="round" />
    </g>
  ),
  bulb: () => (
    <g>
      <path
        d="M50 22 C37 22, 30 32, 30 41 C30 49, 35 53, 39 58 L39 64 L61 64 L61 58 C65 53, 70 49, 70 41 C70 32, 63 22, 50 22 Z"
        fill="none"
        stroke="currentColor"
        stroke-width="6"
        stroke-linejoin="round"
      />
      <line x1="42" y1="71" x2="58" y2="71" stroke="currentColor" stroke-width="5" stroke-linecap="round" />
      <line x1="45" y1="78" x2="55" y2="78" stroke="currentColor" stroke-width="5" stroke-linecap="round" />
    </g>
  ),
  chat: () => (
    <g>
      <path
        d="M26 28 L74 28 L74 62 L48 62 L36 74 L36 62 L26 62 Z"
        fill="none"
        stroke="currentColor"
        stroke-width="6"
        stroke-linejoin="round"
      />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={38 + i * 12} cy="45" r="3" fill="currentColor" />
      ))}
    </g>
  ),
  layers: () => (
    <g>
      <path d="M50 22 L78 36 L50 50 L22 36 Z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round" />
      <path d="M25 47 L50 60 L75 47" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M25 58 L50 71 L75 58" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
    </g>
  ),
};

const GLYPH_NAMES = Object.keys(GLYPHS);

/** Deterministic glyph name for a seed (exported for tests). */
export function pickGlyphName(seed: string): string {
  return GLYPH_NAMES[hashString(seed) % GLYPH_NAMES.length]!;
}

/** Props for {@link AutoLogo}. */
export interface AutoLogoProps {
  /** Deterministic seed — pass `settings.siteName`. */
  seed: string;
  /** Class list for the root `<svg>` (sizing/color, e.g. `w-[320px] text-fg`). */
  class?: string;
}

// Plate geometry (viewBox units). 200:105 matches the hero slot's
// 1200:630 aspect so the plate fills the logo area edge-to-edge.
const W = 200;
const H = 105;
const INSET = 6;
const CX = W / 2;
const CY = H / 2;
const DISC_R = 34;

/**
 * Generated "decorated plate" logo — plate + frame + corner rays + disc +
 * seeded line-art glyph. Server-rendered, deterministic per seed.
 */
export function AutoLogo({ seed, class: className }: AutoLogoProps): JSX.Element {
  const glyphName = pickGlyphName(seed);
  const Glyph = GLYPHS[glyphName]!;

  const corners: Array<[number, number]> = [
    [INSET, INSET],
    [W - INSET, INSET],
    [INSET, H - INSET],
    [W - INSET, H - INSET],
  ];
  const rays = corners.map(([x, y]) => {
    const dx = CX - x;
    const dy = CY - y;
    const len = Math.hypot(dx, dy);
    // Stop each ray just short of the disc edge.
    const stop = (len - DISC_R - 7) / len;
    return { x1: x, y1: y, x2: x + dx * stop, y2: y + dy * stop };
  });

  // Scale the 100×100 glyph box into the disc (slight overscan reads better).
  const scale = ((DISC_R * 2) / 100) * 1.05;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      fill="currentColor"
      class={className}
      data-auto-logo={glyphName}
      aria-hidden="true"
    >
      <rect x="0" y="0" width={W} height={H} />
      <rect
        x={INSET}
        y={INSET}
        width={W - INSET * 2}
        height={H - INSET * 2}
        fill="none"
        stroke={KO}
        stroke-width="1.6"
      />
      {rays.map((r, i) => (
        <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke={KO} stroke-width="1.4" />
      ))}
      <circle cx={CX} cy={CY} r={DISC_R} fill={KO} />
      <g transform={`translate(${CX - 50 * scale}, ${CY - 50 * scale}) scale(${scale})`}>
        <Glyph />
      </g>
    </svg>
  );
}
