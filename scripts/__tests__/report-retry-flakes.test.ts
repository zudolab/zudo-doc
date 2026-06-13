import { describe, it, expect } from "vitest";
import { findRetryFlakes } from "../report-retry-flakes.mjs";

// Minimal synthetic Playwright JSON report fixtures used to verify the parsing
// logic without running the actual E2E suite.

/** Builds a minimal Playwright TestCase object. */
function makeTest(
  title: string,
  file: string,
  status: "passed" | "failed" | "skipped",
  resultStatuses: Array<"passed" | "failed" | "timedOut">,
) {
  return {
    title,
    file,
    status,
    results: resultStatuses.map((s) => ({ status: s })),
  };
}

/** Wraps test cases in the minimal suite+report envelope. */
function makeReport(tests: ReturnType<typeof makeTest>[]) {
  return {
    suites: [
      {
        title: "root",
        suites: [
          {
            title: "e2e suite",
            tests,
            suites: [],
          },
        ],
        tests: [],
      },
    ],
  };
}

describe("findRetryFlakes", () => {
  it("returns no annotations for a test that passed on the first try", () => {
    const report = makeReport([
      makeTest("loads the home page", "e2e/smoke.spec.ts", "passed", [
        "passed",
      ]),
    ]);

    const flakes = findRetryFlakes(report);
    expect(flakes).toEqual([]);
  });

  it("returns an annotation for a test that passed on retry", () => {
    const report = makeReport([
      makeTest("sidebar opens", "e2e/sidebar.spec.ts", "passed", [
        "failed",
        "passed",
      ]),
    ]);

    const flakes = findRetryFlakes(report);
    expect(flakes).toHaveLength(1);
    expect(flakes[0]).toEqual({
      file: "e2e/sidebar.spec.ts",
      title: "sidebar opens",
      retryNumber: 1,
    });
  });

  it("returns no annotations for a test that ultimately failed", () => {
    // Even if there were multiple attempts, if it did not pass we do not emit.
    const report = makeReport([
      makeTest("i18n page loads", "e2e/i18n.spec.ts", "failed", [
        "failed",
        "failed",
      ]),
    ]);

    const flakes = findRetryFlakes(report);
    expect(flakes).toEqual([]);
  });

  it("handles multiple tests with mixed outcomes", () => {
    const report = makeReport([
      makeTest("passes first try", "e2e/smoke.spec.ts", "passed", ["passed"]),
      makeTest("flaky test", "e2e/theme.spec.ts", "passed", [
        "failed",
        "passed",
      ]),
      makeTest("total failure", "e2e/i18n.spec.ts", "failed", [
        "failed",
        "failed",
      ]),
    ]);

    const flakes = findRetryFlakes(report);
    expect(flakes).toHaveLength(1);
    expect(flakes[0]?.title).toBe("flaky test");
    expect(flakes[0]?.retryNumber).toBe(1);
  });

  it("returns empty array for an empty report", () => {
    expect(findRetryFlakes({ suites: [] })).toEqual([]);
  });

  it("returns empty array for a null/undefined report", () => {
    // @ts-expect-error testing runtime guard
    expect(findRetryFlakes(null)).toEqual([]);
    // @ts-expect-error testing runtime guard
    expect(findRetryFlakes(undefined)).toEqual([]);
  });

  it("correctly sets retryNumber to the 1-based attempt that succeeded", () => {
    // 3 attempts: failed, failed, passed → retryNumber should be 2
    const report = makeReport([
      makeTest("double retry", "e2e/versioning.spec.ts", "passed", [
        "failed",
        "failed",
        "passed",
      ]),
    ]);

    const flakes = findRetryFlakes(report);
    expect(flakes).toHaveLength(1);
    expect(flakes[0]?.retryNumber).toBe(2);
  });
});
