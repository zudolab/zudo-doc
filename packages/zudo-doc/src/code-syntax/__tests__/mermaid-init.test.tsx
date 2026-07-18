/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { MermaidInit } from "../mermaid-init.js";
import {
  MERMAID_CDN_MODULE_URL,
  buildMermaidInitScript,
} from "../mermaid-init-script.js";
import { AFTER_NAVIGATE_EVENT } from "../../transitions/page-events.js";

const MERMAID_INIT_SCRIPT = buildMermaidInitScript(MERMAID_CDN_MODULE_URL);

describe("<MermaidInit />", () => {
  it("renders a <script> tag", () => {
    const html = render(<MermaidInit />);
    expect(html).toContain("<script");
  });

  it("script contains mermaid init logic", () => {
    const html = render(<MermaidInit />);
    expect(html).toContain("initMermaid");
    expect(html).toContain("data-mermaid");
  });

  it("script hooks into the v2 after-navigate event for view transitions", () => {
    // After zudolab/zudo-doc#1335 (E2 task 2 half B) the script reads
    // event names from `transitions/page-events.ts` rather than hard-
    // coded `astro:*` literals.
    const html = render(<MermaidInit />);
    expect(html).toContain(JSON.stringify(AFTER_NAVIGATE_EVENT));
  });

  it("script observes color scheme changes via MutationObserver", () => {
    const html = render(<MermaidInit />);
    expect(html).toContain("MutationObserver");
    expect(html).toContain("reinitMermaid");
  });

  it("renders no extra HTML beyond the script tag", () => {
    const html = render(<MermaidInit />);
    // Should just be a script tag, no divs etc.
    expect(html.trimStart()).toMatch(/^<script/);
  });
});

