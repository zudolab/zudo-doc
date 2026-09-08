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

import { COVERAGE_CONTRACT, PAGE_ADMONITIONS, PAGE_GETTING_STARTED } from "./theme-a11y-evaluator";
import type { ElementKind, RawSample } from "./theme-a11y-evaluator";

/**
 * Every inventory entry declares, explicitly, whether it is expected to
 * produce samples — and where. This is the counterpart to the deliberately
 * SCOPED zero-match check: a blanket "every inventory key must appear
 * somewhere" rule would false-fail on the genuinely conditional entries
 * (`header-more-toggle` is viewport-conditional; decorative samples never
 * enter the coverage counts at all). Declaring the expectation per entry keeps
 * "this matched zero and that is fine" a written decision rather than silence
 * (#4033).
 */
export type InventoryExpectation =
  | { kind: "required"; pages: readonly string[] }
  | { kind: "conditional"; reason: string };

const REQUIRED_ADMONITIONS: InventoryExpectation = { kind: "required", pages: [PAGE_ADMONITIONS] };
const REQUIRED_GETTING_STARTED: InventoryExpectation = {
  kind: "required",
  pages: [PAGE_GETTING_STARTED],
};
const REQUIRED_BOTH_PAGES: InventoryExpectation = {
  kind: "required",
  pages: [PAGE_ADMONITIONS, PAGE_GETTING_STARTED],
};
const conditional = (reason: string): InventoryExpectation => ({ kind: "conditional", reason });

export interface InventoryItem {
  /** Stable report key + coverage group name. */
  key: string;
  /** Declared coverage expectation — required on named pages, or conditional. */
  expectation: InventoryExpectation;
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
 * items are re-measured with the pointer over the first match. Each item's
 * `expectation` says which page's `COVERAGE_CONTRACT` requires it (or why it
 * is measured-if-present); `validateInventoryExpectations` keeps the two
 * declarations from drifting apart.
 */
