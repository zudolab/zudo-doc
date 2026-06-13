import { describe, it, expect } from "vitest";
import { findRetryFlakes } from "../report-retry-flakes.mjs";

// These fixtures mirror the ACTUAL Playwright JSON report shape:
//   report.suites[].specs[].tests[].results[]
// with the per-test outcome on `test.status` ("expected"|"flaky"|...) and the
// per-attempt status + 0-based `retry` on each result. The earlier version of
// this test used a `suite.tests[]` shape that Playwright never emits, which is
// why a parser walking the wrong shape passed its unit test yet found nothing
// against real reports. Keep these fixtures faithful to the real shape.

type ResultStatus = "passed" | "failed" | "timedOut";
type TestOutcome = "expected" | "unexpected" | "flaky" | "skipped";

/** Builds a real Playwright spec object (one test() call). */
function makeSpec(
  title: string,
  file: string,
  outcome: TestOutcome,
  attempts: ResultStatus[],
) {
  return {
    title,
    file,
    tests: [
      {
        projectName: "smoke",
        status: outcome,
        results: attempts.map((status, i) => ({ status, retry: i })),
      },
    ],
  };
}

/** Wraps specs in the real suites envelope, with file on the suite. */
function makeReport(specs: ReturnType<typeof makeSpec>[]) {
  return {
    suites: [
      {
        title: "root",
        file: "e2e/suite.spec.ts",
        suites: [
          {
            title: "describe block",
            file: "e2e/suite.spec.ts",
            specs,
            suites: [],
          },
        ],
        specs: [],
      },
    ],
  };
}

describe("findRetryFlakes", () => {
  it("returns no annotations for a test that passed on the first try", () => {
    const report = makeReport([
      makeSpec("loads the home page", "e2e/smoke.spec.ts", "expected", [
        "passed",
      ]),
    ]);
    expect(findRetryFlakes(report)).toEqual([]);
  });

  it("returns an annotation for a flaky test (passed on retry)", () => {
    const report = makeReport([
      makeSpec("sidebar opens", "e2e/sidebar.spec.ts", "flaky", [
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

  it("detects a retry-pass structurally even if outcome is not labelled flaky", () => {
    // Belt-and-suspenders: a passing final result after a real retry.
    const report = makeReport([
      makeSpec("structural retry", "e2e/theme.spec.ts", "expected", [
        "failed",
        "passed",
      ]),
    ]);
    const flakes = findRetryFlakes(report);
    expect(flakes).toHaveLength(1);
    expect(flakes[0]?.title).toBe("structural retry");
  });

  it("returns no annotations for a test that ultimately failed", () => {
    const report = makeReport([
      makeSpec("i18n page loads", "e2e/i18n.spec.ts", "unexpected", [
        "failed",
        "failed",
      ]),
    ]);
    expect(findRetryFlakes(report)).toEqual([]);
  });

  it("handles multiple specs with mixed outcomes", () => {
    const report = makeReport([
      makeSpec("passes first try", "e2e/smoke.spec.ts", "expected", ["passed"]),
      makeSpec("flaky test", "e2e/theme.spec.ts", "flaky", ["failed", "passed"]),
      makeSpec("total failure", "e2e/i18n.spec.ts", "unexpected", [
        "failed",
        "failed",
      ]),
    ]);
    const flakes = findRetryFlakes(report);
    expect(flakes).toHaveLength(1);
    expect(flakes[0]?.title).toBe("flaky test");
    expect(flakes[0]?.retryNumber).toBe(1);
  });

  it("inherits the spec file from the parent suite when omitted", () => {
    // Specs sometimes carry the file only on the enclosing suite.
    const report = {
      suites: [
        {
          title: "root",
          file: "e2e/inherited.spec.ts",
          specs: [
            {
              title: "no own file",
              tests: [
                {
                  status: "flaky",
                  results: [
                    { status: "failed", retry: 0 },
                    { status: "passed", retry: 1 },
                  ],
                },
              ],
            },
          ],
          suites: [],
        },
      ],
    };
    const flakes = findRetryFlakes(report);
    expect(flakes).toHaveLength(1);
    expect(flakes[0]?.file).toBe("e2e/inherited.spec.ts");
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

  it("sets retryNumber to the retry index of the passing attempt", () => {
    // 3 attempts: failed (retry 0), failed (retry 1), passed (retry 2).
    const report = makeReport([
      makeSpec("double retry", "e2e/versioning.spec.ts", "flaky", [
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
