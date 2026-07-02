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
 * Built-in schemes (Default Light / Default Dark) are NOT special-cased here —
 * per the epic's Wave-3 batch plan, Default Light/Default Dark are Batch C
 * like every other scheme (see `ALLOWLIST`/`ADMONITION_ALLOWLIST` below); the
 * long-term goal (skill §4) is for both to pass clean.
 *
 * ALLOWLIST is a TEMPORARY, batch-tagged registry (epic #2489) of every pair
 * currently failing the full matrix. Every entry is tagged
 * `// TODO(scheme-a11y #2489) — remove in Batch {A|B|C|D}` and grouped into
 * four contiguous, clearly-marked batch regions so the four parallel Wave-3
 * batch PRs (#2493–#2496) touch disjoint line ranges. The reason string is
 * the currently-failing ratio/threshold — see the corresponding Wave-3 batch
 * issue for the full per-scheme inventory (colors, sources, `--suggest`
 * fragments). "Upstream fidelity" is NOT an acceptable long-term reason
 * (skill §2.5) — every entry here is scheduled for a real OKLCH tweak in its
 * batch, not permanent allowlisting.
 *
 * Allowlist entries are expected to fire — a spurious entry (key that never
 * matches a real test) is caught by the stale-key audit at the bottom of this
 * file.
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
