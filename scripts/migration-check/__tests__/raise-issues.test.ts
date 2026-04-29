/**
 * raise-issues.test.ts
 *
 * Unit tests for scripts/migration-check/raise-issues.mjs covering:
 *   - hashSignature: same input → same output (stable across runs)
 *   - hashSignature: different inputs → different hashes
 *   - buildIssueBody: contains back-links to #510, #480, #473
 *   - buildIssueBody: includes cluster fields
 *   - raiseIssues: creates issue when gh issue list returns no match
 *   - raiseIssues: skips creation when gh issue list finds existing hash marker
 *   - raiseIssues: idempotency property (second call is a no-op)
 *   - raiseIssues: dry-run never calls gh issue create
 *   - raiseIssues: returns correct created/skipped arrays
 *   - raiseIssues: handles empty findings gracefully
 *   - raiseIssues: does NOT actually call gh issue create from real gh
 */

import { mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir }               from "node:os";
import { join }                 from "node:path";
import { describe, it, expect, vi } from "vitest";

import {
  hashSignature,
  buildIssueBody,
  raiseIssues,
} from "../raise-issues.mjs";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal cluster object matching the shape from clusterFindings(). */
function makeCluster(overrides: Record<string, unknown> = {}) {
  return {
    signature:    "sha-a1::sha-b1",
    description:  "DOM shape changed (A: sha-a1… → B: sha-b1…)",
    routeCount:   3,
    sampleRoutes: ["/docs/page-0", "/docs/page-1", "/docs/page-2"],
    ...overrides,
  };
}

/**
 * Write a minimal findings directory with one batch file containing
 * `count` structural findings of the given signature pair.
 */
async function writeFindingsDir(
  dir: string,
  count: number,
  sigPair: { domShapeHashA: string; domShapeHashB: string } = {
    domShapeHashA: "aaaa1111",
    domShapeHashB: "bbbb2222",
  },
) {
  const findingsDir = join(dir, "findings");
  await mkdir(findingsDir, { recursive: true });

  const routes = Array.from({ length: count }, (_, i) => ({
    route:           `/docs/page-${i}`,
    category:        "structural",
    subCategory:     null,
    signals:         sigPair,
    diffSummaryHash: "diff-hash-1",
  }));

  const batch = { batchId: "0000", routes };
  await writeFile(join(findingsDir, "batch-0000.json"), JSON.stringify(batch, null, 2));

  return findingsDir;
}

// ── Unit: hashSignature ───────────────────────────────────────────────────────

describe("hashSignature — stable hashing", () => {
  it("returns the same 8-char hex string for the same input across multiple calls", () => {
    const sig    = "sha-a1::sha-b1";
    const hash1  = hashSignature(sig);
    const hash2  = hashSignature(sig);
    const hash3  = hashSignature(sig);

    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
    expect(hash1).toHaveLength(8);
    expect(hash1).toMatch(/^[0-9a-f]{8}$/);
  });

  it("returns different hashes for different signatures", () => {
    const h1 = hashSignature("sig-A");
    const h2 = hashSignature("sig-B");
    expect(h1).not.toBe(h2);
  });

  it("hash is stable regardless of when it is computed (no timestamp dependency)", () => {
    // Re-run several times with the exact same input — must always match.
    const sig      = "meta-changed::og-changed";
    const expected = hashSignature(sig);

    for (let i = 0; i < 5; i++) {
      expect(hashSignature(sig)).toBe(expected);
    }
  });
});

// ── Unit: buildIssueBody ──────────────────────────────────────────────────────

describe("buildIssueBody — back-links", () => {
  it("includes back-link to epic #510", () => {
    const body = buildIssueBody({
      category:   "structural",
      cluster:    makeCluster(),
      hashMarker: "abc12345",
    });
    expect(body).toContain("#510");
  });

  it("includes back-link to #480", () => {
    const body = buildIssueBody({
      category:   "structural",
      cluster:    makeCluster(),
      hashMarker: "abc12345",
    });
    expect(body).toContain("#480");
  });

  it("includes back-link to #473", () => {
    const body = buildIssueBody({
      category:   "structural",
      cluster:    makeCluster(),
      hashMarker: "abc12345",
    });
    expect(body).toContain("#473");
  });
});

