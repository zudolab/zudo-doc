/**
 * discover-routes.test.ts
 *
 * Unit tests for discover-routes.mjs covering:
 *   (a) Sitemap XML parsing (urlset and sitemapindex fixtures)
 *   (b) Filesystem walk fallback (directory with HTML files, skipping _artifacts/)
 *   (c) Route normalization (sitePrefix strip, trailing-slash removal, query/fragment strip)
 *   (d) Sitemap order change detection
 *   (e) Full getRoutesFromSnapshot integration (sitemap-index, sitemap, filesystem sources)
 */

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseSitemapXml,
  normalizeRoute,
  htmlFileToRoute,
  checkSitemapOrderChanged,
  walkHtmlFiles,
  getRoutesFromSnapshot,
} from "../discover-routes.mjs";

const FIXTURES = join(import.meta.dirname, "fixtures");

// ── (a) Sitemap XML parsing ───────────────────────────────────────────────────

describe("parseSitemapXml", () => {
  it("extracts <loc> values from a urlset sitemap", async () => {
    const { readFileSync } = await import("node:fs");
    const content = readFileSync(join(FIXTURES, "s4-sitemap", "sitemap.xml"), "utf8");
    const urls = parseSitemapXml(content);
    expect(urls).toHaveLength(3);
    expect(urls).toContain("https://example.com/pj/zudo-doc/");
    expect(urls).toContain("https://example.com/pj/zudo-doc/docs/intro/");
    expect(urls).toContain("https://example.com/pj/zudo-doc/docs/guide/");
  });

  it("extracts <loc> values from a sitemapindex file", async () => {
    const { readFileSync } = await import("node:fs");
    const content = readFileSync(
      join(FIXTURES, "s4-sitemap-index", "sitemap-index.xml"),
      "utf8",
    );
    const locs = parseSitemapXml(content);
    expect(locs).toHaveLength(1);
    expect(locs[0]).toContain("sitemap-0.xml");
  });

  it("returns an empty array for content with no <loc> tags", () => {
    const urls = parseSitemapXml("<urlset></urlset>");
    expect(urls).toEqual([]);
  });

  it("handles inline whitespace around loc content", () => {
    const xml = "<urlset><url><loc>  https://example.com/foo/  </loc></url></urlset>";
    const urls = parseSitemapXml(xml);
    expect(urls).toEqual(["https://example.com/foo/"]);
  });
});

// ── (c) Route normalization ───────────────────────────────────────────────────

describe("normalizeRoute", () => {
  const prefix = "/pj/zudo-doc/";

  it("strips protocol and host from absolute URLs", () => {
    expect(normalizeRoute("https://example.com/docs/foo/", "")).toBe("/docs/foo");
  });

  it("strips sitePrefix from absolute URLs", () => {
    expect(normalizeRoute("https://example.com/pj/zudo-doc/docs/intro/", prefix)).toBe(
      "/docs/intro",
    );
  });

  it("strips sitePrefix from path-only strings", () => {
    expect(normalizeRoute("/pj/zudo-doc/docs/guide/", prefix)).toBe("/docs/guide");
  });

  it("normalizes root URL to '/'", () => {
    expect(normalizeRoute("https://example.com/pj/zudo-doc/", prefix)).toBe("/");
  });

  it("strips query strings", () => {
    expect(normalizeRoute("/docs/foo/?page=2", "")).toBe("/docs/foo");
  });

  it("strips URL fragments", () => {
    expect(normalizeRoute("/docs/foo/#section", "")).toBe("/docs/foo");
  });

  it("strips both query and fragment", () => {
    expect(normalizeRoute("/docs/foo/?q=1#anchor", "")).toBe("/docs/foo");
  });

  it("removes trailing slash (except root)", () => {
    expect(normalizeRoute("/docs/foo/", "")).toBe("/docs/foo");
    expect(normalizeRoute("/", "")).toBe("/");
  });

  it("does not alter paths that do not start with sitePrefix", () => {
    expect(normalizeRoute("/other/path/", prefix)).toBe("/other/path");
  });

  it("is a no-op on already-normalized paths with empty prefix", () => {
    expect(normalizeRoute("/docs/intro", "")).toBe("/docs/intro");
  });
});

// ── htmlFileToRoute ───────────────────────────────────────────────────────────

describe("htmlFileToRoute", () => {
  it("maps index.html to /", () => {
    expect(htmlFileToRoute("index.html")).toBe("/");
  });

  it("maps nested index.html to its parent dir", () => {
    expect(htmlFileToRoute("docs/intro/index.html")).toBe("/docs/intro");
  });

  it("maps a flat .html file (no trailing slash)", () => {
    expect(htmlFileToRoute("docs/guide.html")).toBe("/docs/guide");
  });

  it("handles Windows backslash separators", () => {
    expect(htmlFileToRoute("docs\\intro\\index.html")).toBe("/docs/intro");
  });

  it("adds leading slash when missing", () => {
    expect(htmlFileToRoute("about.html")).toBe("/about");
  });
});

