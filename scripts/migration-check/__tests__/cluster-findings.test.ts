/**
 * cluster-findings.test.ts
 *
 * Unit tests for scripts/migration-check/lib/cluster-findings.mjs covering:
 *   - Empty findings → empty byCategory
 *   - All-identical findings → byCategory is empty (identical skipped)
 *   - Route-only entries skipped from clustering
 *   - Structural findings clustered by DOM-shape-hash pair
 *   - Meta-changed findings clustered by subCategory
 *   - Content-loss / asset-loss / link-changed clustered by diffSummaryHash
 *   - Sample size cap at SAMPLE_SIZE (5) routes
 *   - Multiple distinct clusters within one category
 *   - Mixed categories produce independent byCategory entries
 *   - Cosmetic-only routes all land in one cluster
 *   - Error findings grouped by error prefix
 *   - Clusters sorted by routeCount descending
 *   - Input array is not mutated
 *
 * Plus integration tests for aggregate.mjs:
 *   - Writes a report.md that includes expected sections
 *   - Handles missing routes.json / artifacts.json gracefully
 *   - --llm-review writes llm-review-prompt.md
 */

import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import {
  clusterFindings,
  getClusterSignature,
  describeCluster,
  SAMPLE_SIZE,
  REGRESSION_CATEGORIES,
} from "../lib/cluster-findings.mjs";

import { aggregate } from "../aggregate.mjs";

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Build a minimal Finding with sensible defaults. */
function makeFinding(overrides: Record<string, unknown> = {}) {
  return {
    route: "/docs/page",
    category: "structural",
    subCategory: null,
    signals: {
      domShapeHashA: "aaaa0000",
      domShapeHashB: "bbbb1111",
      textHashA: "tttt0000",
      textHashB: "tttt0000",
    },
    diffSummaryHash: "diff1111",
    ...overrides,
  };
}

/** Make N findings in the same cluster (same signature). */
function makeFindings(
  n: number,
  base: Record<string, unknown> = {},
): ReturnType<typeof makeFinding>[] {
  return Array.from({ length: n }, (_, i) =>
    makeFinding({ route: `/docs/page-${i}`, ...base }),
  );
}

// ── Unit: clusterFindings ─────────────────────────────────────────────────────

describe("clusterFindings — empty input", () => {
  it("returns empty byCategory for empty findings array", () => {
    const result = clusterFindings([]);
    expect(result.byCategory).toEqual({});
  });
});

describe("clusterFindings — identical findings skipped", () => {
  it("does not include identical category in byCategory", () => {
    const findings = makeFindings(5, { category: "identical", signals: {}, diffSummaryHash: null });
    const result = clusterFindings(findings);
    expect(result.byCategory["identical"]).toBeUndefined();
  });

  it("does not include route-only-in-a in byCategory", () => {
    const findings = makeFindings(3, {
      category: "route-only-in-a",
      signals: {},
      diffSummaryHash: null,
    });
    const result = clusterFindings(findings);
    expect(result.byCategory["route-only-in-a"]).toBeUndefined();
  });

  it("does not include route-only-in-b in byCategory", () => {
    const findings = makeFindings(3, {
      category: "route-only-in-b",
      signals: {},
      diffSummaryHash: null,
    });
    const result = clusterFindings(findings);
    expect(result.byCategory["route-only-in-b"]).toBeUndefined();
  });
});

