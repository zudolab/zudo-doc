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
// back them are emitted by the `gen-component-tokens` generator (mirroring the
// `z-index-tokens.ts` + `gen-z-index` codegen pattern), which READS this list
// and routes each rule by its `surface`:
//   - `surface: "content"` → a `BEGIN/END`-marked block in `src/content.css`
//     (shipped to consumers as `@takazudo/zudo-doc/content.css`).
//   - `surface: "chrome"`  → a `BEGIN/END`-marked block in `src/features.css`
//     (shipped as `@takazudo/zudo-doc/features.css`) for app-shell components
//     (header/footer/sidebar/toc/cards). Seeded empty — no chrome tokens yet.
// Both blocks stay UNLAYERED, mirroring each other. Each rule:
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
export type ComponentTokenCategory = "typography" | "shape" | "layout";

/**
 * Which rendering surface a token's backing rule targets — drives WHERE the
 * generator emits the rule:
 *   - `content` → the `.zd-content` typography surface; rule lands in the
 *     BEGIN/END block in `src/content.css` (shipped as `…/content.css`).
 *   - `chrome`  → the app shell (header/footer/sidebar/toc/cards); rule lands
 *     in the BEGIN/END block in `src/features.css` (shipped as `…/features.css`).
 * The two surfaces ship as separate stylesheets, so a token MUST declare its
 * surface — the generator routes by it and fails loudly when it is absent.
 */
export type ComponentTokenSurface = "content" | "chrome";

/**
 * Union of every `--zdc-*` CSS custom property name in the registry.
 * Provides autocomplete when a consumer iterates or references individual tokens.
 * Must be kept in sync with the `cssVar` values in `COMPONENT_TOKENS` below.
 */
