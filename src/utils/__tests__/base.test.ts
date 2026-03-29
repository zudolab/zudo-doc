import { describe, it, expect, beforeAll } from "vitest";
import { navHref, getPathForLocale, normalizedBase } from "../base";
import { settings } from "@/config/settings";
import { defaultLocale } from "@/config/i18n";

// Guard: all test expectations are hard-coded against these settings values.
// If they change, tests will fail with a clear message here instead of cryptic
// assertion diffs throughout.
beforeAll(() => {
  expect(normalizedBase).toBe("/pj/zudo-doc");
  expect(settings.trailingSlash).toBe(true);
  expect(defaultLocale).toBe("en");
});

describe("navHref", () => {
  describe("default locale (en), no version", () => {
    it("prepends base and appends trailing slash", () => {
      expect(navHref("/docs/getting-started", "en", undefined)).toBe(
        "/pj/zudo-doc/docs/getting-started/",
      );
    });

    it("handles root path", () => {
      expect(navHref("/", "en", undefined)).toBe("/pj/zudo-doc/");
    });
  });

  describe("non-default locale (ja), no version", () => {
    it("inserts locale prefix after base", () => {
      expect(navHref("/docs/getting-started", "ja", undefined)).toBe(
        "/pj/zudo-doc/ja/docs/getting-started/",
      );
    });

    it("handles root path", () => {
      expect(navHref("/", "ja", undefined)).toBe("/pj/zudo-doc/ja/");
    });
  });

  describe("with version prefix", () => {
    it("inserts /v/{version} for default locale", () => {
      expect(navHref("/docs/getting-started", "en", "1.0")).toBe(
        "/pj/zudo-doc/v/1.0/docs/getting-started/",
      );
    });
  });

  describe("with both locale and version", () => {
    it("inserts locale before version prefix", () => {
      expect(navHref("/docs/getting-started", "ja", "1.0")).toBe(
        "/pj/zudo-doc/ja/v/1.0/docs/getting-started/",
      );
    });
  });

  describe("undefined lang", () => {
    it("treats undefined lang as default locale", () => {
      expect(navHref("/docs/getting-started", undefined, undefined)).toBe(
        "/pj/zudo-doc/docs/getting-started/",
      );
    });

    it("treats undefined lang with version same as default locale", () => {
      expect(navHref("/docs/guides", undefined, "1.0")).toBe(
        "/pj/zudo-doc/v/1.0/docs/guides/",
      );
    });
  });
});

describe("getPathForLocale", () => {
  describe("switch from default to non-default", () => {
    it("adds locale prefix (en → ja)", () => {
      expect(
        getPathForLocale("/pj/zudo-doc/docs/getting-started/", "en", "ja"),
      ).toBe("/pj/zudo-doc/ja/docs/getting-started/");
    });
  });

  describe("switch from non-default to default", () => {
    it("removes locale prefix (ja → en)", () => {
      expect(
        getPathForLocale("/pj/zudo-doc/ja/docs/getting-started/", "ja", "en"),
      ).toBe("/pj/zudo-doc/docs/getting-started/");
    });
  });

  describe("same locale (no-op)", () => {
    it("returns same path for en → en", () => {
      expect(
        getPathForLocale("/pj/zudo-doc/docs/getting-started/", "en", "en"),
      ).toBe("/pj/zudo-doc/docs/getting-started/");
    });

    it("returns same path for ja → ja", () => {
      expect(
        getPathForLocale("/pj/zudo-doc/ja/docs/guides/", "ja", "ja"),
      ).toBe("/pj/zudo-doc/ja/docs/guides/");
    });
  });
});
