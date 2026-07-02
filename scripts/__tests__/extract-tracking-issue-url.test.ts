import { describe, it, expect } from "vitest";
import { extractTrackingIssueUrl } from "../lib/extract-tracking-issue-url.mjs";

// ---------------------------------------------------------------------------
// Synthetic fixtures
// ---------------------------------------------------------------------------

const FIXTURE_SIMPLE = `
import { test } from "@playwright/test";

// Tracks: https://github.com/zudolab/zudo-doc/issues/1234
test("sidebar toggle persists @flaky", async ({ page }) => {
  // test body
});
`;

const FIXTURE_MULTILINE_COMMENT = `
import { test } from "@playwright/test";

// This test is quarantined due to timing issues.
// See tracking issue: https://github.com/zudolab/zudo-doc/issues/9999
// Last flapped: 2024-12-01
test("search result flickers on slow network @flaky", async ({ page }) => {
  // test body
});
`;

const FIXTURE_NO_COMMENT = `
import { test } from "@playwright/test";

test("some test without a tracking comment @flaky", async ({ page }) => {
  // test body
});
`;

const FIXTURE_BLOCK_COMMENT = `
import { test } from "@playwright/test";

/*
 * Tracking issue: https://github.com/zudolab/zudo-doc/issues/5678
 */
test("another flaky test @flaky", async ({ page }) => {
  // test body
});
`;

const FIXTURE_UNRELATED_CODE_BETWEEN = `
import { test } from "@playwright/test";

// https://github.com/zudolab/zudo-doc/issues/1111

const helper = () => {};

test("test with non-comment code between url and test @flaky", async ({ page }) => {
  // The comment is too far up — a non-comment line breaks the search
});
`;

const FIXTURE_MULTIPLE_TESTS = `
import { test } from "@playwright/test";

// https://github.com/zudolab/zudo-doc/issues/2222
test("first flaky test @flaky", async ({ page }) => {});

// https://github.com/zudolab/zudo-doc/issues/3333
test("second flaky test @flaky", async ({ page }) => {});
`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("extractTrackingIssueUrl", () => {
  it("extracts URL from a simple preceding comment line", () => {
    const url = extractTrackingIssueUrl(
      FIXTURE_SIMPLE,
      "sidebar toggle persists @flaky"
    );
    expect(url).toBe("https://github.com/zudolab/zudo-doc/issues/1234");
  });

  it("extracts URL from multiple comment lines (nearest URL wins)", () => {
    const url = extractTrackingIssueUrl(
      FIXTURE_MULTILINE_COMMENT,
      "search result flickers on slow network @flaky"
    );
    expect(url).toBe("https://github.com/zudolab/zudo-doc/issues/9999");
  });

  it("returns null when no comment with URL precedes the test", () => {
    const url = extractTrackingIssueUrl(
      FIXTURE_NO_COMMENT,
      "some test without a tracking comment @flaky"
    );
    expect(url).toBeNull();
  });

  it("extracts URL from a block-style comment", () => {
    const url = extractTrackingIssueUrl(
      FIXTURE_BLOCK_COMMENT,
      "another flaky test @flaky"
    );
    expect(url).toBe("https://github.com/zudolab/zudo-doc/issues/5678");
  });

  it("returns null when non-comment code separates URL comment from test", () => {
    const url = extractTrackingIssueUrl(
      FIXTURE_UNRELATED_CODE_BETWEEN,
      "test with non-comment code between url and test @flaky"
    );
    expect(url).toBeNull();
  });

  it("extracts the correct URL for each of multiple tests in one file", () => {
    const url1 = extractTrackingIssueUrl(
      FIXTURE_MULTIPLE_TESTS,
      "first flaky test @flaky"
    );
    const url2 = extractTrackingIssueUrl(
      FIXTURE_MULTIPLE_TESTS,
      "second flaky test @flaky"
    );
    expect(url1).toBe("https://github.com/zudolab/zudo-doc/issues/2222");
    expect(url2).toBe("https://github.com/zudolab/zudo-doc/issues/3333");
  });

  it("returns null for a test title that does not exist in the file", () => {
    const url = extractTrackingIssueUrl(FIXTURE_SIMPLE, "nonexistent test title");
    expect(url).toBeNull();
  });
});