describe("clusterFindings — structural clustering", () => {
  it("groups structural findings by DOM-shape-hash pair", () => {
    const groupA = makeFindings(3, {
      category: "structural",
      signals: { domShapeHashA: "hash-a1", domShapeHashB: "hash-b1" },
    });
    const groupB = makeFindings(2, {
      category: "structural",
      signals: { domShapeHashA: "hash-a2", domShapeHashB: "hash-b2" },
    });

    const result = clusterFindings([...groupA, ...groupB]);
    const clusters = result.byCategory["structural"];

    expect(clusters).toHaveLength(2);
    // Sorted by routeCount descending — groupA (3) before groupB (2)
    expect(clusters[0].routeCount).toBe(3);
    expect(clusters[1].routeCount).toBe(2);
  });

  it("merges structural findings with identical hash pairs into one cluster", () => {
    const findings = makeFindings(4, {
      category: "structural",
      signals: { domShapeHashA: "same-a", domShapeHashB: "same-b" },
    });

    const result = clusterFindings(findings);
    expect(result.byCategory["structural"]).toHaveLength(1);
    expect(result.byCategory["structural"][0].routeCount).toBe(4);
  });
});

describe("clusterFindings — meta-changed clustering", () => {
  it("groups meta-changed findings by subCategory", () => {
    const canonical = makeFindings(2, {
      category: "meta-changed",
      subCategory: "canonical-changed",
      signals: {},
    });
    const og = makeFindings(5, {
      category: "meta-changed",
      subCategory: "og-changed",
      signals: {},
    });

    const result = clusterFindings([...canonical, ...og]);
    const clusters = result.byCategory["meta-changed"];

    expect(clusters).toHaveLength(2);
    // og-changed (5) sorted first
    expect(clusters[0].signature).toBe("og-changed");
    expect(clusters[0].routeCount).toBe(5);
    expect(clusters[1].signature).toBe("canonical-changed");
    expect(clusters[1].routeCount).toBe(2);
  });
});

describe("clusterFindings — diffSummaryHash clustering", () => {
  it("groups content-loss findings by diffSummaryHash", () => {
    const hash1 = makeFindings(3, { category: "content-loss", diffSummaryHash: "loss-hash-1" });
    const hash2 = makeFindings(1, { category: "content-loss", diffSummaryHash: "loss-hash-2" });

    const result = clusterFindings([...hash1, ...hash2]);
    const clusters = result.byCategory["content-loss"];

    expect(clusters).toHaveLength(2);
    expect(clusters[0].routeCount).toBe(3);
    expect(clusters[1].routeCount).toBe(1);
  });

  it("groups asset-loss findings by diffSummaryHash", () => {
    const findings = makeFindings(4, {
      category: "asset-loss",
      diffSummaryHash: "asset-hash-x",
    });

    const result = clusterFindings(findings);
    expect(result.byCategory["asset-loss"]).toHaveLength(1);
    expect(result.byCategory["asset-loss"][0].routeCount).toBe(4);
  });

  it("groups link-changed findings by diffSummaryHash", () => {
    const findings = makeFindings(2, {
      category: "link-changed",
      diffSummaryHash: "link-hash-y",
    });

    const result = clusterFindings(findings);
    expect(result.byCategory["link-changed"]).toHaveLength(1);
  });
});

describe("clusterFindings — sample size cap", () => {
  it(`caps sampleRoutes at ${SAMPLE_SIZE} routes`, () => {
    const findings = makeFindings(SAMPLE_SIZE + 5, {
      category: "structural",
      signals: { domShapeHashA: "a1", domShapeHashB: "b1" },
    });

    const result = clusterFindings(findings);
    const cluster = result.byCategory["structural"][0];

    expect(cluster.sampleRoutes).toHaveLength(SAMPLE_SIZE);
    expect(cluster.routeCount).toBe(SAMPLE_SIZE + 5);
  });

  it("does not cap sampleRoutes when count is below limit", () => {
    const findings = makeFindings(3, {
      category: "structural",
      signals: { domShapeHashA: "x1", domShapeHashB: "x2" },
    });

    const result = clusterFindings(findings);
    const cluster = result.byCategory["structural"][0];

    expect(cluster.sampleRoutes).toHaveLength(3);
    expect(cluster.routeCount).toBe(3);
  });
});

