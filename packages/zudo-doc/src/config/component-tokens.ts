// Component-level semantic CSS tokens (`--zdc-*`) — single source of truth.
//
// Epic zudolab/zudo-doc#2446 (foundation: #2447). The `@takazudo/zudo-doc`
// package hardcodes Tailwind utility classes in component JSX (e.g. the
// doc-page title `<h1 class="text-heading font-bold">`). Consumers who want a
// different look previously had only two bad doors: fight unlayered-utility
// specificity with `!important`, or eject the whole component. This registry
// extends the proven color model (`--zd-*` tokens redefined in `:root`) to a
// curated set of component-level rebrand knobs named `--zdc-*`.
//
// ── How it ships (mechanism) ───────────────────────────────────────────────
// This file is the ONE place `--zdc-*` tokens are defined. The CSS rules that
// back them live in a `BEGIN/END`-marked block in `src/content.css` (shipped
// to consumers as `@takazudo/zudo-doc/content.css`). Wave 2 (#2448) adds the
// `gen-component-tokens` generator that READS this list and rewrites that
// block (mirroring the `z-index-tokens.ts` + `gen-z-index` codegen pattern);
// until then the block is maintained by hand to match what the generator will
// emit. Each rule:
//   - targets an ALREADY-RENDERED, component-anchored selector (the classes the
//     component already emits) so NO JSX/class change is needed;
//   - has enough specificity to beat the consumer's UNLAYERED Tailwind
//     utilities, and stays UNLAYERED itself (NOT inside `@layer zd-flow`);
//   - uses a `default` that chains to an existing token or `inherit` — NEVER a
//     literal — so the rendered default is BYTE-IDENTICAL to the pre-token
//     output (the #2425 route-injection byte-hash gate stays green) and
//     consumer `@theme` overrides keep flowing through.
// The generator groups entries by `selector` and emits one rule per selector,
// e.g. `h1.text-heading { font-family: var(--zdc-doc-title-font, inherit);
// font-weight: var(--zdc-doc-title-weight, var(--font-weight-bold)); }`.
//
// ── Token shape: composite vs granular (per #2443 "prefer composite tokens") ─
// The discipline from #2443 is to PREFER a composite token over many granular
// ones WHERE that does not lose needed control (tight-token discipline — do not
// tokenize every property reflexively). For doc-title typography the candidate
// composite is a single `--zdc-doc-title` holding a CSS `font` shorthand value.
// We deliberately chose GRANULAR per-property tokens (`-font` for font-family,
// `-weight` for font-weight) instead, because the `font` shorthand RESETS every
// sub-property it does not name (font-size, line-height, font-style,
// font-variant, …) to its initial value. A composite `font` token would
// therefore (a) break the byte-identical default (it would force a size and
// wipe line-height) and (b) REDUCE control rather than add it (a rebrander
// could not change weight without also restating family/size). Composite is the
// right call only when the sub-properties always move together AND the
// shorthand does not reset unrelated state; `font` satisfies neither. The two
// knobs here are genuinely independent rebrand axes, so they stay separate.
// `--zdc-doc-title-size` is intentionally DEFERRED: the anchored selector
// `h1.text-heading` is shared by several page-title h1s (see the selector note
// below), so adding a size knob now would resize all of them — out of scope for
// the font/weight regression this wave fixes.
//
// ── Selector note (census, #2447) ──────────────────────────────────────────
// The anchored selector for doc-title is `h1.text-heading` (specificity 0,1,1,
// beats the unlayered `.font-bold` utility at 0,1,0). A full census of the
// package shows `text-heading` is the shared "page title" size role: the same
// `h1.text-heading` markup is emitted by the doc-page title (doc-content-header
// — the primary target / the #2446 regression), tag pages, the home/index and
// locale-index pages, the nav-index auto-index (doc-page-shell) and the
// versions page. It is therefore a semantically-consistent SUPERSET — every
// match is a top-level page-title h1 with identical `text-heading font-bold`
// styling — NOT an accidental bleed. The 404 hero h1 is deliberately EXCLUDED:
// it uses `text-display`, not `text-heading`, so `h1.text-heading` never
// touches it. A bare `.zd-content h1` was rejected for exactly that reason
// (DocLayoutWithDefaults wraps 404/home/tag content in `.zd-content`, so it
// would have caught the 404 hero). With the byte-identical defaults the rule
// produces zero computed change on any of these pages; a consumer override of
// `--zdc-doc-title-*` rebrands every page-title h1 consistently, which is the
// intended behavior.

/** Grouping category for a component token (drives docs/registry sectioning). */
export type ComponentTokenCategory = "typography";

export interface ComponentToken {
  /**
   * The CSS custom-property name the consumer redefines in `:root`, e.g.
   * `--zdc-doc-title-font`. Always `--zdc-`-prefixed.
   */
  cssVar: `--zdc-${string}`;
  /**
   * The already-rendered, component-anchored selector the backing rule targets
   * (the classes the component already emits — no JSX change). Tokens sharing a
   * selector are emitted into a single CSS rule by the generator.
   */
  selector: string;
  /** The CSS property this token drives, e.g. `font-family`. */
  property: string;
  /**
   * Default value used as the `var(<cssVar>, <default>)` fallback. MUST chain to
   * an existing design token or `inherit` — never a literal — so the rendered
   * default is byte-identical to the pre-token output.
   */
  default: string;
  /** The component this token rebrands (e.g. `doc-title`). */
  component: string;
  /** Grouping category. */
  category: ComponentTokenCategory;
  /** Human-readable description for the registry/docs. */
  description: string;
}

export const COMPONENT_TOKENS: ComponentToken[] = [
  {
    cssVar: "--zdc-doc-title-font",
    selector: "h1.text-heading",
    property: "font-family",
    default: "inherit",
    component: "doc-title",
    category: "typography",
    description:
      "Font family of the doc-page title <h1> (and the other page-title h1s that share `text-heading`). Defaults to `inherit` so the title keeps the host's brand heading font; redefine in :root to rebrand.",
  },
  {
    cssVar: "--zdc-doc-title-weight",
    selector: "h1.text-heading",
    property: "font-weight",
    default: "var(--font-weight-bold)",
    component: "doc-title",
    category: "typography",
    description:
      "Font weight of the doc-page title <h1> (and the other page-title h1s that share `text-heading`). Defaults to the `--font-weight-bold` token (matching the original `font-bold` utility).",
  },
];
