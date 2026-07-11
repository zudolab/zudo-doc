import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { SPACING_TOKENS, FONT_TOKENS, SIZE_TOKENS } from "../design-token-panel-config/manifest.js";

// Sub #2685 (epic #2651 mirror-test follow-up to the z-index mirror test in
// z-index-defaults.test.ts). `theme.css` restates token default values that
// also appear in `design-token-panel-config/manifest.ts` with no
// cross-check — this test closes that gap for the spacing/typography/radius
// namespaces the way z-index-defaults.test.ts already does for --z-index-*.
//
// Direction: iterate MANIFEST tokens and assert theme.css declares the SAME
// value. theme.css legitimately carries tokens the panel does not manage
// (breakpoints, colors, shadow, tracking, transition-slow/slower,
// header-h, …) — the reverse direction (theme.css → manifest) is wrong and
// is NOT asserted here.
//
// COLOR is out of scope by construction: every theme.css `--color-*`
// declaration is a `var(--zd-*)` reference (resolved by a consumer-supplied
// ColorSchemeProvider, not a literal default), and the package manifest has
// no color token defaults at all (Color tab data comes from
// `defaultColorSchemes` instead — see design-token-panel-config/index.ts).
// Z-INDEX is already covered by z-index-defaults.test.ts and is not
// duplicated here.
describe("design-token-panel-config manifest mirrors theme.css defaults", () => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const themeCss = readFileSync(resolve(__dirname, "../theme.css"), "utf8");

  // Parse every `--custom-prop: value;` declaration in the WHOLE file (not
  // just inside `@theme {}` — `--text-scale-*`, `--zd-sidebar-w`, and
  // `--default-transition-duration` live in the trailing `:root` block).
  // Captures the FULL value up to the terminating `;` (so comma/space-bearing
  // values like `--font-sans: system-ui, sans-serif;` come through whole),
  // and tolerates an optional same-line trailing CSS comment (several rows,
  // e.g. the hsp/vsp/icon/text-scale/radius declarations, annotate the pixel
  // equivalent that way: `--spacing-hsp-2xs: 0.125rem;   /* 2px — … */`).
  // Declarations that span multiple lines are out of scope — none of the
  // tokens this test cross-checks do.
  const declRe = /^--([a-zA-Z0-9-]+):\s*(.+?)\s*;\s*(?:\/\*.*\*\/\s*)?$/;
  const cssDecls = new Map<string, string[]>();
  for (const rawLine of themeCss.split("\n")) {
    const m = rawLine.trim().match(declRe);
    if (!m) continue;
    const name = `--${m[1]!}`;
    const value = m[2]!;
    const existing = cssDecls.get(name);
    if (existing) {
      existing.push(value);
    } else {
      cssDecls.set(name, [value]);
    }
  }

  // --- Exclusions (explicit + commented so a future token defaults to being checked) ---
  //
  // The 7 semantic `--text-*` font-size rows: theme.css declares these as
  // `var(--text-scale-*)` REFERENCES (Tier 2 resolves from Tier 1), not
  // literal lengths — the manifest's resolved rem value is a serde-only
  // convenience for the panel UI and has nothing to structurally compare
  // against on the theme.css side.
  const EXCLUDED_SEMANTIC_TEXT_SIZE_VARS = new Set<string>([
    "--text-micro",
    "--text-caption",
    "--text-small",
    "--text-body",
    "--text-title",
    "--text-heading",
    "--text-display",
  ]);
  // `--zd-sidebar-w`: readonly in the manifest (`readonly: true` — a usable
  // signal that this row isn't a plain comparable default) and its theme.css
  // value is a whitespace-sensitive `clamp(14rem, 20vw, 22rem)` expression,
  // not a single scalar.
  const EXCLUDED_READONLY_VARS = new Set<string>(["--zd-sidebar-w"]);
  const EXCLUDED_VARS = new Set<string>([
    ...EXCLUDED_SEMANTIC_TEXT_SIZE_VARS,
    ...EXCLUDED_READONLY_VARS,
  ]);

  // Manifest rows whose `default` is deliberately expressed in `px` while
  // theme.css expresses the same design value in `rem` (manifest comment:
  // "Radius defaults use px (matches a 0-100 slider), even though theme.css
  // expresses them in rem"). Normalize deterministically (1rem = 16px) for
  // ONLY these two rows. `--radius-full` is NOT in this set — both sides
  // already agree on `9999px` verbatim (see the "directly comparable" list
  // below), so it takes the default verbatim-equality path.
  const REM_TO_PX_NORMALIZED_VARS = new Set<string>(["--radius-DEFAULT", "--radius-lg"]);

  function remToPx(remValue: string): string | null {
    const m = remValue.match(/^(-?\d+(?:\.\d+)?)rem$/);
    if (!m) return null;
    const px = Number(m[1]!) * 16;
    // All current rows land on an integer px value; keep the comparison
    // exact rather than tolerating float drift from an unexpected input.
    return `${px}px`;
  }

  // Directly comparable (verbatim, no unit conversion) per the sub-task spec:
  // spacing hsp/vsp/icon/image-overlay-inset/spacing-0/spacing-px; --leading-*;
  // --font-weight-*; --text-scale-*; font families; --radius-full;
  // --default-transition-duration.
  const ALL_MANIFEST_TOKENS = [...SPACING_TOKENS, ...FONT_TOKENS, ...SIZE_TOKENS];

  it("manifest has the expected total token count (51)", () => {
    // If this drifts, a token was added to/removed from one of the three
    // manifest arrays — re-derive `compared = total - excluded` below rather
    // than editing the hardcoded 43 in the next test to make it pass blind.
    expect(ALL_MANIFEST_TOKENS.length).toBe(51);
  });

  const comparedTokens = ALL_MANIFEST_TOKENS.filter((t) => !EXCLUDED_VARS.has(t.cssVar));

  it("excludes exactly the 7 semantic text-size rows + --zd-sidebar-w, leaving 43 compared tokens", () => {
    expect(EXCLUDED_VARS.size).toBe(8);
    expect(comparedTokens.length).toBe(43);
  });

  it("every non-excluded manifest cssVar occurs EXACTLY ONCE in theme.css", () => {
    for (const token of comparedTokens) {
      const occurrences = cssDecls.get(token.cssVar) ?? [];
      expect(occurrences, `${token.cssVar} should be declared exactly once in theme.css`).toHaveLength(1);
    }
  });

  it.each(comparedTokens.map((t) => [t.cssVar, t] as const))(
    "%s: manifest default matches theme.css",
    (cssVar, token) => {
      const cssValues = cssDecls.get(cssVar);
      expect(cssValues, `${cssVar} not found in theme.css`).toBeDefined();
      const cssValue = cssValues![0]!;
      const manifestDefault = token.default;

      if (REM_TO_PX_NORMALIZED_VARS.has(cssVar)) {
        const normalized = remToPx(cssValue);
        expect(
          normalized,
          `${cssVar}: theme.css value "${cssValue}" is not a supported rem unit for normalization`,
        ).not.toBeNull();
        expect(normalized).toBe(manifestDefault);
        return;
      }

      // Any OTHER unit mismatch is a real failure, not something to
      // silently normalize — assert verbatim equality for every remaining
      // row (spacing, leading, font-weight, text-scale, font families,
      // radius-full, default-transition-duration).
      expect(cssValue).toBe(manifestDefault);
    },
  );
});
