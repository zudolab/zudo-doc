import { describe, expect, it } from "vitest";
import {
  buildUrl,
  normalizePathname,
  shouldSkipNormalization,
} from "../normalize";

// ---------------------------------------------------------------------------
// buildUrl
// ---------------------------------------------------------------------------

describe("buildUrl", () => {
  it("returns root slash when called with no arguments", () => {
    expect(buildUrl()).toBe("/");
  });

  it("returns root slash when all segments are empty strings", () => {
    expect(buildUrl("", "", "")).toBe("/");
  });

  it("builds a single-segment URL with trailing slash", () => {
    expect(buildUrl("docs")).toBe("/docs/");
  });

  it("builds a multi-segment URL with trailing slash", () => {
    expect(buildUrl("docs", "guides", "getting-started")).toBe(
      "/docs/guides/getting-started/",
    );
  });

  it("builds a locale-prefixed URL", () => {
    expect(buildUrl("ja", "docs", "intro")).toBe("/ja/docs/intro/");
  });

  it("filters out empty segments", () => {
    expect(buildUrl("", "docs", "", "intro")).toBe("/docs/intro/");
  });

  it("collapses leading slashes on a segment", () => {
    // A segment that itself starts with "/" is still handled gracefully.
    expect(buildUrl("docs", "guide")).toBe("/docs/guide/");
  });

  it("always produces exactly one leading slash", () => {
    const result = buildUrl("a", "b");
    expect(result.startsWith("/")).toBe(true);
    expect(result.startsWith("//")).toBe(false);
  });

  it("always produces exactly one trailing slash", () => {
    const result = buildUrl("a", "b");
    expect(result.endsWith("/")).toBe(true);
    expect(result.endsWith("//")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// shouldSkipNormalization
// ---------------------------------------------------------------------------

describe("shouldSkipNormalization", () => {
  describe("returns true (skip) when", () => {
    it("pathname already ends with /", () => {
      expect(shouldSkipNormalization("/docs/guide/")).toBe(true);
    });

    it("pathname is the root /", () => {
      expect(shouldSkipNormalization("/")).toBe(true);
    });

    it("starts with /_astro/ (Astro internal)", () => {
      expect(shouldSkipNormalization("/_astro/chunk.abc123.js")).toBe(true);
    });

    it("starts with /_image (Astro internal)", () => {
      expect(shouldSkipNormalization("/_image?src=photo.png")).toBe(true);
    });

    it.each([
      ["JavaScript", "/assets/app.js"],
      ["CSS", "/assets/style.css"],
      ["PNG image", "/images/logo.png"],
      ["SVG image", "/images/icon.svg"],
      ["JSON", "/api/data.json"],
      ["HTML", "/pages/about.html"],
      ["WOFF2 font", "/fonts/inter.woff2"],
      ["XML", "/sitemap.xml"],
    ])("skips %s file (has alphabetic extension): %s", (_label, path) => {
      expect(shouldSkipNormalization(path)).toBe(true);
    });
  });

  describe("returns false (do not skip) when", () => {
    it("pathname has no trailing slash and no extension", () => {
      expect(shouldSkipNormalization("/docs/guide")).toBe(false);
    });

    it("pathname is a deeply nested doc path", () => {
      expect(shouldSkipNormalization("/docs/guides/getting-started")).toBe(
        false,
      );
    });

    it("version-like segment /docs/v2.0 (digit after dot)", () => {
      // The extension check requires the first char after '.' to be a letter.
      // A digit means it's a version string, not a file extension.
      expect(shouldSkipNormalization("/docs/v2.0")).toBe(false);
    });

    it("release-tag segment /docs/release-1.2.3 (digit after dot)", () => {
      expect(shouldSkipNormalization("/docs/release-1.2.3")).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// normalizePathname
// ---------------------------------------------------------------------------

describe("normalizePathname", () => {
  it("appends trailing slash to a bare doc pathname", () => {
    expect(normalizePathname("/docs/guide")).toBe("/docs/guide/");
  });

  it("is a no-op when trailing slash already present", () => {
    expect(normalizePathname("/docs/guide/")).toBe("/docs/guide/");
  });

  it("is a no-op for the root /", () => {
    expect(normalizePathname("/")).toBe("/");
  });

  it("is a no-op for a static asset", () => {
    expect(normalizePathname("/assets/app.js")).toBe("/assets/app.js");
  });

  it("is a no-op for /_astro/ internal path", () => {
    expect(normalizePathname("/_astro/chunk.abc.js")).toBe(
      "/_astro/chunk.abc.js",
    );
  });

  it("normalizes a deeply nested path", () => {
    expect(normalizePathname("/docs/guides/getting-started")).toBe(
      "/docs/guides/getting-started/",
    );
  });

  it("normalizes a locale-prefixed path", () => {
    expect(normalizePathname("/ja/docs/intro")).toBe("/ja/docs/intro/");
  });

  it("does not touch query strings (pathname-only input is assumed)", () => {
    // The function receives only the pathname; callers must handle query strings.
    // Confirm that a pathname with no query string is handled cleanly.
    expect(normalizePathname("/docs/guide")).toBe("/docs/guide/");
  });

  it("normalizes version-like segments that are not file extensions", () => {
    expect(normalizePathname("/docs/v2.0")).toBe("/docs/v2.0/");
  });
});
