import { describe, it, expect } from "vitest";
import {
  RETRY_FLAKE_LABEL,
  buildRetryFlakeIssueTitle,
  buildRetryFlakeIssueBody,
  findMatchingRetryFlakeIssue,
  dedupeFlakes,
} from "../lib/file-retry-flake-issue.mjs";

describe("buildRetryFlakeIssueTitle", () => {
  it("embeds the file and test title", () => {
    const title = buildRetryFlakeIssueTitle({
      file: "e2e/sidebar.spec.ts",
      title: "sidebar opens",
    });
    expect(title).toBe("[retry-flake] e2e/sidebar.spec.ts › sidebar opens");
  });

  it("is stable (dedup key) across calls with the same flake identity", () => {
    const flake = { file: "e2e/theme.spec.ts", title: "theme toggles" };
    expect(buildRetryFlakeIssueTitle(flake)).toBe(
      buildRetryFlakeIssueTitle({ ...flake }),
    );
  });

  it("produces different titles for different tests in the same file", () => {
    const a = buildRetryFlakeIssueTitle({
      file: "e2e/smoke.spec.ts",
      title: "test A",
    });
    const b = buildRetryFlakeIssueTitle({
      file: "e2e/smoke.spec.ts",
      title: "test B",
    });
    expect(a).not.toBe(b);
  });
});

describe("buildRetryFlakeIssueBody", () => {
  it("includes the file, run URL, and retry number", () => {
    const body = buildRetryFlakeIssueBody(
      { file: "e2e/i18n.spec.ts", title: "loads ja locale", retryNumber: 1 },
      "https://github.com/zudolab/zudo-doc/actions/runs/123",
    );
    expect(body).toContain("e2e/i18n.spec.ts");
    expect(body).toContain("https://github.com/zudolab/zudo-doc/actions/runs/123");
    expect(body).toContain("**Passed on retry:** 1");
    expect(body).toContain("@flaky");
  });

  it("omits the retry-number line when retryNumber is not provided", () => {
    const body = buildRetryFlakeIssueBody(
      { file: "e2e/versioning.spec.ts", title: "switches version" },
      "https://github.com/zudolab/zudo-doc/actions/runs/456",
    );
    expect(body).not.toContain("Passed on retry");
  });
});

describe("findMatchingRetryFlakeIssue", () => {
  const flake = { file: "e2e/sidebar.spec.ts", title: "sidebar opens" };

  it("returns null when no open issues exist", () => {
    expect(findMatchingRetryFlakeIssue([], flake)).toBeNull();
  });

  it("returns null for an empty/malformed input", () => {
    // @ts-expect-error testing runtime guard
    expect(findMatchingRetryFlakeIssue(null, flake)).toBeNull();
    // @ts-expect-error testing runtime guard
    expect(findMatchingRetryFlakeIssue(undefined, flake)).toBeNull();
  });

  it("matches an existing issue by exact dedup-key title", () => {
    const openIssues = [
      { number: 10, title: "[retry-flake] e2e/sidebar.spec.ts › sidebar opens" },
      { number: 11, title: "[retry-flake] e2e/theme.spec.ts › theme toggles" },
    ];
    expect(findMatchingRetryFlakeIssue(openIssues, flake)).toBe(10);
  });

  it("does not match a different test in the same file (per-test dedup, not per-file)", () => {
    const openIssues = [
      { number: 20, title: "[retry-flake] e2e/sidebar.spec.ts › a different test" },
    ];
    expect(findMatchingRetryFlakeIssue(openIssues, flake)).toBeNull();
  });

  it("does not match the same test title in a different file", () => {
    const openIssues = [
      { number: 30, title: "[retry-flake] e2e/other.spec.ts › sidebar opens" },
    ];
    expect(findMatchingRetryFlakeIssue(openIssues, flake)).toBeNull();
  });
});

describe("RETRY_FLAKE_LABEL", () => {
  it("is the fixed label string used for both filing and lookup", () => {
    expect(RETRY_FLAKE_LABEL).toBe("retry-flake");
  });
});

describe("dedupeFlakes", () => {
  it("keeps a single entry per file+title, discarding later duplicates", () => {
    // Mirrors the real cause: the same spec flaking under two Playwright
    // projects (e.g. "smoke" and "i18n") produces two flake entries with
    // identical file+title but different retryNumber.
    const flakes = [
      { file: "e2e/smoke.spec.ts", title: "loads the home page", retryNumber: 1 },
      { file: "e2e/smoke.spec.ts", title: "loads the home page", retryNumber: 2 },
      { file: "e2e/theme.spec.ts", title: "theme toggles", retryNumber: 1 },
    ];
    const result = dedupeFlakes(flakes);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(flakes[0]);
    expect(result[1]).toEqual(flakes[2]);
  });

  it("does not collapse different tests", () => {
    const flakes = [
      { file: "e2e/a.spec.ts", title: "test A", retryNumber: 1 },
      { file: "e2e/b.spec.ts", title: "test A", retryNumber: 1 },
      { file: "e2e/a.spec.ts", title: "test B", retryNumber: 1 },
    ];
    expect(dedupeFlakes(flakes)).toHaveLength(3);
  });

  it("returns an empty array for an empty input", () => {
    expect(dedupeFlakes([])).toEqual([]);
  });
});