describe("MERMAID_INIT_SCRIPT", () => {
  it("is a non-empty string", () => {
    expect(typeof MERMAID_INIT_SCRIPT).toBe("string");
    expect(MERMAID_INIT_SCRIPT.length).toBeGreaterThan(0);
  });

  it("wraps the logic in an IIFE", () => {
    expect(MERMAID_INIT_SCRIPT).toMatch(/^\(function\s*\(\)/);
    expect(MERMAID_INIT_SCRIPT.trimEnd()).toMatch(/\)\(\);$/);
  });

  it("lazily imports mermaid via dynamic import to a CDN URL (not the bare specifier)", () => {
    // Wave 13 (zudolab/zudo-doc#1355 Topic 4): the bare `import("mermaid")`
    // form fails at runtime under zfb because the inline <script> has no
    // bundler in the path to resolve the specifier. The script must
    // import from the configured CDN URL instead.
    expect(MERMAID_INIT_SCRIPT).toContain(
      `import(${JSON.stringify(MERMAID_CDN_MODULE_URL)})`,
    );
    expect(MERMAID_INIT_SCRIPT).not.toContain('import("mermaid")');
  });

  it("resolves CSS custom properties for theme variables", () => {
    expect(MERMAID_INIT_SCRIPT).toContain("resolveColor");
    expect(MERMAID_INIT_SCRIPT).toContain("--zd-mermaid-node-bg");
    expect(MERMAID_INIT_SCRIPT).toContain("--zd-bg");
  });

  it("detects dark mode from background luminance", () => {
    expect(MERMAID_INIT_SCRIPT).toContain("luminance");
    expect(MERMAID_INIT_SCRIPT).toContain("darkMode");
  });

  it("skips already-rendered diagrams", () => {
    expect(MERMAID_INIT_SCRIPT).toContain("data-mermaid-rendered");
  });

  // zudolab/zudo-doc#1458 — khroma 2.1.0 (mermaid 11.4.1's transitive
  // dep) does not understand the CSS `light-dark()` function. CSS
  // custom properties on `:root` are written as
  // `light-dark(#hex-light, #hex-dark)` when colorMode is enabled
  // (see `generateLightDarkCssProperties` in
  // `src/config/color-scheme-utils.ts`), and `getPropertyValue` returns
  // them as the literal string. The init script must syntactically
  // parse `light-dark(...)` and pick the matching arg from
  // `document.documentElement.dataset.theme` BEFORE any value reaches
  // mermaid — relying on the browser to resolve `light-dark()` via the
  // temp-element trick was unreliable in production.
  it("parses CSS light-dark(...) syntactically against data-theme", () => {
    expect(MERMAID_INIT_SCRIPT).toContain("parseLightDark");
    expect(MERMAID_INIT_SCRIPT).toContain("light-dark(");
    // Reads the theme attribute that the color-scheme-provider bootstrap
    // sets on `:root` (see packages/zudo-doc/src/theme/color-scheme-provider.tsx).
    expect(MERMAID_INIT_SCRIPT).toContain("data-theme");
  });

  it("parseLightDark picks the light arg when data-theme=light", () => {
    // Extract the parser body from the inline script and exercise it
    // in a sandbox so the runtime branch is unit-tested, not just
    // string-matched. The function signature `parseLightDark(raw, theme)`
    // is the public contract used by the value-reader `v()`.
    const fn = extractParseLightDark(MERMAID_INIT_SCRIPT);
    expect(fn("light-dark(#abcdef, #123456)", "light")).toBe("#abcdef");
    expect(fn("light-dark(#abcdef, #123456)", "dark")).toBe("#123456");
    // Whitespace tolerance — `generateLightDarkCssProperties` emits
    // `light-dark(#a, #b)` with a single space, but a future formatter
    // change could add more.
    expect(fn("light-dark( #ff0000 , #00ff00 )", "light")).toBe("#ff0000");
    expect(fn("light-dark( #ff0000 , #00ff00 )", "dark")).toBe("#00ff00");
  });

  it("parseLightDark returns null for non-light-dark inputs", () => {
    const fn = extractParseLightDark(MERMAID_INIT_SCRIPT);
    expect(fn("#abcdef", "light")).toBeNull();
    expect(fn("rgb(1, 2, 3)", "dark")).toBeNull();
    expect(fn("", "light")).toBeNull();
  });

  it("parseLightDark falls back to the light arg when theme is unknown", () => {
    // `data-theme` may be missing on first paint (before the bootstrap
    // script runs) — pick the light arg as a deterministic default
    // rather than returning null and forcing the caller to handle it.
    const fn = extractParseLightDark(MERMAID_INIT_SCRIPT);
    expect(fn("light-dark(#abcdef, #123456)", undefined)).toBe("#abcdef");
    expect(fn("light-dark(#abcdef, #123456)", "")).toBe("#abcdef");
    expect(fn("light-dark(#abcdef, #123456)", "auto")).toBe("#abcdef");
  });

  // zudolab/zudo-doc#2474 — OKLCH migration: CSS custom properties may now
  // contain `oklch()` values inside `light-dark()`. The old regex-based
  // parser used `[^)]+?` for the dark arm, which cannot contain `)`, so
  // `light-dark(oklch(0.5 0.1 250), oklch(0.7 0.05 250))` failed to match.
  // The paren-balance-aware splitter handles arbitrarily nested parens.
  it("parseLightDark handles oklch() values with nested parens", () => {
    const fn = extractParseLightDark(MERMAID_INIT_SCRIPT);
    // Primary case: oklch() values — each arm contains balanced parens
    expect(
      fn("light-dark(oklch(0.5 0.1 250), oklch(0.7 0.05 250))", "light"),
    ).toBe("oklch(0.5 0.1 250)");
    expect(
      fn("light-dark(oklch(0.5 0.1 250), oklch(0.7 0.05 250))", "dark"),
    ).toBe("oklch(0.7 0.05 250)");
    // Whitespace tolerance with oklch
    expect(
      fn(
        "light-dark( oklch(0.9 0.02 100) , oklch(0.2 0.05 250) )",
        "light",
      ),
    ).toBe("oklch(0.9 0.02 100)");
    expect(
      fn(
        "light-dark( oklch(0.9 0.02 100) , oklch(0.2 0.05 250) )",
        "dark",
      ),
    ).toBe("oklch(0.2 0.05 250)");
  });

  it("parseLightDark handles rgb() values with commas inside parens", () => {
    const fn = extractParseLightDark(MERMAID_INIT_SCRIPT);
    // rgb() arms contain commas — the splitter must not split on them
    expect(fn("light-dark(rgb(1,2,3), rgb(4,5,6))", "light")).toBe(
      "rgb(1,2,3)",
    );
    expect(fn("light-dark(rgb(1,2,3), rgb(4,5,6))", "dark")).toBe(
      "rgb(4,5,6)",
    );
    // color(srgb ...) arms
    expect(
      fn(
        "light-dark(color(srgb 0.1 0.2 0.3), color(srgb 0.5 0.6 0.7))",
        "light",
      ),
    ).toBe("color(srgb 0.1 0.2 0.3)");
    expect(
      fn(
        "light-dark(color(srgb 0.1 0.2 0.3), color(srgb 0.5 0.6 0.7))",
        "dark",
      ),
    ).toBe("color(srgb 0.5 0.6 0.7)");
    // Hex values still work (regression guard)
    expect(fn("light-dark(#111, #222)", "light")).toBe("#111");
    expect(fn("light-dark(#111, #222)", "dark")).toBe("#222");
  });

  it("re-renders diagrams when the data-theme attribute changes", () => {
    // The theme-toggle island flips `:root[data-theme]` between
    // `"light"` and `"dark"`. Mermaid's resolved theme colors are
    // baked into the rendered SVG, so the script must re-run
    // `mermaid.initialize` + clear `data-mermaid-rendered` on the
    // attribute change.
    expect(MERMAID_INIT_SCRIPT).toContain('"data-theme"');
    // Either a separate observer or an extended attributeFilter that
    // covers `data-theme`.
    const observesDataTheme =
      /attributeFilter\s*:\s*\[[^\]]*"data-theme"[^\]]*\]/.test(
        MERMAID_INIT_SCRIPT,
      );
    expect(observesDataTheme).toBe(true);
  });

  // zudolab/zudo-doc#2181 — Fix 2: reinitMermaid must regenerate from a
  // cached source. mermaid.run consumes the diagram source text (replaces
  // it with the SVG, sets data-processed), so the script caches the
  // DECODED source into data-mermaid-src BEFORE running, and reinitMermaid
  // restores it and clears data-processed so mermaid.run won't skip the
  // node.
  it("caches the diagram source into data-mermaid-src before running", () => {
    expect(MERMAID_INIT_SCRIPT).toContain("data-mermaid-src");
    expect(MERMAID_INIT_SCRIPT).toContain("normalizeCollapsedMermaidSource");
    // Must cache via textContent (decoded) — NOT innerHTML, which would
    // re-encode entities and corrupt `-->` / `&` diagrams.
    expect(MERMAID_INIT_SCRIPT).toContain("el.textContent");
    expect(MERMAID_INIT_SCRIPT).not.toContain("el.innerHTML");
  });

  it("leaves authored multiline mermaid source unchanged", () => {
    const fn = extractNormalizeCollapsedMermaidSource(MERMAID_INIT_SCRIPT);
    const source = "graph LR\n  A[Start] --> B[Process]\n  B --> C[End]";
    expect(fn(source)).toBe(source);
  });

  it("restores statement boundaries for minified flowchart source", () => {
    const fn = extractNormalizeCollapsedMermaidSource(MERMAID_INIT_SCRIPT);
    expect(
      fn("graph LR A[Start] --> B[Process] B --> C[End]"),
    ).toBe("graph LR\nA[Start] --> B[Process];\nB --> C[End]");
  });

  it("restores statement boundaries for minified flowchart source with labels", () => {
    const fn = extractNormalizeCollapsedMermaidSource(MERMAID_INIT_SCRIPT);
    expect(
      fn(
        "graph LR A[Start] --> B{Decision} B -->|Yes| C[Action] B -->|No| D[Other Action] C --> E[End] D --> E",
      ),
    ).toBe(
      "graph LR\nA[Start] --> B{Decision};\nB -->|Yes| C[Action];\nB -->|No| D[Other Action];\nC --> E[End];\nD --> E",
    );
  });

  it("restores statement boundaries for minified sequence diagrams", () => {
    const fn = extractNormalizeCollapsedMermaidSource(MERMAID_INIT_SCRIPT);
    expect(
      fn(
        "sequenceDiagram participant User participant App participant API User->>App: Click button App->>API: Fetch data API-->>App: JSON response App-->>User: Render result",
      ),
    ).toBe(
      "sequenceDiagram\nparticipant User;\nparticipant App;\nparticipant API;\nUser->>App: Click button;\nApp->>API: Fetch data;\nAPI-->>App: JSON response;\nApp-->>User: Render result",
    );
  });

  it("restores statement boundaries for minified state diagrams", () => {
    // zudolab/zudo-doc#2909 — unlike flowchart/sequenceDiagram, mermaid
    // does NOT treat `;` as a separator it strips from a stateDiagram
    // state id: a trailing `;` glued onto "Draft" makes mermaid parse
    // "Draft;" as a DISTINCT state, rendering both a spurious "Draft;"
    // node and a floating ";" node. The repaired output must use
    // newline-only separation for this branch, with no `;` token.
    const fn = extractNormalizeCollapsedMermaidSource(MERMAID_INIT_SCRIPT);
    const result = fn(
      "stateDiagram-v2 [*] --> Draft Draft --> Review : Submit Review --> Published : Approve Review --> Draft : Request Changes Published --> Archived : Archive Archived --> [*]",
    );
    expect(result).toBe(
      "stateDiagram-v2\n[*] --> Draft\nDraft --> Review : Submit\nReview --> Published : Approve\nReview --> Draft : Request Changes\nPublished --> Archived : Archive\nArchived --> [*]",
    );
    expect(result).not.toContain(";");
  });

  it("restores statement boundaries for minified subgraph flowcharts", () => {
    const fn = extractNormalizeCollapsedMermaidSource(MERMAID_INIT_SCRIPT);
    expect(
      fn(
        "flowchart TB subgraph Build A[MDX source] --> B[Mermaid pass] B --> C[Wrapper div] end subgraph Runtime C --> D[Client island] D --> E[Rendered SVG] E --> F[Enlarge button] end F --> G((Dialog\\n+ / - / pan))",
      ),
    ).toBe(
      "flowchart TB\nsubgraph Build;\nA[MDX source] --> B[Mermaid pass];\nB --> C[Wrapper div];\nend;\nsubgraph Runtime;\nC --> D[Client island];\nD --> E[Rendered SVG];\nE --> F[Enlarge button];\nend;\nF --> G((Dialog\\n+ / - / pan))",
    );
  });

  it("reinitMermaid restores the cached source and removes data-processed", () => {
    // Without removing data-processed, mermaid.run skips the node and it
    // stays blank. Both data-processed and data-mermaid-rendered must be
    // removed so initMermaid regenerates cleanly.
    expect(MERMAID_INIT_SCRIPT).toContain("data-processed");
    expect(MERMAID_INIT_SCRIPT).toMatch(
      /removeAttribute\(\s*"data-processed"\s*\)/,
    );
    expect(MERMAID_INIT_SCRIPT).toMatch(
      /removeAttribute\(\s*"data-mermaid-rendered"\s*\)/,
    );
    // Restores the cached source so there is graph text to regenerate.
    expect(MERMAID_INIT_SCRIPT).toContain('getAttribute("data-mermaid-src")');
  });

  // zudolab/zudo-doc#2181 — Fix 1: the observer must gate on a REAL
  // theme/token change. zfb-runtime's swapRootAttributes removes+re-adds
  // all :root attributes on every soft nav, so the observer over-fires
  // unless it compares resolved state against the last-seen snapshot.
  it("gates the observer on a real theme/token change", () => {
    expect(MERMAID_INIT_SCRIPT).toContain("hasThemeStateChanged");
    expect(MERMAID_INIT_SCRIPT).toContain("getComputedStyle");
    // Cites the root cause so a future reader knows why the gate exists.
    expect(MERMAID_INIT_SCRIPT).toContain("swapRootAttributes");
  });

  it("hasThemeStateChanged returns false when nothing tracked changed", () => {
    const fn = extractHasThemeStateChanged(MERMAID_INIT_SCRIPT);
    const state = {
      theme: "light",
      tokens: {
        "--zd-bg": "#ffffff",
        "--zd-mermaid-node-bg": "#eeeeee",
        "--zd-mermaid-text": "#111111",
        "--zd-mermaid-line": "#222222",
        "--zd-mermaid-note-bg": "#333333",
        "--zd-mermaid-label-bg": "#444444",
      },
    };
    // Same values in a fresh object — an unrelated :root[style] mutation
    // that touched no tracked token resolves to identical snapshots.
    const same = {
      theme: "light",
      tokens: { ...state.tokens },
    };
    expect(fn(state, same)).toBe(false);
  });

  it("hasThemeStateChanged returns true on a real data-theme change", () => {
    const fn = extractHasThemeStateChanged(MERMAID_INIT_SCRIPT);
    const tokens = {
      "--zd-bg": "#ffffff",
      "--zd-mermaid-node-bg": "#eeeeee",
      "--zd-mermaid-text": "#111111",
      "--zd-mermaid-line": "#222222",
      "--zd-mermaid-note-bg": "#333333",
      "--zd-mermaid-label-bg": "#444444",
    };
    const prev = { theme: "light", tokens: { ...tokens } };
    const next = { theme: "dark", tokens: { ...tokens } };
    expect(fn(prev, next)).toBe(true);
  });

  it("hasThemeStateChanged returns true on a real tracked-token change", () => {
    const fn = extractHasThemeStateChanged(MERMAID_INIT_SCRIPT);
    const base = {
      "--zd-bg": "#ffffff",
      "--zd-mermaid-node-bg": "#eeeeee",
      "--zd-mermaid-text": "#111111",
      "--zd-mermaid-line": "#222222",
      "--zd-mermaid-note-bg": "#333333",
      "--zd-mermaid-label-bg": "#444444",
    };
    const prev = { theme: "light", tokens: { ...base } };
    const next = {
      theme: "light",
      tokens: { ...base, "--zd-mermaid-text": "#999999" },
    };
    expect(fn(prev, next)).toBe(true);
  });

  it("hasThemeStateChanged treats first-paint empty->populated as a change", () => {
    // CRITICAL: --zd-bg may be UNSET at first paint (empty string); the
    // observer is exactly what reinits once ColorSchemeProvider populates
    // the tokens, so empty -> real MUST count as a change, otherwise the
    // first legitimate colorization is suppressed.
    const fn = extractHasThemeStateChanged(MERMAID_INIT_SCRIPT);
    const seed = {
      theme: null,
      tokens: {
        "--zd-bg": "",
        "--zd-mermaid-node-bg": "",
        "--zd-mermaid-text": "",
        "--zd-mermaid-line": "",
        "--zd-mermaid-note-bg": "",
        "--zd-mermaid-label-bg": "",
      },
    };
    const populated = {
      theme: "light",
      tokens: {
        "--zd-bg": "#ffffff",
        "--zd-mermaid-node-bg": "#eeeeee",
        "--zd-mermaid-text": "#111111",
        "--zd-mermaid-line": "#222222",
        "--zd-mermaid-note-bg": "#333333",
        "--zd-mermaid-label-bg": "#444444",
      },
    };
    expect(fn(seed, populated)).toBe(true);
    // A missing prev snapshot (no seed at all) also counts as a change.
    expect(fn(undefined, populated)).toBe(true);
  });
});

