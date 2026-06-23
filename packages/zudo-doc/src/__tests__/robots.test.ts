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
