import { describe, it, expect } from "vitest";
import { renderRobots } from "../robots.js";

describe("renderRobots", () => {
  it("noindex: disallows all crawlers with no Sitemap line", () => {
    const out = renderRobots({ noindex: true });
    expect(out).toBe("User-agent: *\nDisallow: /\n");
  });

  it("noindex wins even when siteUrl + sitemap are set", () => {
    const out = renderRobots({
      noindex: true,
      siteUrl: "https://example.com",
      sitemap: true,
    });
    expect(out).toBe("User-agent: *\nDisallow: /\n");
    expect(out).not.toContain("Sitemap:");
  });

  it("allow branch with no siteUrl omits the Sitemap line", () => {
    const out = renderRobots({ noindex: false });
    expect(out).toBe("User-agent: *\nAllow: /\n");
  });

  it("allow branch with siteUrl but sitemap disabled omits the Sitemap line", () => {
    const out = renderRobots({
      noindex: false,
      siteUrl: "https://example.com",
      sitemap: false,
    });
    expect(out).toBe("User-agent: *\nAllow: /\n");
  });

  it("allow branch with siteUrl + sitemap appends the Sitemap line", () => {
    const out = renderRobots({
      noindex: false,
      siteUrl: "https://example.com",
      sitemap: true,
    });
    expect(out).toBe(
      "User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n",
    );
  });

  it("includes the configured base path in the Sitemap URL", () => {
    const out = renderRobots({
      noindex: false,
      siteUrl: "https://example.com",
      base: "/doc",
      sitemap: true,
    });
    expect(out).toContain(
      "Sitemap: https://example.com/doc/sitemap.xml\n",
    );
  });

  it("normalizes a trailing slash from the configured base path", () => {
    const out = renderRobots({
      noindex: false,
      siteUrl: "https://example.com",
      base: "/doc/",
      sitemap: true,
    });
    expect(out).toContain(
      "Sitemap: https://example.com/doc/sitemap.xml\n",
    );
  });

  it("does not add a slash for a root base path", () => {
    const out = renderRobots({
      noindex: false,
      siteUrl: "https://example.com",
      base: "/",
      sitemap: true,
    });
    expect(out).toContain(
      "Sitemap: https://example.com/sitemap.xml\n",
    );
  });

  it("keeps the existing Sitemap URL when base is absent", () => {
    const out = renderRobots({
      noindex: false,
      siteUrl: "https://example.com",
      sitemap: true,
    });
    expect(out).toBe(
      "User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n",
    );
  });

  it("noindex still omits Sitemap when a base path is set", () => {
    const out = renderRobots({
      noindex: true,
      siteUrl: "https://example.com",
      base: "/doc",
      sitemap: true,
    });
    expect(out).toBe("User-agent: *\nDisallow: /\n");
    expect(out).not.toContain("Sitemap:");
  });

  it("strips a trailing slash from siteUrl before building the Sitemap URL", () => {
    const out = renderRobots({
      noindex: false,
      siteUrl: "https://example.com/",
      sitemap: true,
    });
    expect(out).toContain("Sitemap: https://example.com/sitemap.xml\n");
  });

  it("empty-string siteUrl with sitemap enabled omits the Sitemap line", () => {
    const out = renderRobots({ noindex: false, siteUrl: "", sitemap: true });
    expect(out).toBe("User-agent: *\nAllow: /\n");
  });
});