export const INVENTORY: readonly InventoryItem[] = [
  // ── Header ──────────────────────────────────────────────
  {
    key: "header-nav",
    expectation: REQUIRED_BOTH_PAGES,
    selector: 'header[data-header] a[data-nav-item]:not([aria-current="page"])',
    kind: "text",
    cap: 8,
    hover: true,
    state: "static",
  },
  {
    key: "header-nav-active",
    expectation: REQUIRED_GETTING_STARTED,
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
    expectation: conditional(
      "only present while the nav config renders a dropdown whose anchor is NOT the active one; nav overflow at 1440px can hide it",
    ),
    selector: 'header[data-header] [data-nav-item-dropdown] > a:not([aria-current="page"])',
    kind: "text",
    cap: 4,
    hover: true,
    state: "static",
  },
  {
    key: "header-nav-dropdown-active",
    expectation: REQUIRED_ADMONITIONS,
    selector: 'header[data-header] [data-nav-item-dropdown] > a[aria-current="page"]',
    kind: "text",
    cap: 2,
    hover: true,
    state: "active",
  },
  {
    key: "header-nav-chevron",
    expectation: conditional(
      "lives inside a dropdown wrapper — same nav-config/overflow conditionality as header-nav-dropdown",
    ),
    selector: "header[data-header] [data-nav-item-dropdown] svg",
    kind: "ui",
    cap: 4,
    hover: false,
    state: "static",
  },
  {
    key: "header-more-toggle",
    expectation: conditional(
      "the overflow toggle renders ONLY when the top-level nav overflows the viewport; at the audited 1440px width it is legitimately absent",
    ),
    selector: "header[data-header] [data-nav-more-toggle]",
    kind: "text",
    cap: 2,
    hover: true,
    state: "static",
  },
  {
    key: "header-logo",
    expectation: conditional(
      "decorative kind — decorative samples are excluded from the coverage counts by design",
    ),
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
    expectation: conditional(
      "header-right controls are host-configured; an icon-only build carries no text sample at all",
    ),
    selector: "header[data-header] [data-header-right] button",
    kind: "text",
    cap: 6,
    hover: false,
    state: "static",
  },
  {
    key: "header-right-icon",
    expectation: conditional("depends on the host-configured header-right buttons"),
    selector: "header[data-header] [data-header-right] button svg",
    kind: "ui",
    cap: 6,
    hover: false,
    state: "static",
  },
  // Header-right controls that navigate (the GitHub link, configured
  // `type:"link"` items) render as `<a>`, not `<button>` — so they need the
  // same text (4.5:1) + icon (3.0:1) split as the buttons above, or they'd
  // produce no audit row at all. An icon-only anchor carries no visible text,
  // so its text sample self-drops (empty textContent) and only the icon
  // sample remains, mirroring the button behaviour.
  {
    key: "header-right-link",
    expectation: conditional(
      "header-right link items are host-configured (the GitHub link here); a host may configure none",
    ),
    selector: "header[data-header] [data-header-right] a",
    kind: "text",
    cap: 6,
    hover: false,
    state: "static",
  },
  {
    key: "header-right-link-icon",
    expectation: conditional("depends on the host-configured header-right link items"),
    selector: "header[data-header] [data-header-right] a svg",
    kind: "ui",
    cap: 6,
    hover: false,
    state: "static",
  },
  // ── Sidebar ─────────────────────────────────────────────
  {
    key: "sidebar-link",
    expectation: REQUIRED_BOTH_PAGES,
    selector: "aside#desktop-sidebar a",
    kind: "text",
    cap: 14,
    hover: true,
    state: "static",
  },
  {
    key: "sidebar-active-leaf",
    expectation: REQUIRED_ADMONITIONS,
    selector: 'aside#desktop-sidebar a[aria-current="page"][data-nav-active]',
    kind: "text",
    cap: 1,
    hover: true,
    state: "active",
  },
  // A ROOT sidebar node (a category index page's own entry) carries
  // `aria-current="page"` WITHOUT `data-nav-active`, so `sidebar-active-leaf`
  // structurally cannot match it — and that root chip is exactly where the
  // sidebar hover-contrast regressions live. Sample it as its own group
  // (#4033); the two selectors are mutually exclusive, so no element is
  // double-counted.
  {
    key: "sidebar-active-root",
    expectation: REQUIRED_GETTING_STARTED,
    selector: 'aside#desktop-sidebar a[aria-current="page"]:not([data-nav-active])',
    kind: "text",
    cap: 1,
    hover: true,
    state: "active",
  },
  // ── TOC ─────────────────────────────────────────────────
  {
    key: "toc-link",
    expectation: REQUIRED_ADMONITIONS,
    selector: "nav[data-zd-toc] a",
    kind: "text",
    cap: 10,
    hover: false,
    state: "static",
  },
  {
    key: "toc-active",
    expectation: REQUIRED_ADMONITIONS,
    selector: 'nav[data-zd-toc] a[aria-current="true"]',
    kind: "text",
    cap: 1,
    hover: false,
    state: "active",
  },
  // ── Breadcrumb ──────────────────────────────────────────
  {
    key: "breadcrumb-link",
    expectation: REQUIRED_ADMONITIONS,
    selector: 'nav[aria-label="Breadcrumb"] a',
    kind: "text",
    cap: 5,
    hover: false,
    state: "static",
  },
  {
    key: "breadcrumb-current",
    expectation: conditional(
      "the breadcrumb trail renders a current-page <span> only on pages deep enough to have one",
    ),
    selector: 'nav[aria-label="Breadcrumb"] li > span',
    kind: "text",
    cap: 2,
    hover: false,
    state: "static",
  },
  // ── Content (.zd-content) ───────────────────────────────
  {
    key: "content-heading",
    expectation: REQUIRED_ADMONITIONS,
    selector: "main h1, .zd-content h2, .zd-content h3",
    kind: "text",
    cap: 8,
    hover: false,
    state: "static",
  },
  {
    key: "content-paragraph",
    expectation: REQUIRED_ADMONITIONS,
    selector: ".zd-content p",
    kind: "text",
    cap: 8,
    hover: false,
    state: "static",
  },
  {
    key: "content-link",
    expectation: conditional(
      "inline content links are authored per page — a page may legitimately have none",
    ),
    selector: ".zd-content a",
    kind: "text",
    cap: 6,
    hover: true,
    state: "static",
  },
  {
    key: "content-code",
    expectation: REQUIRED_ADMONITIONS,
    selector: ".zd-content pre.hi-root",
    kind: "text",
    cap: 4,
    hover: false,
    state: "static",
  },
  {
    key: "admonition-title",
    expectation: REQUIRED_ADMONITIONS,
    selector: ".zd-content [data-admonition] .admonition-title",
    kind: "text",
    cap: 8,
    hover: false,
    state: "static",
  },
  {
    key: "admonition-body",
    expectation: REQUIRED_ADMONITIONS,
    selector: ".zd-content [data-admonition] .admonition-body",
    kind: "text",
    cap: 8,
    hover: false,
    state: "static",
  },
  // ── Pager ───────────────────────────────────────────────
  {
    key: "pager-link",
    expectation: REQUIRED_BOTH_PAGES,
    selector: "nav[data-doc-pager] > a",
    kind: "text",
    cap: 2,
    hover: true,
    state: "static",
  },
  // ── Footer ──────────────────────────────────────────────
  {
    key: "footer-link",
    expectation: conditional("footer links are host-configured; a host may render a link-free footer"),
    selector: "footer[data-footer] a",
    kind: "text",
    cap: 8,
    hover: false,
    state: "static",
  },
];

