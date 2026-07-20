// Single source of truth for the header desktop-nav class tokens that must
// stay in lockstep between the SSR markup (`header.tsx`) and the runtime
// rebuild/toggle script (`nav-overflow-script.ts`).
//
// WHY THIS MODULE EXISTS: the same class strings used to live, duplicated, in
// both files. `header.tsx` paints the active nav item on first render; the
// inline script re-paints it after SPA navigation and rebuilds the "···"
// overflow menu — so both files have to agree on the exact class lists. That
// duplicated knowledge drifted twice (zudolab/zudo-doc#3011 stale-class after
// navigation, #3016 divergence), each caught only by a throwaway script. Both
// files now derive their class strings from the arrays below, so the two can
// no longer silently diverge (guard: #3023).
//
// Tokens are ARRAYS, not whole strings, because the two consumers need
// different shapes: `header.tsx` joins them into `class={}` attributes, while
// the script both spreads them into `classList.add/remove(...)` calls and
// joins them into `className` assignments. Keeping them composable per-part
// also lets the overflow-menu recipes (which intentionally differ from the
// header-bar items in padding/weight/base) reuse the shared color tokens
// instead of re-typing them.

// ── Header-bar top-level item: active-state color toggle ─────────────────
// setTopActive() (script) ↔ the top-level <a> in renderNavItem() (SSR).
export const NAV_TOP_ACTIVE: readonly string[] = ["bg-fg", "text-bg"];
export const NAV_TOP_INACTIVE: readonly string[] = [
  "text-muted",
  "hover:text-accent",
  "hover:underline",
  "focus:underline",
  "focus:text-accent",
];

// ── Header-bar dropdown chevron SVG: active-state color toggle ───────────
// applyActiveNav() (script) ↔ the chevron <svg> in renderNavItem() (SSR).
export const NAV_CHEVRON_ACTIVE: readonly string[] = ["text-bg"];
export const NAV_CHEVRON_INACTIVE: readonly string[] = ["text-muted"];

// ── Header-bar dropdown child link: active-state color toggle ────────────
// applyActiveNav() (script) ↔ the child <a> in renderNavItem() (SSR). The
// static base (`block px-hsp-md ... focus-visible:underline`) stays inline in
// header.tsx — the script never rewrites it, so it can't drift across files.
export const NAV_CHILD_ACTIVE: readonly string[] = ["font-bold", "text-accent"];
export const NAV_CHILD_INACTIVE: readonly string[] = [
  "text-fg",
  "hover:text-accent",
  "focus-visible:text-accent",
];

// ── Overflow "···" menu row recipes ──────────────────────────────────────
// Assembled at runtime by update() in nav-overflow-script.ts. These are menu
// rows (indented, their own padding/weight), NOT header-bar items, so they
// intentionally differ from the toggle groups above. Co-located here so the
// whole header-nav class vocabulary has one home; the shared color tokens
// (e.g. NAV_CHILD_ACTIVE = "font-bold text-accent") are literally reused.
const MENU_ROW_BASE: readonly string[] = [
  "block",
  "px-hsp-md",
  "py-vsp-2xs",
  "text-small",
];
const MENU_CHILD_BASE: readonly string[] = [
  "block",
  "pl-hsp-xl",
  "pr-hsp-md",
  "py-vsp-2xs",
  "text-small",
];
// Resting (inactive) interactive appearance shared by the parent + plain rows.
const MENU_ROW_RESTING: readonly string[] = [
  "hover:bg-accent/10",
  "hover:underline",
  "focus-visible:underline",
  "focus-visible:text-accent",
  "text-fg",
  "hover:text-accent",
];

// Overflow bucket: promoted dropdown-parent link (bold label). Active rows
// additionally get NAV_MENU_PARENT_ACTIVE_SUFFIX appended.
export const NAV_MENU_PARENT: readonly string[] = [
  ...MENU_ROW_BASE,
  "font-bold",
  ...MENU_ROW_RESTING,
];
export const NAV_MENU_PARENT_ACTIVE_SUFFIX: readonly string[] = ["text-accent"];

// Overflow bucket: plain (non-dropdown) item link. Active rows additionally
// get NAV_MENU_PLAIN_ACTIVE_SUFFIX (= NAV_CHILD_ACTIVE) appended.
export const NAV_MENU_PLAIN: readonly string[] = [
  ...MENU_ROW_BASE,
  ...MENU_ROW_RESTING,
];
export const NAV_MENU_PLAIN_ACTIVE_SUFFIX: readonly string[] = [
  ...NAV_CHILD_ACTIVE,
];

// Overflow bucket: indented dropdown-child link (active vs resting variants
// are whole strings — the resting variant interleaves menu affordances with
// the child color tokens, so it is spelled out rather than composed).
export const NAV_MENU_CHILD_ACTIVE: readonly string[] = [
  ...MENU_CHILD_BASE,
  ...NAV_CHILD_ACTIVE,
  "hover:bg-accent/10",
  "hover:underline",
  "focus-visible:underline",
];
export const NAV_MENU_CHILD_INACTIVE: readonly string[] = [
  ...MENU_CHILD_BASE,
  "text-fg",
  "hover:bg-accent/10",
  "hover:text-accent",
  "hover:underline",
  "focus-visible:underline",
  "focus-visible:text-accent",
];
