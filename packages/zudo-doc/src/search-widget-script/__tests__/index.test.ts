/**
 * index.test.ts
 *
 * Guards the ../index.ts embedding contract (zudolab/zudo-doc#3412):
 * SEARCH_WIDGET_SCRIPT is a frozen string literal generated at package build
 * time by scripts/gen-search-widget-script.mjs from the real, unit-tested
 * ../scoring.ts source and the real ../../transitions/page-events.ts
 * AFTER_NAVIGATE_EVENT value — not a live Function.prototype.toString()
 * reflection executed at module evaluation. The drift guard below re-runs
 * the real generator logic (fresh transpile of the current source files)
 * and proves the frozen SEARCH_WIDGET_SCRIPT still matches it byte-for-byte,
 * catching the case where scoring.ts / page-events.ts changed but
 * generated-script.ts was never regenerated. The scoring logic's own
 * behavior is covered separately by scoring.test.ts.
 */

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { SEARCH_WIDGET_SCRIPT } from "../index.js";
import { buildSearchWidgetScript } from "../../../scripts/gen-search-widget-script.mjs";
import { AFTER_NAVIGATE_EVENT } from "../../transitions/index.js";

// CSP hash-source (base64, sha256-<digest> — CSP hash-source syntax) pinned
// against SEARCH_WIDGET_SCRIPT's current frozen bytes. A failure here means
// the shipped script bytes genuinely changed (a scoring.ts / page-events.ts
// edit was regenerated) — update the pin as a deliberate, reviewed diff.
const EXPECTED_CSP_HASH = "sha256-+5B4Vd+U+da3+BnCkNPUykM/fhmKrp1vv/H9rtLotp8=";

describe("SEARCH_WIDGET_SCRIPT generation", () => {
  it("matches a fresh re-generation from scoring.ts + page-events.ts (drift guard)", () => {
    expect(SEARCH_WIDGET_SCRIPT).toBe(buildSearchWidgetScript());
  });

  it("embeds the real AFTER_NAVIGATE_EVENT value", () => {
    expect(SEARCH_WIDGET_SCRIPT).toContain(JSON.stringify(AFTER_NAVIGATE_EVENT));
  });

  it("produces syntactically valid JavaScript", () => {
    // Parses the whole IIFE body without executing it (no DOM in this test
    // environment — customElements.define etc. would throw at call time).
    expect(() => new Function(SEARCH_WIDGET_SCRIPT)).not.toThrow();
  });

  it("pins a stable CSP hash-source so any content change is a deliberate diff", () => {
    const digest = createHash("sha256")
      .update(SEARCH_WIDGET_SCRIPT, "utf8")
      .digest("base64");
    expect(`sha256-${digest}`).toBe(EXPECTED_CSP_HASH);
  });
});
