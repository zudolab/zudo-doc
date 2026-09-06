// CONFORMANCE GUARD for the vendored zdtp constants (#4009 / #4018).
//
// `src/design-token-panel-constants.ts` is a hand-written mirror of
// `@takazudo/zdtp`'s public `/constants` leaf. It exists so the always-bundled
// chrome graph carries no static `@takazudo/zdtp` edge — zdtp is an OPTIONAL
// peer, and the static import made it mandatory at build time for every
// consumer (see that module's header). This test is the reason the mirror may
// be trusted: it compares it against the REAL leaf, which is legal here because
// zdtp IS installed in this repo (precedent: design-token-panel-bootstrap.test.ts).
//
// DIRECTION IS FORWARD ONLY: everything vendored must match upstream. The
// reverse (upstream exports ⊆ vendored) is deliberately NOT asserted — upstream
// is free to add constants this package does not use, and asserting it would
// turn every unrelated zdtp release into a red build.
//
// The peer range in package.json is `^0.5.1` (>=0.5.1 <0.6.0), which bounds the
// drift this test has to catch; a future widening to `^0.6` is exactly when it
// earns its keep.

import { describe, expect, it } from "vitest";
import * as real from "@takazudo/zdtp/constants";
import * as vendored from "../design-token-panel-constants.js";

describe("vendored zdtp constants conform to the real /constants leaf", () => {
  it("mirrors the scalar defaults", () => {
    expect(vendored.DEFAULT_STORAGE_PREFIX).toEqual(real.DEFAULT_STORAGE_PREFIX);
    expect(vendored.DEFAULT_TOGGLE_EVENT).toEqual(real.DEFAULT_TOGGLE_EVENT);
  });

  it("mirrors EAGER_LOAD_GATE_KEY_SUFFIXES exactly", () => {
    expect(vendored.EAGER_LOAD_GATE_KEY_SUFFIXES).toEqual(
      real.EAGER_LOAD_GATE_KEY_SUFFIXES,
    );
  });

  it("mirrors the data members of EAGER_LOAD_GATE_STATE_FAMILY", () => {
    // A whole-object `toEqual` cannot work: `matchesKey` is a function, and two
    // distinct function instances are never `toEqual`-equal. Compare the data
    // by value, the member set by name, and the function behaviourally (below).
    expect(vendored.EAGER_LOAD_GATE_STATE_FAMILY.keySuffixes).toEqual(
      real.EAGER_LOAD_GATE_STATE_FAMILY.keySuffixes,
    );
    expect(vendored.EAGER_LOAD_GATE_STATE_FAMILY.valueRules).toEqual(
      real.EAGER_LOAD_GATE_STATE_FAMILY.valueRules,
    );
    // An upstream-added member of that object must fail here.
    expect(Object.keys(vendored.EAGER_LOAD_GATE_STATE_FAMILY).sort()).toEqual(
      Object.keys(real.EAGER_LOAD_GATE_STATE_FAMILY).sort(),
    );
  });

  it("matchesKey agrees with upstream over registered, near-miss, and foreign keys", () => {
    const prefix = "p";
    // Positives are DERIVED from the real registry, so a future upstream
    // version contributes its own cases without editing this test.
    const positives = Object.values(real.EAGER_LOAD_GATE_STATE_FAMILY.keySuffixes).map(
      (suffix) => prefix + suffix,
    );
    const negatives = [
      `${prefix}-state-v5`, // unregistered version
      `${prefix}-state-v2x`, // near-miss suffix
      "other-state", // foreign prefix
      `${prefix}${prefix}-state`, // sibling instance (prefix `p` vs key `pp-state`)
      prefix, // the bare prefix
      "", // empty key
    ];

    expect(positives.length).toBeGreaterThan(0);
    for (const key of [...positives, ...negatives]) {
      expect(
        vendored.EAGER_LOAD_GATE_STATE_FAMILY.matchesKey(prefix, key),
        `matchesKey(${JSON.stringify(prefix)}, ${JSON.stringify(key)})`,
      ).toBe(real.EAGER_LOAD_GATE_STATE_FAMILY.matchesKey(prefix, key));
    }
    // Anti-vacuity: the matrix must contain both outcomes, or an
    // always-false implementation would pass.
    for (const key of positives) {
      expect(vendored.EAGER_LOAD_GATE_STATE_FAMILY.matchesKey(prefix, key)).toBe(true);
    }
    for (const key of negatives) {
      expect(vendored.EAGER_LOAD_GATE_STATE_FAMILY.matchesKey(prefix, key)).toBe(false);
    }
  });

  it("resolveToggleEventName agrees with upstream, including the default-prefix override rule", () => {
    const cases: { storagePrefix?: string; toggleEvent?: string }[] = [
      {},
      { storagePrefix: real.DEFAULT_STORAGE_PREFIX },
      // The default prefix keeps the historical event name even when the caller
      // supplies an explicit toggleEvent — the rule most likely to be
      // "simplified" away by a well-meaning edit.
      { storagePrefix: real.DEFAULT_STORAGE_PREFIX, toggleEvent: "custom" },
      { storagePrefix: "other" },
      { storagePrefix: "other", toggleEvent: "custom" },
    ];
    for (const cfg of cases) {
      expect(vendored.resolveToggleEventName(cfg), JSON.stringify(cfg)).toBe(
        real.resolveToggleEventName(cfg),
      );
    }
  });
});