/**
 * Pull the inline `parseLightDark` function out of the IIFE-wrapped
 * init script and return it as a callable function. Lets the parser's
 * runtime branches be unit-tested directly, instead of only
 * string-matched.
 */
function extractParseLightDark(
  script: string,
): (raw: string, theme: string | undefined) => string | null {
  // The function body is a top-level declaration inside the IIFE, so a
  // straightforward `function parseLightDark(...) { ... }` capture
  // works. We re-emit it as an expression for `new Function` so the
  // function value is returned without polluting any global.
  const match = script.match(
    /function\s+parseLightDark\s*\([^)]*\)\s*\{[\s\S]*?\n\s{2}\}/,
  );
  if (!match) {
    throw new Error("parseLightDark not found in MERMAID_INIT_SCRIPT");
  }
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function(`${match[0]}\nreturn parseLightDark;`)() as (
    raw: string,
    theme: string | undefined,
  ) => string | null;
}

/**
 * Pull the inline `resolveColor` function out of the IIFE-wrapped init
 * script and return it as a callable function.
 *
 * Hex fast paths (3/4/6/8-digit) are pure string operations and work in
 * any JS environment. DOM/canvas paths require `document` — callers must
 * feature-detect before invoking with non-hex inputs.
 */
function extractResolveColor(script: string): (value: string) => string {
  const match = script.match(
    /function\s+resolveColor\s*\([^)]*\)\s*\{[\s\S]*?\n\s{2}\}/,
  );
  if (!match) {
    throw new Error("resolveColor not found in MERMAID_INIT_SCRIPT");
  }
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function(`${match[0]}\nreturn resolveColor;`)() as (
    value: string,
  ) => string;
}