export type ComponentTokenName =
  | "--zdc-doc-title-font"
  | "--zdc-doc-title-weight"
  | "--zdc-doc-title-tracking"
  | "--zdc-doc-h2-font"
  | "--zdc-doc-h2-weight"
  | "--zdc-doc-h2-tracking"
  | "--zdc-doc-h3-weight"
  | "--zdc-doc-h4-weight"
  | "--zdc-doc-prose-font"
  | "--zdc-doc-link-decoration"
  | "--zdc-admonition-radius"
  | "--zdc-admonition-border-width"
  | "--zdc-card-radius"
  | "--zdc-content-max-width"
  | "--zdc-toc-width";

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
   * Default value used as the `var(<cssVar>, <default>)` fallback. SHOULD chain
   * to an existing design token or `inherit` so consumer `@theme` overrides flow
   * through. Bare CSS literals (e.g. `4px`, `underline`) are allowed only when
   * no design token exists for the property — document the exception in the
   * snapshot test. The rendered default MUST be byte-identical to the pre-token
   * output in every case.
   */
  default: string;
  /** The component this token rebrands (e.g. `doc-title`). */
  component: string;
  /**
   * Rendering surface the backing rule targets. The generator routes the rule
   * to `content.css` (`content`) or `features.css` (`chrome`) by this field.
   * Required — codegen throws if it is missing.
   */
  surface: ComponentTokenSurface;
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
    surface: "content",
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
    surface: "content",
    category: "typography",
    description:
      "Font weight of the doc-page title <h1> (and the other page-title h1s that share `text-heading`). Defaults to the `--font-weight-bold` token (matching the original `font-bold` utility).",
  },
  // `--tracking-normal: normal` (S2 scale token) — letter-spacing chains to the
  // global scale so a consumer can override the entire scale in one place.
  // Byte-identical because `normal` is the browser default for letter-spacing.
  {
    cssVar: "--zdc-doc-title-tracking",
    selector: "h1.text-heading",
    property: "letter-spacing",
    default: "var(--tracking-normal)",
    component: "doc-title",
    surface: "content",
    category: "typography",
    description:
      "Letter spacing of the doc-page title <h1> (and the other page-title h1s that share `text-heading`). Defaults to `var(--tracking-normal)` (resolves to `normal` — byte-identical to the browser default); redefine in :root or tighten via `--tracking-tight`.",
  },
  // ── Content heading h2 (HeadingH2 component, selector census: #2449) ───────
  // `h2.text-title` matches every h2 with the `text-title` size role in the
  // package: HeadingH2 content override (primary target), plus tag-section
  // headings on index/locale-index pages, versions-page section headers, and
  // modal headings (ai-chat, color-tweak-export). All share identical
  // `text-title font-bold` styling — a semantically-consistent superset
  // analogous to `h1.text-heading`. Byte-identical defaults produce zero
  // computed change; a `:root` override rebrands all consistently.
  {
    cssVar: "--zdc-doc-h2-font",
    selector: "h2.text-title",
    property: "font-family",
    default: "inherit",
    component: "heading-h2",
    surface: "content",
    category: "typography",
    description:
      "Font family of content h2 headings (HeadingH2 component and other h2s sharing `text-title`). Defaults to `inherit` so the heading keeps the host's brand font; redefine in :root to rebrand.",
  },
  {
    cssVar: "--zdc-doc-h2-weight",
    selector: "h2.text-title",
    property: "font-weight",
    default: "var(--font-weight-bold)",
    component: "heading-h2",
    surface: "content",
    category: "typography",
    description:
      "Font weight of content h2 headings (HeadingH2 component and other h2s sharing `text-title`). Defaults to the `--font-weight-bold` token (matching the original `font-bold` utility).",
  },
  {
    cssVar: "--zdc-doc-h2-tracking",
    selector: "h2.text-title",
    property: "letter-spacing",
    default: "var(--tracking-normal)",
    component: "heading-h2",
    surface: "content",
    category: "typography",
    description:
      "Letter spacing of content h2 headings (HeadingH2 component and other h2s sharing `text-title`). Defaults to `var(--tracking-normal)` (byte-identical to the browser default); redefine in :root to tighten or widen.",
  },
  // ── Content heading h3 (HeadingH3 component, selector census: #2449) ───────
  // `h3.text-body.font-bold` is unique to the HeadingH3 component — no other
  // h3 in the package emits both `text-body` and `font-bold`.
  {
    cssVar: "--zdc-doc-h3-weight",
    selector: "h3.text-body.font-bold",
    property: "font-weight",
    default: "var(--font-weight-bold)",
    component: "heading-h3",
    surface: "content",
    category: "typography",
    description:
      "Font weight of content h3 headings (HeadingH3 component). Defaults to the `--font-weight-bold` token (matching the original `font-bold` utility).",
  },
  // ── Content heading h4 (HeadingH4 component, selector census: #2449) ───────
  // `h4.text-body.font-semibold` is unique to the HeadingH4 component — no
  // other h4 in the package emits both `text-body` and `font-semibold`.
  {
    cssVar: "--zdc-doc-h4-weight",
    selector: "h4.text-body.font-semibold",
    property: "font-weight",
    default: "var(--font-weight-semibold)",
    component: "heading-h4",
    surface: "content",
    category: "typography",
    description:
      "Font weight of content h4 headings (HeadingH4 component). Defaults to the `--font-weight-semibold` token (matching the original `font-semibold` utility).",
  },
  // ── Content prose font (.zd-content, #2460) ────────────────────────────────
  // Sets font-family on the content root so every element inside inherits it by
  // default. The headings whose `--zdc-doc-*-font` default to `inherit` will
  // inherit this value — safe because the current computed heading family already
  // resolves to `var(--font-sans)` (Tailwind preflight sets it on `html`).
  // Byte-identical: `.zd-content` currently carries no explicit font-family, so
  // setting it to `var(--font-sans)` produces the same computed value.
  {
    cssVar: "--zdc-doc-prose-font",
    selector: ".zd-content",
    property: "font-family",
    default: "var(--font-sans)",
    component: "doc-prose",
    surface: "content",
    category: "typography",
    description:
      "Font family of the prose content area (.zd-content). Defaults to `var(--font-sans)` (the inherited font — byte-identical); redefine in :root to use a distinct body font for doc content. Headings with `--zdc-doc-*-font: inherit` inherit this value.",
  },
  // ── Content link (ContentLink component, styled path, #2460) ─────────────
  // ContentLink returns early (unstyled) for `block` and `hash-link` classes;
  // the styled path emits `text-accent underline hover:text-accent-hover`.
  // Selector `a.text-accent.underline` (specificity 0,2,1) beats the `.underline`
  // utility (0,1,0) and only matches the styled anchor — not block or hash-link
  // variants. Default `underline` is a CSS keyword literal: no text-decoration
  // token exists in the scale (documented exception to the prefer-var-() rule).
  {
    cssVar: "--zdc-doc-link-decoration",
    selector: "a.text-accent.underline",
    property: "text-decoration",
    default: "underline",
    component: "content-link",
    surface: "content",
    category: "typography",
    description:
      "Text decoration of styled content links (the `text-accent underline` path in ContentLink; excludes block and hash-link variants). Defaults to `underline` (byte-identical to the current utility). Set to `none` to remove underlines from content links.",
  },
  // ── Admonition block ([data-admonition], content-admonition.tsx, #2460) ───
  // The base `[data-admonition]` rule in content.css has:
  //   border-left: 4px solid var(--color-muted);
  //   border-radius: 0 var(--radius-DEFAULT) var(--radius-DEFAULT) 0;
  // Both properties are tokenized below. The token rules land in the BEGIN/END
  // block (after the base rule in source order), so at equal specificity the
  // token defaults override the originals — byte-identical because the defaults
  // ARE the original values.
  // Exception: `4px` is a bare literal — no border-width scale token exists.
  {
    cssVar: "--zdc-admonition-radius",
    selector: "[data-admonition]",
    property: "border-radius",
    default: "0 var(--radius-DEFAULT) var(--radius-DEFAULT) 0",
    component: "admonition",
    surface: "content",
    category: "shape",
    description:
      "Border radius of the admonition/callout block. Defaults to the current value (0 on the left edges, `--radius-DEFAULT` on the right — preserving the flush-left accent look); redefine to round all corners or square them off.",
  },
  {
    cssVar: "--zdc-admonition-border-width",
    selector: "[data-admonition]",
    property: "border-left-width",
    default: "4px",
    component: "admonition",
    surface: "content",
    category: "shape",
    description:
      "Width of the admonition left accent border. Defaults to `4px` (byte-identical to the current `border-left: 4px solid` rule). No border-width scale token exists — bare literal is the documented exception.",
  },
  // ── Card radius (nav-indexing card grids, chrome, #2461) ──────────────────
  // Selector census: `a.group.block` also appears in search-widget-script
  // (search result link: `class="group block px-hsp-lg py-vsp-sm ..."`).
  // Adding `.rounded` (present on all three card anchors — doc-card-grid,
  // nav-card-grid, category-nav — and absent from the search result link)
  // makes the selector unique to cards. `a.group.block.rounded` specificity
  // 0,3,1 beats `.rounded` utility (0,1,0); unlayered beats layered (@layer
  // utilities). No JSX change needed — cards already emit `rounded`.
  // `--zdc-surface-radius` is a consumer meta-knob: NOT a registry entry
  // (no single backing selector); it lives only in this default chain so a
  // consumer can set `--zdc-surface-radius` in :root to round all surfaces.
  {
    cssVar: "--zdc-card-radius",
    selector: "a.group.block.rounded",
    property: "border-radius",
    default: "var(--zdc-surface-radius, var(--radius-DEFAULT))",
    component: "card-grid",
    surface: "chrome",
    category: "shape",
    description:
      "Border radius of the nav/doc card anchor (doc-card-grid, nav-card-grid, category-nav). Defaults to `var(--zdc-surface-radius, var(--radius-DEFAULT))` — chains through the meta-knob so setting `--zdc-surface-radius` in :root rounds all surfaces at once.",
  },
  // ── Content band max-width (.zd-doc-content-band, chrome, #2461) ──────────
  // Two widths exist in doc-layout.tsx:
  //   • showSidebar=true:  max-w-[clamp(50rem,75vw,90rem)] → tokenized here
  //   • showSidebar=false: max-w-[80rem] → replaced by `data-zd-nosidebar`
  //     attr on the band div + `.zd-doc-content-band[data-zd-nosidebar]` rule
  //     in features.css (unlayered, specificity 0,2,0 > token rule 0,1,0).
  // Token rule is unlayered and beats the Tailwind utility (layered). The
  // `max-w-[clamp(50rem,75vw,90rem)]` JSX class is removed from the sidebar
  // branch; default value is the transcribed literal — byte-identical.
  // JS-toggle (html[data-sidebar-hidden]) remains covered by the existing
  // `html[data-sidebar-hidden] .zd-doc-content-band` rule (specificity 0,2,1).
  // Exception: `clamp(50rem,75vw,90rem)` is a bare CSS function expression —
  // no equivalent design token exists (documented exception to the prefer-var()).
  {
    cssVar: "--zdc-content-max-width",
    selector: ".zd-doc-content-band",
    property: "max-width",
    default: "clamp(50rem,75vw,90rem)",
    component: "doc-content-band",
    surface: "chrome",
    category: "layout",
    description:
      "Max width of the doc reading column (sidebar-present case). Defaults to `clamp(50rem,75vw,90rem)` (byte-identical to the current utility). The hide_sidebar 80rem variant is handled by `.zd-doc-content-band[data-zd-nosidebar]` in features.css; the JS-toggle variant by `html[data-sidebar-hidden] .zd-doc-content-band`.",
  },
  // ── TOC width (nav[data-zd-toc], chrome, #2461) ───────────────────────────
  // `nav[aria-label="Table of contents"]` has inner quotes so the parseTokens
  // regex (which matches double-quoted strings) cannot handle it as a bare
  // double-quoted field. `data-zd-toc` is added to the nav element in
  // toc.tsx instead, making the selector parser-safe and an explicit anchor.
  // Specificity 0,1,1 (element + attribute) beats `w-[280px]` (0,1,0);
  // unlayered beats layered (@layer utilities).
  // Exception: `280px` is a bare pixel literal — no fixed-width token exists
  // (documented exception to the prefer-var-() rule).
  {
    cssVar: "--zdc-toc-width",
    selector: "nav[data-zd-toc]",
    property: "width",
    default: "280px",
    component: "toc",
    surface: "chrome",
    category: "layout",
    description:
      "Width of the desktop Table of Contents right rail. Defaults to `280px` (byte-identical to the current `w-[280px]` utility in toc.tsx). No fixed-width design token exists — bare literal is the documented exception.",
  },
];
