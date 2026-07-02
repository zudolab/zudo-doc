/**
 * WCAG 2.x contrast guard for color schemes/presets — full pair matrix.
 *
 * Enforces the finalized pair matrix from
 * `.claude/skills/color-scheme-a11y/SKILL.md` §1 across all 52 schemes
 * (2 built-ins in `color-schemes.ts` + 50 presets in
 * `color-tweak-presets.ts`). The matrix itself (pairs, thresholds, which
 * `--zd-*` vars feed each pair) lives in `../../../scripts/contrast-pair-matrix.ts`
 * — shared with `scripts/contrast-audit.ts` (the `pnpm contrast:audit` CLI) so
 * this guard and the audit tool can never diverge (S3, zudolab/zudo-doc#2489).
 *
 * Admonition backgrounds are CSS color-mix(in srgb, semanticColor 12%, --color-bg).
 * Tier-1 pairs (text) require ≥ 4.5:1; Tier-2 pairs (graphics/icons) require
 * ≥ 3.0:1 unless noted otherwise in the matrix (mermaid text pairs keep 4.5).
 *
 * All 52 schemes pass the full matrix with EMPTY allowlists — the scheme-a11y
 * epic (#2489) burned down every legacy "upstream fidelity" entry by tweaking
 * the actual colors. Keep it that way: a new entry is a last resort, only for
 * a pair provably not user-visible, with a one-line justification (skill §2.5).
 * "Upstream fidelity" is NOT an acceptable reason — tweak the color instead
 * (skill §2.1/§2.2 has the OKLCH methodology and the ANSI-preset recipe).
 *
 * Any allowlist entry that IS added must fire — a spurious entry (key that
 * never matches a real test) is caught by the stale-key audit at the bottom
 * of this file.
 */

import { describe, it, expect } from "vitest";
import { getAllPresets, evaluateScheme } from "../../../scripts/contrast-pair-matrix";
import { relativeLuminance, contrastRatio, colorMixSrgb } from "../contrast-utils";

// ---------------------------------------------------------------------------
// ALLOWLIST — non-admonition pair failures (see file header)
// ---------------------------------------------------------------------------

/** Tracks which allowlist keys were actually consulted during the test run. */
const _allowlistHits = new Set<string>();

const ALLOWLIST: Record<string, string> = {

};

// ---------------------------------------------------------------------------
// ADMONITION_ALLOWLIST — admonition-title pair failures (see file header)
// ---------------------------------------------------------------------------

const ADMONITION_ALLOWLIST: Record<string, string> = {

};

// ---------------------------------------------------------------------------
// Unit assertions: luminance / contrast math handles oklch strings
// ---------------------------------------------------------------------------

describe("luminance math — CSS color parsing", () => {
  it("oklch(0 0 0) parses as black (luminance ≈ 0)", () => {
    expect(relativeLuminance("oklch(0 0 0)")).toBeCloseTo(0, 5);
  });

  it("oklch(1 0 0) parses as white (luminance ≈ 1)", () => {
    expect(relativeLuminance("oklch(1 0 0)")).toBeCloseTo(1, 5);
  });

  it("black vs white contrast ≈ 21:1", () => {
    expect(contrastRatio("oklch(0 0 0)", "oklch(1 0 0)")).toBeCloseTo(21, 0);
  });

  it("mid-tone oklch(0.5 0.05 250) parses to a valid luminance in (0, 1)", () => {
    const lum = relativeLuminance("oklch(0.5 0.05 250)");
    expect(lum).toBeGreaterThan(0);
    expect(lum).toBeLessThan(1);
  });

  it("hex colors still parse correctly (#ffffff luminance ≈ 1)", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("hex colors still parse correctly (#000000 luminance ≈ 0)", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("colorMixSrgb returns a parseable color string", () => {
    const mixed = colorMixSrgb("oklch(1 0 0)", "oklch(0 0 0)", 50);
    // 50% mix of white and black in sRGB → near-mid-grey; luminance ≈ 0.212
    expect(relativeLuminance(mixed)).toBeCloseTo(0.212, 2);
  });
});

// ---------------------------------------------------------------------------
// Test suites — full pair matrix (S3 #2492): one `it` per (scheme, pair),
// covering every entry in PAIR_MATRIX (imported transitively via
// evaluateScheme) across all 52 schemes/presets.
// ---------------------------------------------------------------------------

describe("WCAG 2.x contrast guard — full pair matrix", () => {
  for (const { name, scheme, source } of getAllPresets()) {
    const report = evaluateScheme(name, scheme, source);

    for (const pair of report.pairs) {
      it(`"${name}" ${pair.key}`, () => {
        const isAdmonition = pair.key.startsWith("admonition-");
        const map = isAdmonition ? ADMONITION_ALLOWLIST : ALLOWLIST;
        const key = `${name}:${pair.key}`;
        if (map[key]) {
          _allowlistHits.add(key);
          return;
        }

        expect(
          pair.ratio,
          `"${name}" ${pair.label}: ${pair.fg} vs ${pair.bg}: ${pair.ratio.toFixed(2)}:1 (need ≥ ${pair.threshold}:1)`,
        ).toBeGreaterThanOrEqual(pair.threshold);
      });
    }
  }

  describe("allowlist integrity — no stale entries", () => {
    it("every ALLOWLIST key matches at least one test", () => {
      for (const key of Object.keys(ALLOWLIST)) {
        expect(
          _allowlistHits.has(key),
          `ALLOWLIST key "${key}" was never consulted — remove it (stale allowlist entry)`,
        ).toBe(true);
      }
    });

    it("every ADMONITION_ALLOWLIST key matches at least one test", () => {
      for (const key of Object.keys(ADMONITION_ALLOWLIST)) {
        expect(
          _allowlistHits.has(key),
          `ADMONITION_ALLOWLIST key "${key}" was never consulted — remove it (stale allowlist entry)`,
        ).toBe(true);
      }
    });
  });
});
