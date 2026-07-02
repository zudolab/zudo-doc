/**
 * index.test.ts
 *
 * Guards the ../index.ts embedding contract: SEARCH_WIDGET_SCRIPT must embed
 * the real prepareLc/scoreEntry source from ../scoring.ts verbatim (via
 * Function.prototype.toString()), not a hand-copied mirror. This is a
 * regression guard for the embedding mechanism itself — the scoring logic's
 * own behavior is covered by scoring.test.ts.
 */

import { describe, it, expect } from "vitest";
import { SEARCH_WIDGET_SCRIPT } from "../index.js";
import { prepareLc, scoreEntry } from "../scoring.js";

describe("SEARCH_WIDGET_SCRIPT embedding", () => {
  it("embeds the real prepareLc source verbatim", () => {
    expect(SEARCH_WIDGET_SCRIPT).toContain(prepareLc.toString());
  });

  it("embeds the real scoreEntry source verbatim", () => {
    expect(SEARCH_WIDGET_SCRIPT).toContain(scoreEntry.toString());
  });

  it("produces syntactically valid JavaScript", () => {
    // Parses the whole IIFE body without executing it (no DOM in this test
    // environment — customElements.define etc. would throw at call time).
    expect(() => new Function(SEARCH_WIDGET_SCRIPT)).not.toThrow();
  });
});