describe("buildIssueBody — content", () => {
  const cluster = makeCluster({
    signature:    "sig-xyz",
    description:  "Test cluster description",
    routeCount:   5,
    sampleRoutes: ["/a", "/b", "/c"],
  });

  it("includes the hash marker in the body", () => {
    const body = buildIssueBody({ category: "structural", cluster, hashMarker: "deadbeef" });
    expect(body).toContain("deadbeef");
  });

  it("includes the cluster signature", () => {
    const body = buildIssueBody({ category: "structural", cluster, hashMarker: "deadbeef" });
    expect(body).toContain("sig-xyz");
  });

  it("includes sample routes", () => {
    const body = buildIssueBody({ category: "structural", cluster, hashMarker: "deadbeef" });
    expect(body).toContain("/a");
    expect(body).toContain("/b");
  });

  it("includes repro steps command", () => {
    const body = buildIssueBody({ category: "structural", cluster, hashMarker: "deadbeef" });
    expect(body).toContain("pnpm migration-check");
  });

  it("includes the route count", () => {
    const body = buildIssueBody({ category: "structural", cluster, hashMarker: "deadbeef" });
    expect(body).toContain("5");
  });
});

// ── Integration: raiseIssues ──────────────────────────────────────────────────

describe("raiseIssues — issue creation", () => {
  it("creates an issue when gh issue list returns no match", async () => {
    const dir = join(tmpdir(), `raise-test-create-${Date.now()}`);
    const findingsDir = await writeFindingsDir(dir, 3);

    const ghCalls: string[][] = [];
    const mockGh = async (args: string[]) => {
      ghCalls.push(args);
      // issue list returns empty array (no existing issues)
      if (args[0] === "issue" && args[1] === "list") return "[]";
      // issue create returns a fake URL
      if (args[0] === "issue" && args[1] === "create") return "https://github.com/zudolab/zudo-doc/issues/999";
      return "";
    };

    const result = await raiseIssues({ findingsDir, _runGh: mockGh });

    expect(result.created).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);

    // Verify gh issue create was called
    const createCall = ghCalls.find((a) => a[0] === "issue" && a[1] === "create");
    expect(createCall).toBeDefined();

    await rm(dir, { recursive: true, force: true }).catch(() => {});
  });

  it("skips creation when gh issue list returns a matching hash", async () => {
    const dir = join(tmpdir(), `raise-test-skip-${Date.now()}`);
    const findingsDir = await writeFindingsDir(dir, 3);

    // Compute the hash that would be used for the "aaaa1111::bbbb2222" signature
    const sig  = "aaaa1111::bbbb2222";
    const hash = hashSignature(sig);

    const ghCalls: string[][] = [];
    const mockGh = async (args: string[]) => {
      ghCalls.push(args);
      // issue list returns an existing issue with the hash marker in its title
      if (args[0] === "issue" && args[1] === "list") {
        return JSON.stringify([{ number: 42, title: `[migration-regression:${hash}] structural: some desc` }]);
      }
      return "";
    };

    const result = await raiseIssues({ findingsDir, _runGh: mockGh });

    expect(result.skipped).toHaveLength(1);
    expect(result.created).toHaveLength(0);

    // Verify gh issue create was NOT called
    const createCall = ghCalls.find((a) => a[0] === "issue" && a[1] === "create");
    expect(createCall).toBeUndefined();

    await rm(dir, { recursive: true, force: true }).catch(() => {});
  });
});

describe("raiseIssues — idempotency", () => {
  it("second run is a no-op when first run created the issue", async () => {
    const dir = join(tmpdir(), `raise-test-idempotent-${Date.now()}`);
    const findingsDir = await writeFindingsDir(dir, 3);

    const sig  = "aaaa1111::bbbb2222";
    const hash = hashSignature(sig);

    // Simulate state: after first run the issue exists
    const createdIssues: Array<{ number: number; title: string }> = [];
    let issueCounter = 100;

    const mockGh = async (args: string[]) => {
      if (args[0] === "issue" && args[1] === "list") {
        // Return any matching issues that were previously created
        const search = args[args.indexOf("--search") + 1] ?? "";
        const matched = createdIssues.filter((i) => i.title.includes(search));
        return JSON.stringify(matched);
      }
      if (args[0] === "issue" && args[1] === "create") {
        const titleIdx = args.indexOf("--title");
        const title    = titleIdx >= 0 ? args[titleIdx + 1] : "untitled";
        issueCounter++;
        createdIssues.push({ number: issueCounter, title });
        return `https://github.com/zudolab/zudo-doc/issues/${issueCounter}`;
      }
      return "";
    };

    // First run — should create
    const run1 = await raiseIssues({ findingsDir, _runGh: mockGh });
    expect(run1.created).toHaveLength(1);
    expect(run1.skipped).toHaveLength(0);

    // Second run — should skip (issue already exists)
    const run2 = await raiseIssues({ findingsDir, _runGh: mockGh });
    expect(run2.created).toHaveLength(0);
    expect(run2.skipped).toHaveLength(1);

    await rm(dir, { recursive: true, force: true }).catch(() => {});
  });
});