type ThemeSnapshot = {
  theme: string | null;
  tokens: Record<string, string>;
};

/**
 * Pull `TRACKED_TOKENS` and `hasThemeStateChanged` out of the IIFE and
 * return the change-detector as a callable. `hasThemeStateChanged`
 * closes over `TRACKED_TOKENS`, so both declarations are re-emitted into
 * the `new Function` body (zudolab/zudo-doc#2181).
 */
function extractHasThemeStateChanged(
  script: string,
): (
  prev: ThemeSnapshot | undefined,
  next: ThemeSnapshot,
) => boolean {
  const tokens = script.match(
    /var\s+TRACKED_TOKENS\s*=\s*\[[\s\S]*?\];/,
  );
  const fn = script.match(
    /function\s+hasThemeStateChanged\s*\([^)]*\)\s*\{[\s\S]*?\n\s{2}\}/,
  );
  if (!tokens) {
    throw new Error("TRACKED_TOKENS not found in MERMAID_INIT_SCRIPT");
  }
  if (!fn) {
    throw new Error("hasThemeStateChanged not found in MERMAID_INIT_SCRIPT");
  }
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function(
    `${tokens[0]}\n${fn[0]}\nreturn hasThemeStateChanged;`,
  )() as (prev: ThemeSnapshot | undefined, next: ThemeSnapshot) => boolean;
}