/**
 * Drift guard between the two declarations of "what must be measured": each
 * inventory item's `expectation` and the per-page `COVERAGE_CONTRACT`. Run by
 * the audit driver BEFORE any browser launches — a mismatch means a required
 * group would be asserted on a page that never requires it (or a contract
 * requirement names a group nothing collects), which is a configuration error,
 * not a finding. Returns [] when the two agree.
 */
export function validateInventoryExpectations(
  inventory: readonly InventoryItem[] = INVENTORY,
  contract: Readonly<Record<string, readonly { group: string }[]>> = COVERAGE_CONTRACT,
): string[] {
  const errors: string[] = [];
  const byKey = new Map(inventory.map((i) => [i.key, i]));

  for (const item of inventory) {
    if (item.expectation.kind === "conditional") {
      if (item.expectation.reason.trim().length === 0) {
        errors.push(`inventory "${item.key}" is conditional but carries no reason`);
      }
      continue;
    }
    if (item.expectation.pages.length === 0) {
      errors.push(`inventory "${item.key}" is declared required but names no page`);
    }
    for (const page of item.expectation.pages) {
      const reqs = contract[page];
      if (!reqs) {
        errors.push(`inventory "${item.key}" is declared required on "${page}", which has no coverage contract`);
      } else if (!reqs.some((r) => r.group === item.key)) {
        errors.push(
          `inventory "${item.key}" is declared required on "${page}" but that page's contract does not require it`,
        );
      }
    }
  }

  for (const page of Object.keys(contract)) {
    for (const req of contract[page] ?? []) {
      const item = byKey.get(req.group);
      if (!item) {
        errors.push(`contract page "${page}" requires group "${req.group}", which is not in the inventory`);
        continue;
      }
      if (item.expectation.kind !== "required" || !item.expectation.pages.includes(page)) {
        errors.push(
          `contract page "${page}" requires group "${req.group}", but the inventory does not declare it required there`,
        );
      }
    }
  }

  // A duplicated key would silently collapse in `byKey` above, and its samples
  // would merge into one coverage group under two different selectors.
  const seen = new Set<string>();
  for (const item of inventory) {
    if (seen.has(item.key)) errors.push(`inventory key "${item.key}" is declared more than once`);
    seen.add(item.key);
  }

  return errors;
}

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

  const hasDirectText = (node: Element): boolean =>
    Array.prototype.some.call(
      node.childNodes,
      (n: ChildNode) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 0,
    );

  // The element whose OWN computed `color` actually paints the visible text.
  // A container link — the pager card, a nav item wrapping its label in a
  // <span> — holds its text in child <div>/<p>/<span> that can override `color`
  // (e.g. brutalist's pager inverts the child text to `--zd-bg` on hover while
  // the anchor's own color stays `--zd-fg`). Measuring the container would
  // compare a color no glyph is painted with (a false fg==bg FAIL). Descend to
  // the first descendant (document order) that directly holds text; fall back
  // to the element itself when it has its own text or none is found.
  //
  // LIMITATION: a container with several independently-colored text runs (the
  // pager holds a muted caption AND a fg title) samples only the FIRST run. The
  // pager's caption is the muted/weaker of the two and its title is bold `--zd-fg`
  // (safe), so measuring the caption is the conservative pick; a fully-general
  // "one sample per distinct text run" pass is deferred (it would also reshape
  // the per-group coverage counts).
  const inkElementFor = (root: Element): Element => {
    if (hasDirectText(root)) return root;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node instanceof Element && hasDirectText(node)) return node;
    }
    return root;
  };

  const collect = (el: Element, item: InventoryItem): RawSample | null => {
    const cs = getComputedStyle(el);
    if (!isVisible(el, cs)) return null;

    const text = (el.textContent ?? "").trim();
    // Text-kind elements with no rendered text (icon-only links) aren't
    // text-contrast subjects — drop them rather than SKIP.
    if (item.kind === "text" && text.length === 0) return null;

    // For text, measure color/size/background from where the ink actually is;
    // for ui/decorative the matched element itself is the subject.
    const inkEl = item.kind === "text" ? inkElementFor(el) : el;
    const inkCs = inkEl === el ? cs : getComputedStyle(inkEl);

    const chain: RawSample["chain"] = [];
    let node: Element | null = inkEl;
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
      color: inkCs.color,
      fontSizePx: parseFloat(inkCs.fontSize) || 16,
      fontWeight: toWeight(inkCs.fontWeight),
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
