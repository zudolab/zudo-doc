import { describe, it, expect } from "vitest";
import {
  shouldGeneratePostBuild,
  DOC_HISTORY_GEN_ENV,
  DOC_HISTORY_SKIP_POSTBUILD_ENV,
} from "../index.js";

// #1986: postBuild per-page JSON generation flipped from opt-out to opt-in for
// local builds. These cases lock in the decision table so a future refactor
// can't silently re-introduce the 120s-budget failure (local default = skip)
// or break CI parity (CI default = generate).
describe("shouldGeneratePostBuild", () => {
  it("skips by default on a plain local build (no relevant env)", () => {
    const r = shouldGeneratePostBuild({});
    expect(r.generate).toBe(false);
    expect(r.reason).toContain(DOC_HISTORY_GEN_ENV);
  });

  it("generates when GEN_DOC_HISTORY=1 (explicit local opt-in)", () => {
    const r = shouldGeneratePostBuild({ [DOC_HISTORY_GEN_ENV]: "1" });
    expect(r.generate).toBe(true);
    expect(r.reason).toBe(`${DOC_HISTORY_GEN_ENV}=1`);
  });

  it("generates in CI (CI=true) to keep the build-site artifact identical", () => {
    expect(shouldGeneratePostBuild({ CI: "true" })).toEqual({
      generate: true,
      reason: "CI",
    });
  });

  it("generates in GitHub Actions (GITHUB_ACTIONS=true)", () => {
    expect(shouldGeneratePostBuild({ GITHUB_ACTIONS: "true" }).generate).toBe(
      true,
    );
  });

  it("SKIP_DOC_HISTORY=1 always wins (over CI)", () => {
    const r = shouldGeneratePostBuild({ SKIP_DOC_HISTORY: "1", CI: "true" });
    expect(r.generate).toBe(false);
    expect(r.reason).toBe("SKIP_DOC_HISTORY=1");
  });

  it("SKIP_DOC_HISTORY=1 always wins (over GEN_DOC_HISTORY=1)", () => {
    const r = shouldGeneratePostBuild({
      SKIP_DOC_HISTORY: "1",
      [DOC_HISTORY_GEN_ENV]: "1",
    });
    expect(r.generate).toBe(false);
  });

  it("ignores non-'1' truthy-ish values for the opt-in flag", () => {
    expect(shouldGeneratePostBuild({ [DOC_HISTORY_GEN_ENV]: "true" }).generate).toBe(
      false,
    );
    expect(shouldGeneratePostBuild({ [DOC_HISTORY_GEN_ENV]: "0" }).generate).toBe(
      false,
    );
  });

  // #2927: DOC_HISTORY_SKIP_POSTBUILD=1 skips only the heavy postBuild step,
  // independent of preBuild (see pre-build-manifest.test.ts for that half).
  // Priority order: SKIP_DOC_HISTORY > DOC_HISTORY_SKIP_POSTBUILD >
  // GEN_DOC_HISTORY > CI > default.
  it("DOC_HISTORY_SKIP_POSTBUILD=1 skips, even in CI", () => {
    const r = shouldGeneratePostBuild({
      [DOC_HISTORY_SKIP_POSTBUILD_ENV]: "1",
      CI: "true",
    });
    expect(r.generate).toBe(false);
    expect(r.reason).toBe(`${DOC_HISTORY_SKIP_POSTBUILD_ENV}=1`);
  });

  it("DOC_HISTORY_SKIP_POSTBUILD=1 loses to SKIP_DOC_HISTORY=1", () => {
    const r = shouldGeneratePostBuild({
      SKIP_DOC_HISTORY: "1",
      [DOC_HISTORY_SKIP_POSTBUILD_ENV]: "1",
    });
    expect(r.generate).toBe(false);
    expect(r.reason).toBe("SKIP_DOC_HISTORY=1");
  });

  it("DOC_HISTORY_SKIP_POSTBUILD=1 wins over GEN_DOC_HISTORY=1 (explicit skip beats explicit generate)", () => {
    const r = shouldGeneratePostBuild({
      [DOC_HISTORY_SKIP_POSTBUILD_ENV]: "1",
      [DOC_HISTORY_GEN_ENV]: "1",
    });
    expect(r.generate).toBe(false);
    expect(r.reason).toBe(`${DOC_HISTORY_SKIP_POSTBUILD_ENV}=1`);
  });

  it("ignores non-'1' truthy-ish values for DOC_HISTORY_SKIP_POSTBUILD", () => {
    expect(
      shouldGeneratePostBuild({ [DOC_HISTORY_SKIP_POSTBUILD_ENV]: "true" })
        .generate,
    ).toBe(false); // falls through to the local default, still false
    expect(
      shouldGeneratePostBuild({
        [DOC_HISTORY_SKIP_POSTBUILD_ENV]: "true",
        CI: "true",
      }).generate,
    ).toBe(true); // non-'1' does NOT trigger the skip, so CI still generates
  });
});