// ── (b) Filesystem walk fallback ──────────────────────────────────────────────

describe("walkHtmlFiles", () => {
  const walkFixtureDir = join(FIXTURES, "s4-html-walk");

  it("finds all .html files in snapshot dir", async () => {
    const files = await walkHtmlFiles(walkFixtureDir);
    expect(files).toContain("index.html");
    expect(files).toContain("docs/intro/index.html");
    expect(files).toContain("docs/guide.html");
  });

  it("skips the _artifacts/ subdirectory", async () => {
    const files = await walkHtmlFiles(walkFixtureDir);
    const hasArtifact = files.some((f) => f.startsWith("_artifacts"));
    expect(hasArtifact).toBe(false);
  });

  it("returns an empty array when directory does not exist", async () => {
    const files = await walkHtmlFiles(join(walkFixtureDir, "nonexistent"));
    expect(files).toEqual([]);
  });

  it("produces correct routes via htmlFileToRoute", async () => {
    const files = await walkHtmlFiles(walkFixtureDir);
    const routes = [...new Set(files.map(htmlFileToRoute))].sort();
    expect(routes).toContain("/");
    expect(routes).toContain("/docs/intro");
    expect(routes).toContain("/docs/guide");
    expect(routes).not.toContain("/_artifacts/robots");
  });
});

// ── (d) Sitemap order change detection ────────────────────────────────────────

describe("checkSitemapOrderChanged", () => {
  const routes = ["/", "/docs/api", "/docs/guide", "/docs/intro"];
  const inBothSet = new Set(routes);

  it("returns false when both ordered lists are null (filesystem fallback)", () => {
    expect(checkSitemapOrderChanged(null, null, inBothSet)).toBe(false);
  });

  it("returns false when one side is null", () => {
    expect(checkSitemapOrderChanged(routes, null, inBothSet)).toBe(false);
    expect(checkSitemapOrderChanged(null, routes, inBothSet)).toBe(false);
  });

  it("returns false when route order is the same", () => {
    expect(checkSitemapOrderChanged(routes, [...routes], inBothSet)).toBe(false);
  });

  it("returns true when route order differs", () => {
    const shuffled = ["/docs/guide", "/", "/docs/intro", "/docs/api"];
    expect(checkSitemapOrderChanged(routes, shuffled, inBothSet)).toBe(true);
  });

  it("ignores routes not in inBothSet when checking order", () => {
    // A has an extra route not in B — should not affect order result for shared routes
    const orderedA = ["/", "/docs/intro", "/only-in-a", "/docs/guide"];
    const orderedB = ["/", "/docs/intro", "/docs/guide"];
    const shared = new Set(["/", "/docs/intro", "/docs/guide"]);
    // Shared routes in A: ["/", "/docs/intro", "/docs/guide"] — same as B
    expect(checkSitemapOrderChanged(orderedA, orderedB, shared)).toBe(false);
  });
});

// ── getRoutesFromSnapshot integration ────────────────────────────────────────

describe("getRoutesFromSnapshot – sitemap.xml source", () => {
  it("reads routes from sitemap.xml when present", async () => {
    const result = await getRoutesFromSnapshot(
      join(FIXTURES, "s4-sitemap"),
      "/pj/zudo-doc/",
    );
    expect(result.source).toBe("sitemap");
    expect(result.routes).toContain("/");
    expect(result.routes).toContain("/docs/intro");
    expect(result.routes).toContain("/docs/guide");
    expect(result.orderedRoutes).not.toBeNull();
  });
});

describe("getRoutesFromSnapshot – sitemap-index.xml source", () => {
  it("reads routes from sitemap-index.xml (Astro default) when present", async () => {
    const result = await getRoutesFromSnapshot(
      join(FIXTURES, "s4-sitemap-index"),
      "/pj/zudo-doc/",
    );
    expect(result.source).toBe("sitemap-index");
    expect(result.routes).toContain("/");
    expect(result.routes).toContain("/docs/api");
    expect(result.routes).toContain("/docs/guide");
    expect(result.routes.length).toBeGreaterThan(0);
    expect(result.orderedRoutes).not.toBeNull();
  });
});

describe("getRoutesFromSnapshot – filesystem fallback", () => {
  it("falls back to HTML walk when no sitemap is present", async () => {
    const result = await getRoutesFromSnapshot(join(FIXTURES, "s4-html-walk"), "");
    expect(result.source).toBe("filesystem");
    expect(result.routes).toContain("/");
    expect(result.routes).toContain("/docs/intro");
    expect(result.routes).toContain("/docs/guide");
    expect(result.orderedRoutes).toBeNull();
  });

  it("does not include _artifacts in filesystem routes", async () => {
    const result = await getRoutesFromSnapshot(join(FIXTURES, "s4-html-walk"), "");
    const hasArtifact = result.routes.some((r) => r.startsWith("/_artifacts"));
    expect(hasArtifact).toBe(false);
  });
});