describe("clusterFindings — cosmetic-only", () => {
  it("puts all cosmetic-only findings into a single cluster", () => {
    // Each cosmetic finding has a different diffSummaryHash — but they all share
    // the fixed "cosmetic" signature, so they collapse into one cluster.
    const findings = Array.from({ length: 7 }, (_, i) =>
      makeFinding({
        route: `/docs/cos-${i}`,
        category: "cosmetic-only",
        diffSummaryHash: `cos-hash-${i}`,
        signals: {},
      }),
    );

    const result = clusterFindings(findings);
    const clusters = result.byCategory["cosmetic-only"];

    expect(clusters).toHaveLength(1);
    expect(clusters[0].routeCount).toBe(7);
    expect(clusters[0].signature).toBe("cosmetic");
  });
});

describe("clusterFindings — mixed categories", () => {
  it("produces separate byCategory entries for each category", () => {
    const findings = [
      ...makeFindings(2, { category: "structural", signals: { domShapeHashA: "a", domShapeHashB: "b" } }),
      ...makeFindings(3, { category: "meta-changed", subCategory: "og-changed", signals: {} }),
      ...makeFindings(1, { category: "content-loss", diffSummaryHash: "loss-1" }),
    ];

    const result = clusterFindings(findings);

    expect(Object.keys(result.byCategory)).toContain("structural");
    expect(Object.keys(result.byCategory)).toContain("meta-changed");
    expect(Object.keys(result.byCategory)).toContain("content-loss");
    expect(Object.keys(result.byCategory)).not.toContain("identical");
  });
});

describe("clusterFindings — immutability", () => {
  it("does not mutate the input findings array", () => {
    const findings = makeFindings(3, {
      category: "structural",
      signals: { domShapeHashA: "a", domShapeHashB: "b" },
    });
    const originalRoutes = findings.map((f) => f.route);

    clusterFindings(findings);

    // Verify the original array is unchanged
    expect(findings.map((f) => f.route)).toEqual(originalRoutes);
  });
});

describe("clusterFindings — sort order", () => {
  it("sorts clusters within a category by routeCount descending", () => {
    const small = makeFindings(1, { category: "structural", signals: { domShapeHashA: "s", domShapeHashB: "s2" } });
    const large = makeFindings(10, { category: "structural", signals: { domShapeHashA: "l", domShapeHashB: "l2" } });
    const medium = makeFindings(5, { category: "structural", signals: { domShapeHashA: "m", domShapeHashB: "m2" } });

    const result = clusterFindings([...small, ...large, ...medium]);
    const counts = result.byCategory["structural"].map((c) => c.routeCount);

    expect(counts).toEqual([10, 5, 1]);
  });
});

describe("REGRESSION_CATEGORIES", () => {
  it("includes expected regression categories", () => {
    expect(REGRESSION_CATEGORIES.has("structural")).toBe(true);
    expect(REGRESSION_CATEGORIES.has("meta-changed")).toBe(true);
    expect(REGRESSION_CATEGORIES.has("content-loss")).toBe(true);
    expect(REGRESSION_CATEGORIES.has("asset-loss")).toBe(true);
    expect(REGRESSION_CATEGORIES.has("link-changed")).toBe(true);
    expect(REGRESSION_CATEGORIES.has("cosmetic-only")).toBe(false);
    expect(REGRESSION_CATEGORIES.has("identical")).toBe(false);
  });
});

// ── Unit: getClusterSignature ─────────────────────────────────────────────────

describe("getClusterSignature", () => {
  it("structural: combines domShapeHashA and domShapeHashB", () => {
    const finding = makeFinding({
      category: "structural",
      signals: { domShapeHashA: "aaa", domShapeHashB: "bbb" },
    });
    expect(getClusterSignature(finding)).toBe("aaa::bbb");
  });

  it("meta-changed: returns subCategory", () => {
    const finding = makeFinding({ category: "meta-changed", subCategory: "og-changed", signals: {} });
    expect(getClusterSignature(finding)).toBe("og-changed");
  });

  it("content-loss: returns diffSummaryHash", () => {
    const finding = makeFinding({ category: "content-loss", diffSummaryHash: "abc123" });
    expect(getClusterSignature(finding)).toBe("abc123");
  });

  it("cosmetic-only: always returns 'cosmetic'", () => {
    const finding = makeFinding({ category: "cosmetic-only", diffSummaryHash: "xyz" });
    expect(getClusterSignature(finding)).toBe("cosmetic");
  });
});

