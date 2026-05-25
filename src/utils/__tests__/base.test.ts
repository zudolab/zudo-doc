import { describe, it, expect, beforeAll } from "vitest";
import { navHref, getPathForLocale, normalizedBase, isDefaultLocaleOnlyPath, buildLocaleLinks } from "../base";
import { settings } from "@/config/settings";
import { defaultLocale } from "@/config/i18n";

// Guard: all test expectations are hard-coded against these settings values.
// If they change, tests will fail with a clear message here instead of cryptic
// assertion diffs throughout.
beforeAll(() => {
  expect(normalizedBase).toBe("");
  expect(settings.trailingSlash).toBe(true);
  expect(defaultLocale).toBe("en");
});

describe("navHref", () => {
  describe("default locale (en), no version", () => {
    it("prepends base and appends trailing slash", () => {
      expect(navHref("/docs/getting-started", "en", undefined)).toBe(
        "/docs/getting-started/",
      );
    });

    it("handles root path", () => {
      expect(navHref("/", "en", undefined)).toBe("/");
    });
  });

  describe("non-default locale (ja), no version", () => {
    it("inserts locale prefix after base", () => {
      expect(navHref("/docs/getting-started", "ja", undefined)).toBe(
        "/ja/docs/getting-started/",
      );
    });

    it("handles root path", () => {
      expect(navHref("/", "ja", undefined)).toBe("/ja/");
    });
  });

  describe("with version prefix", () => {
    it("inserts /v/{version} for default locale", () => {
      expect(navHref("/docs/getting-started", "en", "1.0")).toBe(
        "/v/1.0/docs/getting-started/",
      );
    });
  });

  describe("with both locale and version", () => {
    it("inserts locale before version prefix", () => {
      expect(navHref("/docs/getting-started", "ja", "1.0")).toBe(
        "/ja/v/1.0/docs/getting-started/",
      );
    });
  });

  describe("undefined lang", () => {
    it("treats undefined lang as default locale", () => {
      expect(navHref("/docs/getting-started", undefined, undefined)).toBe(
        "/docs/getting-started/",
      );
    });

    it("treats undefined lang with version same as default locale", () => {
      expect(navHref("/docs/guides", undefined, "1.0")).toBe(
        "/v/1.0/docs/guides/",
      );
    });
  });
});

describe("isDefaultLocaleOnlyPath", () => {
  // Guard: tests rely on these prefixes being configured.
  beforeAll(() => {
    expect(settings.defaultLocaleOnlyPrefixes).toContain("/docs/claude-md/");
    expect(settings.defaultLocaleOnlyPrefixes).not.toContain("/docs/claude/");
    expect(normalizedBase).toBe("");
  });

  it("returns false for /docs/claude/ (top-level claude is bilingual, not in prefix list)", () => {
    expect(isDefaultLocaleOnlyPath("/docs/claude/")).toBe(false);
  });

  it("returns true for /docs/claude-md/", () => {
    expect(isDefaultLocaleOnlyPath("/docs/claude-md/")).toBe(true);
  });

  it("returns true for a sub-path under /docs/claude-md/", () => {
    expect(isDefaultLocaleOnlyPath("/docs/claude-md/some-file/")).toBe(true);
  });

  it("returns false for /docs/guides/", () => {
    expect(isDefaultLocaleOnlyPath("/docs/guides/")).toBe(false);
  });

  it("returns false for /docs/claude-extras/ (not in prefix list)", () => {
    expect(isDefaultLocaleOnlyPath("/docs/claude-extras/")).toBe(false);
  });

  it("strips basePath before matching — /docs/claude-md/ returns true", () => {
    expect(isDefaultLocaleOnlyPath("/docs/claude-md/")).toBe(true);
  });
});

describe("getPathForLocale", () => {
  describe("switch from default to non-default", () => {
    it("adds locale prefix (en → ja)", () => {
      expect(
        getPathForLocale("/docs/getting-started/", "en", "ja"),
      ).toBe("/ja/docs/getting-started/");
    });
  });

  describe("switch from non-default to default", () => {
    it("removes locale prefix (ja → en)", () => {
      expect(
        getPathForLocale("/ja/docs/getting-started/", "ja", "en"),
      ).toBe("/docs/getting-started/");
    });
  });

  describe("same locale (no-op)", () => {
    it("returns same path for en → en", () => {
      expect(
        getPathForLocale("/docs/getting-started/", "en", "en"),
      ).toBe("/docs/getting-started/");
    });

    it("returns same path for ja → ja", () => {
      expect(
        getPathForLocale("/ja/docs/guides/", "ja", "ja"),
      ).toBe("/ja/docs/guides/");
    });
  });
});

describe("buildLocaleLinks", () => {
  beforeAll(() => {
    expect(settings.defaultLocaleOnlyPrefixes).toContain("/docs/claude-md/");
    expect(settings.defaultLocaleOnlyPrefixes).not.toContain("/docs/claude/");
  });

  it("returns single-element list for a default-locale deep claude-md path (switcher hides)", () => {
    const links = buildLocaleLinks("/docs/claude-md/some-slug/", "en");
    expect(links).toHaveLength(1);
    expect(links[0].code).toBe("en");
    expect(links[0].active).toBe(true);
  });

  it("returns full list for /docs/claude/ (top-level, not in prefix list)", () => {
    const links = buildLocaleLinks("/docs/claude/", "en");
    expect(links.length).toBeGreaterThan(1);
    expect(links.some((l) => l.code === "en")).toBe(true);
    expect(links.some((l) => l.code === "ja")).toBe(true);
  });

  it("returns full list for a non-claude page", () => {
    const links = buildLocaleLinks("/docs/guides/configuration/", "en");
    expect(links.length).toBeGreaterThan(1);
    expect(links.some((l) => l.code === "en")).toBe(true);
    expect(links.some((l) => l.code === "ja")).toBe(true);
  });

  it("returns single-element list (only ja) when on a JA deep claude-md path", () => {
    const links = buildLocaleLinks("/ja/docs/claude-md/some-slug/", "ja");
    expect(links).toHaveLength(1);
    expect(links[0].code).toBe("ja");
    expect(links[0].active).toBe(true);
  });
});