describe("raiseIssues — dry-run mode", () => {
  it("dry-run does not call gh issue create", async () => {
    const dir = join(tmpdir(), `raise-test-dryrun-${Date.now()}`);
    const findingsDir = await writeFindingsDir(dir, 3);

    const ghCalls: string[][] = [];
    const mockGh = async (args: string[]) => {
      ghCalls.push(args);
      return "[]";
    };

    const result = await raiseIssues({ findingsDir, dryRun: true, _runGh: mockGh });

    // In dry-run mode we report items as "created" (would-be created) but
    // gh issue create must never be called
    const createCall = ghCalls.find((a) => a[0] === "issue" && a[1] === "create");
    expect(createCall).toBeUndefined();

    // gh label create and issue list should also not be called in dry-run
    const labelCall = ghCalls.find((a) => a[0] === "label");
    expect(labelCall).toBeUndefined();

    await rm(dir, { recursive: true, force: true }).catch(() => {});
  });
});

describe("raiseIssues — empty findings", () => {
  it("returns empty arrays when there are no findings files", async () => {
    const dir = join(tmpdir(), `raise-test-empty-${Date.now()}`);
    await mkdir(join(dir, "findings"), { recursive: true });
    // No batch files written

    const mockGh = vi.fn().mockResolvedValue("[]");

    const result = await raiseIssues({
      findingsDir: join(dir, "findings"),
      _runGh:      mockGh as unknown as (args: string[]) => Promise<string>,
    });

    expect(result.created).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);

    await rm(dir, { recursive: true, force: true }).catch(() => {});
  });

  it("only non-cosmetic clusters are processed (cosmetic-only findings are ignored)", async () => {
    const dir = join(tmpdir(), `raise-test-cosmetic-${Date.now()}`);
    const findingsDir = join(dir, "findings");
    await mkdir(findingsDir, { recursive: true });

    // Write findings that are ALL cosmetic-only
    const batch = {
      batchId: "0000",
      routes: Array.from({ length: 5 }, (_, i) => ({
        route:           `/docs/cos-${i}`,
        category:        "cosmetic-only",
        subCategory:     null,
        signals:         {},
        diffSummaryHash: `cos-hash-${i}`,
      })),
    };
    await writeFile(join(findingsDir, "batch-0000.json"), JSON.stringify(batch, null, 2));

    const ghCalls: string[][] = [];
    const mockGh = async (args: string[]) => { ghCalls.push(args); return "[]"; };

    const result = await raiseIssues({ findingsDir, _runGh: mockGh });

    // Nothing should be created — cosmetic only
    expect(result.created).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);

    // gh issue create should never have been called
    const createCall = ghCalls.find((a) => a[0] === "issue" && a[1] === "create");
    expect(createCall).toBeUndefined();

    await rm(dir, { recursive: true, force: true }).catch(() => {});
  });
});

describe("raiseIssues — issue title includes hash marker", () => {
  it("issue title contains [migration-regression:<hash>] prefix", async () => {
    const dir = join(tmpdir(), `raise-test-title-${Date.now()}`);
    const findingsDir = await writeFindingsDir(dir, 2);

    const createdTitles: string[] = [];
    const mockGh = async (args: string[]) => {
      if (args[0] === "issue" && args[1] === "list") return "[]";
      if (args[0] === "issue" && args[1] === "create") {
        const titleIdx = args.indexOf("--title");
        if (titleIdx >= 0) createdTitles.push(args[titleIdx + 1]);
        return "https://github.com/zudolab/zudo-doc/issues/123";
      }
      return "";
    };

    await raiseIssues({ findingsDir, _runGh: mockGh });

    expect(createdTitles).toHaveLength(1);
    expect(createdTitles[0]).toMatch(/^\[migration-regression:[0-9a-f]{8}\]/);

    await rm(dir, { recursive: true, force: true }).catch(() => {});
  });
});
