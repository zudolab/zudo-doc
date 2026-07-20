/**
 * scripts/theme-a11y-inventory.ts
 *
 * The fixed element inventory the theme-a11y audit measures, plus the
 * self-contained browser-side collector. Selectors follow the DOM/state
 * contracts locked by the epic's "Chrome DOM hooks" reference (#3030) and
 * `packages/zudo-doc/docs/adr/theme-packs.md`.
 *
 * `collectSamplesInBrowser` is serialized and run inside the page by
 * Playwright — it MUST stay a pure function of its `payload` argument + browser
 * globals (no module-scope references, no imports at runtime). It only gathers
 * raw computed-style strings; all interpretation happens in
 * `theme-a11y-evaluator.ts` back in Node.
 */

import type { ElementKind, RawSample } from "./theme-a11y-evaluator";

export interface InventoryItem {
  /** Stable report key + coverage group name. */
  key: string;
  selector: string;
  kind: ElementKind;
  /** Max elements to sample for this item (bounds the state's work). */
  cap: number;
  /** Whether to additionally re-measure the first match under `:hover`. */
  hover: boolean;
  /** Reported state label for the static pass. */
  state: "static" | "active";
}

/**
 * The inventory. `active` items target the `aria-current` variants; `hover`
 * items are re-measured with the pointer over the first match. Groups named in
 * `COVERAGE_CONTRACT` (header-nav, sidebar-link, toc-link, content-heading,
 * content-paragraph, admonition-title/-body, pager-link) are required; the
 * rest are measured-if-present.
 */
export const INVENTORY: readonly InventoryItem[] = [
  // ── Header ──────────────────────────────────────────────
  {
    key: "header-nav",
    selector: 'header[data-header] a[data-nav-item]:not([aria-current="page"])',
    kind: "text",
    cap: 8,
    hover: true,
    state: "static",
  },
  {
    key: "header-nav-active",
    selector: 'header[data-header] a[data-nav-item][aria-current="page"]',
    kind: "text",
    cap: 2,
    hover: true,
    state: "active",
  },
  // A dropdown nav item puts `data-nav-item`+`data-nav-item-dropdown` on a
  // wrapper <div>; the aria-current + the actual ink live on its child
  // `> a` (header.tsx). Sample that anchor (inactive + active), NOT the wrapper
  // — the wrapper only shows inherited styles, and its active anchor would
  // otherwise never gate.
  {
    key: "header-nav-dropdown",
    selector: 'header[data-header] [data-nav-item-dropdown] > a:not([aria-current="page"])',
    kind: "text",
    cap: 4,
    hover: true,
    state: "static",
  },
  {
    key: "header-nav-dropdown-active",
    selector: 'header[data-header] [data-nav-item-dropdown] > a[aria-current="page"]',
    kind: "text",
    cap: 2,
    hover: true,
    state: "active",
  },
  {
    key: "header-nav-chevron",
    selector: "header[data-header] [data-nav-item-dropdown] svg",
    kind: "ui",
    cap: 4,
    hover: false,
    state: "static",
  },
  {
    key: "header-more-toggle",
    selector: "header[data-header] [data-nav-more-toggle]",
    kind: "text",
    cap: 2,
    hover: true,
    state: "static",
  },
  {
    key: "header-logo",
    selector: "header[data-header] [data-header-logo]",
    kind: "decorative",
    cap: 1,
    hover: false,
    state: "static",
  },
  // A header-right control may bear TEXT (e.g. the version-switcher label) as
  // well as an icon. Measure the button's label as text (4.5:1) AND its icon
  // ink as a UI indicator (3.0:1) — a single `ui` sample would ignore the
  // label and under-gate it. Icon-only buttons carry no text, so the text
  // sample self-drops (empty textContent) and only the icon sample remains.
  {
    key: "header-right",
    selector: "header[data-header] [data-header-right] button",
    kind: "text",
    cap: 6,
    hover: false,
    state: "static",
  },
  {
    key: "header-right-icon",
    selector: "header[data-header] [data-header-right] button svg",
    kind: "ui",
    cap: 6,
    hover: false,
    state: "static",
  },
  // ── Sidebar ─────────────────────────────────────────────
  {
    key: "sidebar-link",
    selector: "aside#desktop-sidebar a",
    kind: "text",
    cap: 14,
    hover: true,
    state: "static",
  },
  {
    key: "sidebar-active-leaf",
    selector: 'aside#desktop-sidebar a[aria-current="page"][data-nav-active]',
    kind: "text",
    cap: 1,
    hover: true,
    state: "active",
  },
  // ── TOC ─────────────────────────────────────────────────
  {
    key: "toc-link",
    selector: "nav[data-zd-toc] a",
    kind: "text",
    cap: 10,
    hover: false,
    state: "static",
  },
  {
    key: "toc-active",
    selector: 'nav[data-zd-toc] a[aria-current="true"]',
    kind: "text",
    cap: 1,
    hover: false,
    state: "active",
  },
  // ── Breadcrumb ──────────────────────────────────────────
  {
    key: "breadcrumb-link",
    selector: 'nav[aria-label="Breadcrumb"] a',
    kind: "text",
    cap: 5,
    hover: false,
    state: "static",
  },
  {
    key: "breadcrumb-current",
    selector: 'nav[aria-label="Breadcrumb"] li > span',
    kind: "text",
    cap: 2,
    hover: false,
    state: "static",
  },
  // ── Content (.zd-content) ───────────────────────────────
  {
    key: "content-heading",
    selector: "main h1, .zd-content h2, .zd-content h3",
    kind: "text",
    cap: 8,
    hover: false,
    state: "static",
  },
  {
    key: "content-paragraph",
    selector: ".zd-content p",
    kind: "text",
    cap: 8,
    hover: false,
    state: "static",
  },
  {
    key: "content-link",
    selector: ".zd-content a",
    kind: "text",
    cap: 6,
    hover: true,
    state: "static",
  },
  {
    key: "content-code",
    selector: ".zd-content pre.hi-root",
    kind: "text",
    cap: 4,
    hover: false,
    state: "static",
  },
  {
    key: "admonition-title",
    selector: ".zd-content [data-admonition] .admonition-title",
    kind: "text",
    cap: 8,
    hover: false,
    state: "static",
  },
  {
    key: "admonition-body",
    selector: ".zd-content [data-admonition] .admonition-body",
    kind: "text",
    cap: 8,
    hover: false,
    state: "static",
  },
  // ── Pager ───────────────────────────────────────────────
  {
    key: "pager-link",
    selector: "nav[data-doc-pager] > a",
    kind: "text",
    cap: 2,
    hover: true,
    state: "static",
  },
  // ── Footer ──────────────────────────────────────────────
  {
    key: "footer-link",
    selector: "footer[data-footer] a",
    kind: "text",
    cap: 8,
    hover: false,
    state: "static",
  },
];

