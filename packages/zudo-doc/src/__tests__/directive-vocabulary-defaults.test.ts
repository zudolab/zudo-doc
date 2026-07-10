import { describe, it, expect } from "vitest";
import { defaultDirectiveVocabulary } from "../directive-vocabulary-defaults/index.js";

// Formerly also parity-checked against a hardcoded `directiveVocabulary`
// block that used to live in both the showcase's root `zfb.config.ts` and
// the generator's `zfb-config-gen.ts`. The minimal-scaffold cutover (epic
// #2651: Wave 4 #2657's `zudoDoc()` API + Wave 6 #2660/#2661) made
// directiveVocabulary a pure package default consumed automatically — no
// host file hardcodes it anymore, so a text-extraction parity test against
// either file finds nothing to compare (found stale during the #2667
// final-confirm gate — see the same note in i18n-defaults.test.ts for why
// no earlier wave caught this). The canonical-seven-directives test below
// already pins the actual default value.
describe("defaultDirectiveVocabulary", () => {
  it("is the canonical seven directives", () => {
    expect(defaultDirectiveVocabulary).toEqual({
      note: "Note",
      tip: "Tip",
      info: "Info",
      warning: "Warning",
      danger: "Danger",
      caution: "Caution",
      details: "Details",
    });
  });

  it("is a plain serializable Record<string, string>", () => {
    expect(() => JSON.parse(JSON.stringify(defaultDirectiveVocabulary))).not.toThrow();
  });
});
