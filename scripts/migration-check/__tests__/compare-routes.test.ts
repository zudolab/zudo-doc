/**
 * compare-routes.test.ts
 *
 * Tests for compare-routes.mjs covering:
 *  1. categorizeSignals() — pure function, no I/O
 *  2. CLI integration — spawn compare-routes.mjs against live S3 servers,
 *     verify the findings JSON output.
 *
 * Integration test ports: 4500/4501 — chosen to avoid collision with the
 * default harness ports (4400/4401) and serve-snapshots tests (14400+).
 */

import { readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { categorizeSignals } from "../compare-routes.mjs";
import { extractSignals } from "../lib/extract-signals.mjs";
import { normalizeHtml } from "../lib/normalize-html.mjs";
import { startServer } from "../serve-snapshots.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES = join(__dirname, "fixtures");
const COMPARE_ROUTES_SCRIPT = resolve(__dirname, "../compare-routes.mjs");

// ── Helpers ───────────────────────────────────────────────────────────────────

function signals(html: string, sitePrefix = "") {
  return extractSignals(normalizeHtml(html, { sitePrefix }));
}

function makeSignals(overrides: Record<string, unknown> = {}) {
  const base = signals(
    `<html><head><title>T</title><link rel="canonical" href="/page"></head>
     <body><main><h1>Title</h1><p>Content goes here for the test page.</p></main></body></html>`,
  );
  return { ...base, ...overrides };
}

// ── Unit tests: categorizeSignals ─────────────────────────────────────────────

describe("categorizeSignals – identical", () => {
  it("returns identical when all signals match", () => {
    const sigA = signals(`<html><body><h1>Title</h1><p>Content</p></body></html>`);
    const sigB = signals(`<html><body><h1>Title</h1><p>Content</p></body></html>`);
    expect(categorizeSignals(sigA, sigB)).toEqual({
      category: "identical",
      subCategory: null,
    });
  });

  it("returns identical even when raw HTML had different whitespace (normalization handles it)", () => {
    const sigA = signals(`<html><body><h1>Title</h1><p>Text</p></body></html>`);
    // Extra whitespace — normalizeHtml collapses it → signals are identical
    const sigB = signals(
      `<html>  <body>  <h1>Title</h1>  <p>Text</p>  </body>  </html>`,
    );
    expect(categorizeSignals(sigA, sigB).category).toBe("identical");
  });
});

describe("categorizeSignals – structural", () => {
  it("returns structural when h3 headings are promoted to h2 (heading text still present)", () => {
    // A has <h3>, B promotes to <h2> — shape changes but heading TEXT is still there.
    // Heading removal is detected by text only (not level), so level-only changes
    // are structural rather than content-loss.
    const sigA = signals(`<html><body><main>
      <h1>Reference</h1>
      <h2>API Overview</h2><p>API documentation.</p>
      <h3>Methods</h3><p>List of methods.</p>
      <h3>Properties</h3><p>List of properties.</p>
      <h2>Examples</h2><p>Example code.</p>
    </main></body></html>`);
    const sigB = signals(`<html><body><main>
      <h1>Reference</h1>
      <h2>API Overview</h2><p>API documentation.</p>
      <h2>Methods</h2><p>List of methods.</p>
      <h2>Properties</h2><p>List of properties.</p>
      <h2>Examples</h2><p>Example code.</p>
    </main></body></html>`);
    expect(sigA.domShapeHash).not.toBe(sigB.domShapeHash);
    // Heading text "Methods" and "Properties" still present in B (as h2), not removed
    expect(categorizeSignals(sigA, sigB)).toEqual({
      category: "structural",
      subCategory: null,
    });
  });

  it("returns structural when only tag wrapping changed (pure shape diff, same text)", () => {
    // Wrap content in extra div — changes domShapeHash but not content
    const sigA = signals(
      `<html><body><main><h1>Title</h1><p>Content</p></main></body></html>`,
    );
    const sigB = signals(
      `<html><body><main><div><h1>Title</h1><p>Content</p></div></main></body></html>`,
    );
    expect(sigA.domShapeHash).not.toBe(sigB.domShapeHash);
    expect(categorizeSignals(sigA, sigB)).toEqual({
      category: "structural",
      subCategory: null,
    });
  });
});

describe("categorizeSignals – content-loss", () => {
  it("returns content-loss when visible text shrinks by more than 5%", () => {
    // B has significantly less text than A
    const longText = "a".repeat(1000);
    const shortText = "a".repeat(10); // well below 95% of 1000
    const sigA = makeSignals({ visibleText: longText });
    const sigB = makeSignals({ visibleText: shortText, textHash: "different" });
    expect(categorizeSignals(sigA, sigB)).toEqual({
      category: "content-loss",
      subCategory: null,
    });
  });

  it("returns content-loss when a heading is removed", () => {
    const sigA = signals(`<html><body><main>
      <h1>Title</h1>
      <h2>Section A</h2><p>Text</p>
      <h2>Section B</h2><p>Text</p>
    </main></body></html>`);
    const sigB = signals(`<html><body><main>
      <h1>Title</h1>
      <h2>Section A</h2><p>Text</p>
    </main></body></html>`);
    expect(categorizeSignals(sigA, sigB)).toEqual({
      category: "content-loss",
      subCategory: null,
    });
  });

  it("returns content-loss when a landmark role is removed", () => {
    const sigA = signals(
      `<html><body><nav aria-label="Primary">Nav</nav><main>Content</main></body></html>`,
    );
    const sigB = signals(
      `<html><body><main>Content</main></body></html>`,
    );
    expect(categorizeSignals(sigA, sigB)).toEqual({
      category: "content-loss",
      subCategory: null,
    });
  });
});

describe("categorizeSignals – asset-loss", () => {
  it("returns asset-loss when assetRefs are removed", () => {
    const sigA = signals(`<html><head>
      <link rel="stylesheet" href="/main.css">
      <link rel="preload" href="/hero.webp" as="image">
    </head><body><p>Page</p></body></html>`);
    const sigB = signals(`<html><head>
      <link rel="stylesheet" href="/main.css">
    </head><body><p>Page</p></body></html>`);
    expect(categorizeSignals(sigA, sigB)).toEqual({
      category: "asset-loss",
      subCategory: null,
    });
  });

  it("returns asset-loss when scriptInventory entries are removed", () => {
    const sigA = signals(`<html><head>
      <script src="/app.js" type="module"></script>
      <script src="/analytics.js" defer></script>
    </head><body></body></html>`);
    const sigB = signals(`<html><head>
      <script src="/app.js" type="module"></script>
    </head><body></body></html>`);
    expect(categorizeSignals(sigA, sigB)).toEqual({
      category: "asset-loss",
      subCategory: null,
    });
  });

  it("does NOT return asset-loss when assets are only added (not removed)", () => {
    const sigA = signals(
      `<html><head><link rel="stylesheet" href="/main.css"></head><body></body></html>`,
    );
    const sigB = signals(`<html><head>
      <link rel="stylesheet" href="/main.css">
      <link rel="stylesheet" href="/extra.css">
    </head><body></body></html>`);
    // Assets only added in B — not a loss
    expect(categorizeSignals(sigA, sigB).category).not.toBe("asset-loss");
  });
});

describe("categorizeSignals – meta-changed", () => {
  it("returns meta-changed/canonical-changed when canonicalUrl differs", () => {
    const sigA = makeSignals({ canonicalUrl: "/docs/old/" });
    const sigB = makeSignals({ canonicalUrl: "/docs/new/" });
    expect(categorizeSignals(sigA, sigB)).toEqual({
      category: "meta-changed",
      subCategory: "canonical-changed",
    });
  });

  it("returns meta-changed/og-changed when og:title changes", () => {
    const sigA = signals(`<html><head>
      <meta property="og:title" content="Title A">
      <link rel="canonical" href="/page">
    </head><body><main><p>Same content</p></main></body></html>`);
    const sigB = signals(`<html><head>
      <meta property="og:title" content="Title B">
      <link rel="canonical" href="/page">
    </head><body><main><p>Same content</p></main></body></html>`);
    expect(categorizeSignals(sigA, sigB)).toEqual({
      category: "meta-changed",
      subCategory: "og-changed",
    });
  });

  it("returns meta-changed/twitter-changed when twitter:card changes", () => {
    const sigA = signals(`<html><head>
      <meta name="twitter:card" content="summary">
      <link rel="canonical" href="/page">
    </head><body><main><p>Same</p></main></body></html>`);
    const sigB = signals(`<html><head>
      <meta name="twitter:card" content="summary_large_image">
      <link rel="canonical" href="/page">
    </head><body><main><p>Same</p></main></body></html>`);
    expect(categorizeSignals(sigA, sigB)).toEqual({
      category: "meta-changed",
      subCategory: "twitter-changed",
    });
  });

  it("returns meta-changed/seo-meta-changed when description changes", () => {
    const sigA = signals(`<html><head>
      <meta name="description" content="Old description">
      <link rel="canonical" href="/page">
    </head><body><main><p>Same content</p></main></body></html>`);
    const sigB = signals(`<html><head>
      <meta name="description" content="New description">
      <link rel="canonical" href="/page">
    </head><body><main><p>Same content</p></main></body></html>`);
    expect(categorizeSignals(sigA, sigB)).toEqual({
      category: "meta-changed",
      subCategory: "seo-meta-changed",
    });
  });

  it("returns meta-changed/jsonld-changed when JSON-LD changes", () => {
    const sigA = signals(`<html><head>
      <script type="application/ld+json">{"@type":"WebPage","name":"A"}</script>
    </head><body><main><p>Same</p></main></body></html>`);
    const sigB = signals(`<html><head>
      <script type="application/ld+json">{"@type":"WebPage","name":"B"}</script>
    </head><body><main><p>Same</p></main></body></html>`);
    expect(categorizeSignals(sigA, sigB)).toEqual({
      category: "meta-changed",
      subCategory: "jsonld-changed",
    });
  });

  it("canonical-changed takes precedence over og-changed", () => {
    const sigA = signals(`<html><head>
      <meta property="og:title" content="Title A">
      <link rel="canonical" href="/old">
    </head><body><main><p>Same</p></main></body></html>`);
    const sigB = signals(`<html><head>
      <meta property="og:title" content="Title B">
      <link rel="canonical" href="/new">
    </head><body><main><p>Same</p></main></body></html>`);
    // Both changed; canonical-changed wins
    expect(categorizeSignals(sigA, sigB)).toEqual({
      category: "meta-changed",
      subCategory: "canonical-changed",
    });
  });
});

describe("categorizeSignals – link-changed", () => {
  it("returns link-changed when linkTargets differ", () => {
    const sigA = signals(`<html><body><main>
      <a href="/docs/old/">Old link</a>
    </main></body></html>`);
    const sigB = signals(`<html><body><main>
      <a href="/docs/new/">New link</a>
    </main></body></html>`);
    expect(categorizeSignals(sigA, sigB)).toEqual({
      category: "link-changed",
      subCategory: null,
    });
  });
});

describe("categorizeSignals – cosmetic-only", () => {
  it("returns cosmetic-only as catch-all when minor non-content signals differ", () => {
    // A and B have the same DOM shape and same content but slightly different
    // ordering of a field that doesn't fit any other category — this exercises
    // the cosmetic-only fallback path.
    const base = makeSignals();
    // Fabricate a case: same domShapeHash, same textHash, same headings, same meta,
    // same canonical, same jsonLd, same assets, same links — but rssLinks differ.
    const sigA = { ...base, rssLinks: ["/feed.xml"] };
    const sigB = { ...base, rssLinks: ["/feed-v2.xml"] };
    // rssLinks differ but no other category fires → cosmetic-only
    expect(categorizeSignals(sigA, sigB).category).toBe("cosmetic-only");
  });
});

// ── Integration test: CLI against live S3 servers ──────────────────────────────

const PORT_A = 4500;
const PORT_B = 4501;

describe(
  "compare-routes CLI integration",
  () => {
    let serverA: Awaited<ReturnType<typeof startServer>>;
    let serverB: Awaited<ReturnType<typeof startServer>>;
    let outDir: string;
    let routesFile: string;

    beforeAll(async () => {
      const siteADir = join(FIXTURES, "compare-routes", "site-a");
      const siteBDir = join(FIXTURES, "compare-routes", "site-b");

      [serverA, serverB] = await Promise.all([
        startServer({ snapshotDir: siteADir, port: PORT_A, sitePrefix: "" }),
        startServer({ snapshotDir: siteBDir, port: PORT_B, sitePrefix: "" }),
      ]);

      // Build routes JSON (mimics S4 output)
      // identical, structural, meta-changed routes in both sides
      // content-loss route also in both
      const routesJson = {
        inBoth: ["/identical", "/structural", "/meta-changed", "/content-loss"],
        onlyInA: ["/only-a-route"],
        onlyInB: ["/only-b-route"],
      };

      outDir = join(tmpdir(), `compare-routes-test-${Date.now()}`);
      await mkdir(outDir, { recursive: true });

      routesFile = join(outDir, "routes.json");
      await writeFile(routesFile, JSON.stringify(routesJson));
    });

    afterAll(async () => {
      await Promise.allSettled([serverA?.close(), serverB?.close()]);
      await rm(outDir, { recursive: true, force: true }).catch(() => {});
    });

    it(
      "produces categorized findings JSON with correct categories",
      async () => {
        // Spawn compare-routes.mjs
        const exitCode = await new Promise<number>((resolve, reject) => {
          const child = spawn(
            "node",
            [
              COMPARE_ROUTES_SCRIPT,
              `--routes-file=${routesFile}`,
              `--base-a=http://127.0.0.1:${PORT_A}`,
              `--base-b=http://127.0.0.1:${PORT_B}`,
              "--batch-id=test-batch-01",
              `--out-dir=${outDir}`,
              "--site-prefix=",
            ],
            { stdio: ["ignore", "pipe", "pipe"] },
          );

          child.stdout?.on("data", (d: Buffer) => {
            process.stdout.write("[CLI] " + d.toString());
          });
          child.stderr?.on("data", (d: Buffer) => {
            process.stderr.write("[CLI] " + d.toString());
          });

          child.on("exit", (code) => resolve(code ?? -1));
          child.on("error", reject);
        });

        expect(exitCode).toBe(0);

        // Read summary JSON
        const summaryRaw = await readFile(
          join(outDir, "batch-test-batch-01.json"),
          "utf8",
        );
        const summary = JSON.parse(summaryRaw);

        expect(summary.batchId).toBe("test-batch-01");
        expect(summary.routes).toBeInstanceOf(Array);

        const byRoute = Object.fromEntries(
          summary.routes.map((r: { route: string }) => [r.route, r]),
        );

        // Acceptance criteria: identical, structural, meta-changed categorized correctly
        expect(byRoute["/identical"]?.category).toBe("identical");
        expect(byRoute["/structural"]?.category).toBe("structural");
        expect(byRoute["/meta-changed"]?.category).toBe("meta-changed");

        // content-loss route: B has significantly less content than A
        expect(byRoute["/content-loss"]?.category).toBe("content-loss");

        // route-only entries
        expect(byRoute["/only-a-route"]?.category).toBe("route-only-in-a");
        expect(byRoute["/only-b-route"]?.category).toBe("route-only-in-b");

        // Summary signals: hashes only for non-trivial routes
        const structural = byRoute["/structural"];
        expect(structural?.signals?.domShapeHashA).toBeTruthy();
        expect(structural?.signals?.domShapeHashB).toBeTruthy();
        expect(structural?.diffSummaryHash).toBeTruthy();

        // Identical routes have empty signals (no diff needed)
        expect(byRoute["/identical"]?.signals).toEqual({});
      },
      15_000,
    );

    it("detailed JSON is populated for non-identical routes", async () => {
      const detailedRaw = await readFile(
        join(outDir, "batch-test-batch-01-detailed.json"),
        "utf8",
      );
      const detailed = JSON.parse(detailedRaw);
      expect(detailed.routes).toBeInstanceOf(Array);

      // No identical routes in detailed JSON
      const identicalInDetailed = detailed.routes.filter(
        (r: { category: string }) => r.category === "identical",
      );
      expect(identicalInDetailed).toHaveLength(0);

      // Non-identical routes present
      const detailedRoutes = detailed.routes.map((r: { route: string }) => r.route);
      expect(detailedRoutes).toContain("/structural");
      expect(detailedRoutes).toContain("/meta-changed");
      expect(detailedRoutes).toContain("/content-loss");

      // Diff info present in each entry
      for (const entry of detailed.routes) {
        expect(entry.diff).toBeDefined();
        expect(entry.diff.domShapeHash).toBeDefined();
      }
    });

    it("records error category for missing pages (non-2xx)", async () => {
      // Create a routes file with a route that doesn't exist on either server
      const errorRoutesFile = join(outDir, "routes-error.json");
      await writeFile(
        errorRoutesFile,
        JSON.stringify({ inBoth: ["/nonexistent-page-404"], onlyInA: [], onlyInB: [] }),
      );

      const errorOutDir = join(outDir, "error-batch");
      await mkdir(errorOutDir, { recursive: true });

      const exitCode = await new Promise<number>((resolve, reject) => {
        const child = spawn(
          "node",
          [
            COMPARE_ROUTES_SCRIPT,
            `--routes-file=${errorRoutesFile}`,
            `--base-a=http://127.0.0.1:${PORT_A}`,
            `--base-b=http://127.0.0.1:${PORT_B}`,
            "--batch-id=error-test",
            `--out-dir=${errorOutDir}`,
            "--site-prefix=",
          ],
          { stdio: ["ignore", "pipe", "pipe"] },
        );
        child.on("exit", (code) => resolve(code ?? -1));
        child.on("error", reject);
      });

      // CLI must exit 0 even when routes have fetch errors
      expect(exitCode).toBe(0);

      const summaryRaw = await readFile(
        join(errorOutDir, "batch-error-test.json"),
        "utf8",
      );
      const summary = JSON.parse(summaryRaw);
      const route = summary.routes[0];

      expect(route.category).toBe("error");
    });
  },
  30_000,
);