export interface CollectPayload {
  items: InventoryItem[];
  /** When set, overrides each sample's reported state (used for the hover pass). */
  stateOverride?: string;
  /** When true, only the FIRST match of each item is collected (hover pass). */
  firstOnly?: boolean;
}

/**
 * Browser-side collector. Serialized by Playwright — keep it self-contained.
 * Returns one `RawSample` per matched, VISIBLE element (hidden / zero-box /
 * empty-text elements are excluded from "matched" so mobile-only chrome and
 * icon-only links don't distort coverage).
 */
export function collectSamplesInBrowser(payload: CollectPayload): RawSample[] {
  const items = payload.items;
  const stateOverride = payload.stateOverride;
  const firstOnly = payload.firstOnly === true;

  const toWeight = (w: string): number => {
    const n = parseInt(w, 10);
    return Number.isFinite(n) ? n : 400;
  };

  const isVisible = (el: Element, cs: CSSStyleDeclaration): boolean => {
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const collect = (el: Element, item: InventoryItem): RawSample | null => {
    const cs = getComputedStyle(el);
    if (!isVisible(el, cs)) return null;

    const text = (el.textContent ?? "").trim();
    // Text-kind elements with no rendered text (icon-only links) aren't
    // text-contrast subjects — drop them rather than SKIP.
    if (item.kind === "text" && text.length === 0) return null;

    const chain: RawSample["chain"] = [];
    let node: Element | null = el;
    while (node) {
      const s = getComputedStyle(node);
      const op = parseFloat(s.opacity);
      chain.push({
        backgroundColor: s.backgroundColor,
        backgroundImage: s.backgroundImage,
        opacity: Number.isFinite(op) ? op : 1,
      });
      node = node.parentElement;
    }

    const mkPseudo = (pe: string): RawSample["pseudos"][number] => {
      const p = getComputedStyle(el, pe);
      return { backgroundColor: p.backgroundColor, backgroundImage: p.backgroundImage, position: p.position };
    };
    const pseudos = [mkPseudo("::before"), mkPseudo("::after")];

    let svg: RawSample["svg"] = null;
    if (item.kind === "ui") {
      const svgEl = el.tagName.toLowerCase() === "svg" ? el : el.querySelector("svg");
      if (svgEl) {
        const ss = getComputedStyle(svgEl);
        svg = { fill: ss.fill, stroke: ss.stroke };
      }
    }

    return {
      elementKey: item.key,
      selector: item.selector,
      state: stateOverride ?? item.state,
      kind: item.kind,
      color: cs.color,
      fontSizePx: parseFloat(cs.fontSize) || 16,
      fontWeight: toWeight(cs.fontWeight),
      chain,
      pseudos,
      svg,
      text: text.slice(0, 60),
    };
  };

  const out: RawSample[] = [];
  for (const item of items) {
    const matches = Array.from(document.querySelectorAll(item.selector));
    const limit = firstOnly ? 1 : item.cap;
    let taken = 0;
    for (const el of matches) {
      if (taken >= limit) break;
      const sample = collect(el, item);
      if (sample) {
        out.push(sample);
        taken++;
      }
    }
  }
  return out;
}