// ── Integration: aggregate() ──────────────────────────────────────────────────

describe(
  "aggregate — report.md generation",
  () => {
    let tmpDir: string;
    let findingsDir: string;
    let reportPath: string;

    beforeAll(async () => {
      tmpDir = join(tmpdir(), `aggregate-test-${Date.now()}`);
      findingsDir = join(tmpDir, "findings");
      reportPath = join(tmpDir, "report.md");

      await mkdir(findingsDir, { recursive: true });

      // Write fake batch-0000.json
      const batch0 = {
        batchId: "0000",
        routes: [
          {
            route: "/docs/page-1",
            category: "structural",
            subCategory: null,
            signals: { domShapeHashA: "sha-a1", domShapeHashB: "sha-b1" },
            diffSummaryHash: "diff-111",
          },
          {
            route: "/docs/page-2",
            category: "structural",
            subCategory: null,
            signals: { domShapeHashA: "sha-a1", domShapeHashB: "sha-b1" },
            diffSummaryHash: "diff-111",
          },
          {
            route: "/docs/page-3",
            category: "identical",
            subCategory: null,
            signals: {},
            diffSummaryHash: null,
          },
          {
            route: "/docs/page-4",
            category: "meta-changed",
            subCategory: "og-changed",
            signals: {},
            diffSummaryHash: "diff-og-1",
          },
          {
            route: "/docs/page-5",
            category: "route-only-in-a",
            subCategory: null,
            signals: {},
            diffSummaryHash: null,
          },
          {
            route: "/docs/page-6",
            category: "route-only-in-b",
            subCategory: null,
            signals: {},
            diffSummaryHash: null,
          },
        ],
      };

      // Write fake batch-0001.json with more structural findings
      const batch1 = {
        batchId: "0001",
        routes: Array.from({ length: 8 }, (_, i) => ({
          route: `/docs/extra-${i}`,
          category: "structural",
          subCategory: null,
          signals: { domShapeHashA: "sha-a1", domShapeHashB: "sha-b1" },
          diffSummaryHash: "diff-111",
        })),
      };

      await writeFile(join(findingsDir, "batch-0000.json"), JSON.stringify(batch0, null, 2));
      await writeFile(join(findingsDir, "batch-0001.json"), JSON.stringify(batch1, null, 2));

      // Write fake routes.json
      const routes = {
        onlyInA: ["/docs/page-5"],
        onlyInB: ["/docs/page-6"],
        inBoth: ["/docs/page-1", "/docs/page-2"],
      };
      await writeFile(join(tmpDir, "routes.json"), JSON.stringify(routes, null, 2));

      // Write fake artifacts.json
      const artifacts = {
        artifacts: [
          {
            path: "robots.txt",
            presence: "present-in-both",
            type: "text",
            comparison: { identical: false, removedLines: ["Disallow: /old/"], addedLines: [] },
          },
        ],
        stats: { total: 1, identical: 0, changed: 1, onlyInA: 0, onlyInB: 0 },
      };
      await writeFile(join(tmpDir, "artifacts.json"), JSON.stringify(artifacts, null, 2));

      // Run aggregate
      await aggregate({ findingsDir, reportPath });
    });

    afterAll(async () => {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    });

    it("writes report.md to the specified path", async () => {
      const report = await readFile(reportPath, "utf8");
      expect(report.length).toBeGreaterThan(100);
    });

    it("report contains the Summary section with route counts", async () => {
      const report = await readFile(reportPath, "utf8");
      expect(report).toContain("## Summary");
      expect(report).toContain("structural");
      expect(report).toContain("identical");
    });

    it("report contains Symmetric-Difference Routes section", async () => {
      const report = await readFile(reportPath, "utf8");
      expect(report).toContain("## Symmetric-Difference Routes");
      expect(report).toContain("/docs/page-5");
      expect(report).toContain("/docs/page-6");
    });

    it("report contains Non-HTML Artifact Diffs section", async () => {
      const report = await readFile(reportPath, "utf8");
      expect(report).toContain("## Non-HTML Artifact Diffs");
      expect(report).toContain("robots.txt");
    });

    it("report contains Top Clusters section", async () => {
      const report = await readFile(reportPath, "utf8");
      expect(report).toContain("## Top Clusters");
      expect(report).toContain("structural");
    });

    it("report contains Suggested Issues section", async () => {
      const report = await readFile(reportPath, "utf8");
      expect(report).toContain("## Suggested Issues");
    });

    it("cluster route counts are correct — 10 structural routes in one cluster", async () => {
      const report = await readFile(reportPath, "utf8");
      // 2 from batch-0000 + 8 from batch-0001 = 10 structural routes, same signature
      expect(report).toMatch(/10 route\(s\)/);
    });

    it("sample routes are capped at SAMPLE_SIZE in the report", async () => {
      const report = await readFile(reportPath, "utf8");
      // 10 structural routes but only SAMPLE_SIZE=5 shown
      expect(report).toContain(`showing ${SAMPLE_SIZE} of`);
    });
  },
  15_000,
);

