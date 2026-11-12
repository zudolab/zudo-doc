import { describe, it, expect } from "vitest";
import { CONTENT_SIGNAL_KEYS, renderContentSignal, renderRobots } from "../robots.js";

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

describe("renderContentSignal", () => {
  it("renders the declared signals in policy order with yes/no values", () => {
    expect(renderContentSignal({ aiTrain: false, search: true, aiInput: true })).toBe(
      "search=yes, ai-input=yes, ai-train=no",
    );
    expect(renderContentSignal({ aiTrain: true })).toBe("ai-train=yes");
    expect(CONTENT_SIGNAL_KEYS).toEqual(["search", "aiInput", "aiTrain"]);
  });

  it("returns undefined when no signal is declared", () => {
    expect(renderContentSignal(undefined)).toBeUndefined();
    expect(renderContentSignal(false)).toBeUndefined();
    expect(renderContentSignal({})).toBeUndefined();
    expect(renderContentSignal({ search: undefined })).toBeUndefined();
  });
});

describe("renderRobots — Content Signals", () => {
  const contentSignals = { search: true, aiInput: true, aiTrain: false };

  it("puts the Content-Signal line in the User-agent: * group before the rules", () => {
    expect(
      renderRobots({ noindex: false, siteUrl: "https://example.com", sitemap: true, contentSignals }),
    ).toBe(
      "User-agent: *\nContent-Signal: search=yes, ai-input=yes, ai-train=no\nAllow: /\nSitemap: https://example.com/sitemap.xml\n",
    );
  });

  it("keeps the declared signals when noindex disallows crawling", () => {
    expect(renderRobots({ noindex: true, contentSignals: { aiTrain: false } })).toBe(
      "User-agent: *\nContent-Signal: ai-train=no\nDisallow: /\n",
    );
  });

  it("publishes no line for false or an empty object", () => {
    expect(renderRobots({ noindex: false, contentSignals: false })).toBe("User-agent: *\nAllow: /\n");
    expect(renderRobots({ noindex: false, contentSignals: {} })).toBe("User-agent: *\nAllow: /\n");
  });
});
