/**
 * nav-overflow-script.test.ts
 *
 * Guards the ../nav-overflow-script.ts embedding contract (zudolab/zudo-doc#3534,
 * epic #3533): NAV_OVERFLOW_SCRIPT is a frozen string literal generated at
 * package build time by scripts/gen-nav-overflow-script.mjs from the real
 * ../../current-path/index.ts, ../nav-active.ts, ../nav-class-tokens.ts, and
 * ../../transitions/page-events.ts sources — not a live
 * Function.prototype.toString() reflection executed at module evaluation.
 * The drift guard below re-runs the real generator logic (fresh transpile of
 * the current source files) and proves the frozen NAV_OVERFLOW_SCRIPT still
 * matches it byte-for-byte, catching the case where one of those four source
 * files changed but nav-overflow-generated-script.ts was never regenerated.
 * The active-path matching behavior itself is covered separately by
 * nav-overflow-active-exec.test.ts (execution) and nav-class-tokens.test.ts
 * (emitted class text).
 *
 * Guard scope, honestly stated: a bare `pnpm --filter @takazudo/zudo-doc
 * test` regenerates nothing, so NAV_OVERFLOW_SCRIPT here is whatever is on
 * disk. But root `pnpm test` (via build:workspace) and the package build DO
 * re-run the generator first, and in b4push/CI the check:nav-overflow-drift
 * step runs before this lane — in those paths a stale file has already been
 * rewritten and the byte-equality below is trivially true. The
 * committed-bytes invariant is then carried by the shell drift guard's
 * `git diff` (an uncommitted rewrite fails it) plus the CSP hash pin below
 * (any content change fails it) — mirroring the search-widget-script drift
 * guard (src/search-widget-script/__tests__/index.test.ts).
 */

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { NAV_OVERFLOW_SCRIPT } from "../nav-overflow-script.js";
import { buildNavOverflowScript } from "../../../scripts/gen-nav-overflow-script.mjs";
import { AFTER_NAVIGATE_EVENT } from "../../transitions/index.js";

// CSP hash-source (base64, sha256-<digest> — CSP hash-source syntax) pinned
// against NAV_OVERFLOW_SCRIPT's current frozen bytes. A failure here means
// the shipped script bytes genuinely changed (one of the four source files
// was edited and regenerated) — update the pin as a deliberate, reviewed
// diff.
const EXPECTED_CSP_HASH = "sha256-si3ayGcUoupfGT7ImFcKMKvaMw5Wrt5R86GI5P0dMCc=";

describe("NAV_OVERFLOW_SCRIPT generation", () => {
  it("matches a fresh re-generation from the four source files (drift guard)", () => {
    expect(NAV_OVERFLOW_SCRIPT).toBe(buildNavOverflowScript());
  });

  it("embeds the real AFTER_NAVIGATE_EVENT value", () => {
    expect(NAV_OVERFLOW_SCRIPT).toContain(JSON.stringify(AFTER_NAVIGATE_EVENT));
  });

  it("produces syntactically valid JavaScript", () => {
    // Parses the whole IIFE body without executing it (no live DOM query
    // targets in this bare parse check — nav-overflow-active-exec.test.ts
    // covers actual execution against a real DOM).
    expect(() => new Function(NAV_OVERFLOW_SCRIPT)).not.toThrow();
  });

  it("pins a stable CSP hash-source so any content change is a deliberate diff", () => {
    const digest = createHash("sha256").update(NAV_OVERFLOW_SCRIPT, "utf8").digest("base64");
    expect(`sha256-${digest}`).toBe(EXPECTED_CSP_HASH);
  });
});