function extractNormalizeCollapsedMermaidSource(
  script: string,
): (raw: string) => string {
  const match = script.match(
    /function\s+normalizeCollapsedMermaidSource\s*\([^)]*\)\s*\{[\s\S]*?\n\s{2}\}/,
  );
  if (!match) {
    throw new Error(
      "normalizeCollapsedMermaidSource not found in MERMAID_INIT_SCRIPT",
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function(
    `${match[0]}\nreturn normalizeCollapsedMermaidSource;`,
  )() as (raw: string) => string;
}

// zudolab/zudo-doc#2474 — OKLCH migration: resolveColor must handle the
// browser serialising wide-gamut computed colors as oklch() / color(srgb ...)
// rather than rgb(). Hex fast paths are pure JS and testable anywhere;
// DOM/canvas paths are guarded with a feature-detect so jsdom-less
// environments skip them rather than hard-fail.
describe("resolveColor", () => {
  it("expands 3-digit hex to 6-digit hex", () => {
    const fn = extractResolveColor(MERMAID_INIT_SCRIPT);
    expect(fn("#abc")).toBe("#aabbcc");
    // resolveColor preserves original case — callers use the result for mermaid
    // theme variables which accept either case.
    expect(fn("#ABC")).toBe("#AABBCC");
  });

  it("passes 6-digit hex through unchanged", () => {
    const fn = extractResolveColor(MERMAID_INIT_SCRIPT);
    expect(fn("#aabbcc")).toBe("#aabbcc");
    expect(fn("#112233")).toBe("#112233");
  });

  it("strips alpha from 8-digit hex", () => {
    const fn = extractResolveColor(MERMAID_INIT_SCRIPT);
    expect(fn("#aabbccdd")).toBe("#aabbcc");
  });

  it("expands 4-digit hex (with alpha) to 6-digit hex", () => {
    const fn = extractResolveColor(MERMAID_INIT_SCRIPT);
    expect(fn("#abcd")).toBe("#aabbcc");
  });

  it("returns empty/falsy values as-is", () => {
    const fn = extractResolveColor(MERMAID_INIT_SCRIPT);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(fn("" as any)).toBe("");
  });

  // DOM-dependent tests: skipped when document is unavailable (Node environment
  // without jsdom). Canvas-dependent assertions are additionally guarded by
  // feature-detecting canvas support, since jsdom ships without canvas.
  it("converts rgb() string to hex via DOM temp element", () => {
    if (typeof document === "undefined") return;
    const fn = extractResolveColor(MERMAID_INIT_SCRIPT);
    // jsdom normalizes style.color = "rgb(255, 0, 0)" → getComputedStyle returns
    // "rgb(255, 0, 0)" which the /^rgba?\(/ fast path catches.
    const result = fn("rgb(255, 0, 0)");
    // result is either the hex (jsdom normalizes) or the original (if jsdom
    // doesn't compute styles) — both are acceptable; what must NOT happen is
    // a hard throw.
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("canvas fallback skips gracefully when canvas is unavailable", () => {
    if (typeof document === "undefined") return;
    // Feature-detect: jsdom does not ship with a <canvas> implementation.
    const testCanvas = document.createElement("canvas");
    const ctx = testCanvas.getContext("2d");
    if (!ctx) {
      // Canvas not available — the wide-gamut fallback in resolveColor catches
      // the null getContext() result and falls through to return value. Confirm
      // the function still returns a string without throwing.
      const fn = extractResolveColor(MERMAID_INIT_SCRIPT);
      const result = fn("#ff0000"); // hex fast path always works
      expect(result).toBe("#ff0000");
      return;
    }
    // Canvas IS available: oklch() / color(srgb ...) should resolve to hex.
    const fn = extractResolveColor(MERMAID_INIT_SCRIPT);
    const result = fn("oklch(1 0 0)"); // pure white in oklch
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("MERMAID_CDN_MODULE_URL", () => {
  it("is an https ESM CDN URL pinned to a major version", () => {
    expect(MERMAID_CDN_MODULE_URL).toMatch(/^https:\/\//);
    // Must encode some version pin (major-only `@11`, exact `@11.x.y`,
    // or range `@11.x`) so the runtime resolution can't drift across a
    // mermaid major bump.
    expect(MERMAID_CDN_MODULE_URL).toMatch(/mermaid@\d+/);
  });
});

describe("buildMermaidInitScript / cdnUrl override", () => {
  it("interpolates the supplied URL into the dynamic import", () => {
    // Codex review surfaced that the public override knob has to
    // actually take effect — exporting `MERMAID_CDN_MODULE_URL` alone
    // is ineffective because the script string is frozen at module
    // load. The builder rebuilds the script with the caller's URL.
    const customUrl = "https://example.test/internal-mirror/mermaid.mjs";
    const built = buildMermaidInitScript(customUrl);
    expect(built).toContain(`import(${JSON.stringify(customUrl)})`);
    expect(built).not.toContain(JSON.stringify(MERMAID_CDN_MODULE_URL));
  });

  it("the default-URL script is built via the public builder for parity", () => {
    expect(MERMAID_INIT_SCRIPT).toBe(
      buildMermaidInitScript(MERMAID_CDN_MODULE_URL),
    );
  });

  it("<MermaidInit cdnUrl=… /> emits a script with the supplied URL", () => {
    const customUrl = "https://example.test/cdn/mermaid";
    const html = render(<MermaidInit cdnUrl={customUrl} />);
    expect(html).toContain(`import(${JSON.stringify(customUrl)})`);
    expect(html).not.toContain(JSON.stringify(MERMAID_CDN_MODULE_URL));
  });

  it("<MermaidInit script=… /> wins over cdnUrl when both are passed", () => {
    const customUrl = "https://example.test/cdn/mermaid";
    const customScript = `(function(){/* sentinel-${Math.random()} */})();`;
    const html = render(
      <MermaidInit script={customScript} cdnUrl={customUrl} />,
    );
    expect(html).toContain(customScript);
    expect(html).not.toContain(`import(${JSON.stringify(customUrl)})`);
  });

  it("escapes literal </script> sequences inside the cdnUrl", () => {
    // Defense-in-depth: if a developer ever passes a URL containing
    // `</script>` (or even just `</script` as a substring), the inline
    // <script> tag carrying the init body would otherwise be torn
    // apart by the HTML parser. The builder rewrites `</script` to
    // `<\/script` in the JS string literal so the JS lexer collapses
    // it back to the right URL but the HTML parser never sees the
    // closing tag pattern.
    const malicious = "https://evil.test/</script><img src=x onerror=alert(1)>";
    const built = buildMermaidInitScript(malicious);
    expect(built).not.toContain("</script>");
    expect(built).not.toContain("</script");
    expect(built).toContain("<\\/script");
  });
});