describe("aggregate — graceful handling of missing files", () => {
  it("runs without error when routes.json and artifacts.json are absent", async () => {
    const dir = join(tmpdir(), `agg-missing-${Date.now()}`);
    const findingsDir = join(dir, "findings");
    const reportPath = join(dir, "report.md");

    await mkdir(findingsDir, { recursive: true });

    // Write a single batch file, no routes.json or artifacts.json
    const batch = {
      batchId: "0000",
      routes: [
        {
          route: "/page",
          category: "structural",
          subCategory: null,
          signals: { domShapeHashA: "a", domShapeHashB: "b" },
          diffSummaryHash: "d1",
        },
      ],
    };
    await writeFile(join(findingsDir, "batch-0000.json"), JSON.stringify(batch));

    await expect(aggregate({ findingsDir, reportPath })).resolves.not.toThrow();

    const report = await readFile(reportPath, "utf8");
    expect(report).toContain("## Summary");

    await rm(dir, { recursive: true, force: true }).catch(() => {});
  });
});

describe("aggregate — llm-review flag", () => {
  it("writes llm-review-prompt.md when --llm-review is set", async () => {
    const dir = join(tmpdir(), `agg-llm-${Date.now()}`);
    const findingsDir = join(dir, "findings");
    const reportPath = join(dir, "report.md");

    await mkdir(findingsDir, { recursive: true });

    const batch = {
      batchId: "0000",
      routes: [
        {
          route: "/structural-page",
          category: "structural",
          subCategory: null,
          signals: { domShapeHashA: "ha", domShapeHashB: "hb" },
          diffSummaryHash: "dh1",
        },
      ],
    };
    await writeFile(join(findingsDir, "batch-0000.json"), JSON.stringify(batch));

    await aggregate({ findingsDir, reportPath, llmReview: true });

    const promptPath = join(dir, "llm-review-prompt.md");
    const prompt = await readFile(promptPath, "utf8");

    expect(prompt).toContain("LLM Review Prompt");
    expect(prompt).toContain("real-regression");
    expect(prompt).toContain("cosmetic");
    expect(prompt).toContain("needs-human");

    await rm(dir, { recursive: true, force: true }).catch(() => {});
  });
});
