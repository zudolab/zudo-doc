import { describe, expect, it } from "vitest";

import {
  checkParity,
  extractB4pushInvocations,
  REQUIRED_CI_GUARDS,
} from "../check-b4push-ci-parity.mjs";

type Guard = {
  ciNeedle: string;
  b4pushScript: string | null;
  comment: string;
};

const REGION_OPEN = "# >>> b4push-ci-parity:guards:begin";
const REGION_CLOSE = "# <<< b4push-ci-parity:guards:end";

function region(body: string) {
  return [REGION_OPEN, body, REGION_CLOSE].join("\n");
}

function runParity(guards: Guard[], b4pushSrc: string) {
  return checkParity({
    workflowSrc: guards.map((guard) => `run: ${guard.ciNeedle}`).join("\n"),
    b4pushSrc,
    allowlist: new Set<string>(),
    guards,
  });
}

describe("checkParity", () => {
  it("passes a fixture covered in CI and by b4push", () => {
    const guards: Guard[] = [
      {
        ciNeedle: "check:one-ci",
        b4pushScript: "check:one",
        comment: "one",
      },
      {
        ciNeedle: "check:two-ci",
        b4pushScript: "check:two",
        comment: "two",
      },
    ];

    expect(
      runParity(guards, region("pnpm run check:one\npnpm --filter @scope/pkg check:two")),
    ).toEqual({ errors: [] });
  });

  it("reports the chrome-bindings drift step when it is removed but its manifest entry remains", () => {
    const chromeGuard = REQUIRED_CI_GUARDS.find(
      (guard) => guard.b4pushScript === "check:chrome-bindings-fixture-drift",
    );
    if (!chromeGuard) throw new Error("chrome-bindings guard is missing from the manifest");

    const withStep = region(`pnpm ${chromeGuard.b4pushScript}`);
    const withoutStep = withStep.replace(`pnpm ${chromeGuard.b4pushScript}`, "");
    const { errors } = runParity([chromeGuard], withoutStep);

    expect(errors).toEqual([
      expect.stringContaining("[manifest→b4push]"),
    ]);
    expect(errors[0]).toContain("restore the b4push step");
    expect(errors[0]).toContain("remove the \"check:chrome-bindings-fixture-drift\" manifest entry");
  });

  it("does not count a script named only on a full-line shell comment", () => {
    const guard: Guard = {
      ciNeedle: "check:comment-only-ci",
      b4pushScript: "check:comment-only",
      comment: "comment-only",
    };

    expect(extractB4pushInvocations("# pnpm check:comment-only")).toEqual([]);
    expect(runParity([guard], region("# pnpm check:comment-only")).errors).toEqual([
      expect.stringContaining("[manifest→b4push]"),
    ]);
  });

  it("sees both invocations when one shell line carries two pnpm calls", () => {
    const guards: Guard[] = [
      {
        ciNeedle: "check:first-ci",
        b4pushScript: "check:first",
        comment: "first",
      },
      {
        ciNeedle: "check:second-ci",
        b4pushScript: "check:second",
        comment: "second",
      },
    ];
    const source = region(
      "if pnpm check:first && pnpm --filter @scope/pkg check:second; then\nfi",
    );

    expect(extractB4pushInvocations(source)).toEqual(["check:first", "check:second"]);
    expect(runParity(guards, source)).toEqual({ errors: [] });
  });

  it("recognizes the --filter invocation form", () => {
    const guard: Guard = {
      ciNeedle: "check:filtered-ci",
      b4pushScript: "check:filtered",
      comment: "filtered",
    };
    const source = region("pnpm --filter @scope/pkg check:filtered");

    expect(extractB4pushInvocations(source)).toEqual(["check:filtered"]);
    expect(runParity([guard], source)).toEqual({ errors: [] });
  });

  it("does not let a prefix collision satisfy a manifest entry", () => {
    const guard: Guard = {
      ciNeedle: "check:foo-ci",
      b4pushScript: "check:foo",
      comment: "foo",
    };
    const source = region("pnpm check:foo-bar");

    expect(extractB4pushInvocations(source)).toEqual(["check:foo-bar"]);
    expect(runParity([guard], source).errors).toEqual(
      expect.arrayContaining([expect.stringContaining("[manifest→b4push]")]),
    );
  });

  it("skips manifest entries whose b4pushScript is null", () => {
    const guard: Guard = {
      ciNeedle: "check:raw-ci",
      b4pushScript: null,
      comment: "raw invocation",
    };

    expect(runParity([guard], region("bash scripts/check-raw.sh"))).toEqual({ errors: [] });
  });
});
