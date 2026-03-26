import { describe, it, expect, vi } from "vitest";
import { trailingSlashHandler } from "../middleware-handler";

function createContext(url: string) {
  return {
    request: { url },
    redirect: vi.fn((redirectUrl: string, status: number) => {
      return new Response(null, {
        status,
        headers: { Location: redirectUrl },
      });
    }),
  };
}

function createNext() {
  return vi.fn(() => new Response("ok"));
}

describe("trailingSlashHandler", () => {
  describe("when trailingSlash is disabled", () => {
    it("passes through without redirect", () => {
      const ctx = createContext("http://localhost/docs/guide");
      const next = createNext();

      trailingSlashHandler(ctx, next, false);

      expect(next).toHaveBeenCalled();
      expect(ctx.redirect).not.toHaveBeenCalled();
    });
  });

  describe("when trailingSlash is enabled", () => {
    it("redirects path without trailing slash to path with trailing slash", () => {
      const ctx = createContext("http://localhost/docs/guide");
      const next = createNext();

      trailingSlashHandler(ctx, next, true);

      expect(ctx.redirect).toHaveBeenCalledWith("/docs/guide/", 301);
      expect(next).not.toHaveBeenCalled();
    });

    it("passes through when path already has trailing slash", () => {
      const ctx = createContext("http://localhost/docs/guide/");
      const next = createNext();

      trailingSlashHandler(ctx, next, true);

      expect(next).toHaveBeenCalled();
      expect(ctx.redirect).not.toHaveBeenCalled();
    });

    it("passes through root path", () => {
      const ctx = createContext("http://localhost/");
      const next = createNext();

      trailingSlashHandler(ctx, next, true);

      expect(next).toHaveBeenCalled();
      expect(ctx.redirect).not.toHaveBeenCalled();
    });

    it("preserves query string in redirect", () => {
      const ctx = createContext("http://localhost/docs/guide?q=test&page=1");
      const next = createNext();

      trailingSlashHandler(ctx, next, true);

      expect(ctx.redirect).toHaveBeenCalledWith(
        "/docs/guide/?q=test&page=1",
        301,
      );
    });

    describe("skips Astro internal paths", () => {
      it("skips /_astro/ paths", () => {
        const ctx = createContext("http://localhost/_astro/chunk.abc123.js");
        const next = createNext();

        trailingSlashHandler(ctx, next, true);

        expect(next).toHaveBeenCalled();
        expect(ctx.redirect).not.toHaveBeenCalled();
      });

      it("skips /_image paths", () => {
        const ctx = createContext("http://localhost/_image?src=photo.png");
        const next = createNext();

        trailingSlashHandler(ctx, next, true);

        expect(next).toHaveBeenCalled();
        expect(ctx.redirect).not.toHaveBeenCalled();
      });
    });

    describe("skips static asset paths with file extensions", () => {
      it.each([
        ["JavaScript", "/assets/app.js"],
        ["CSS", "/assets/style.css"],
        ["image PNG", "/images/logo.png"],
        ["image SVG", "/images/icon.svg"],
        ["JSON", "/api/data.json"],
        ["HTML", "/pages/about.html"],
        ["font WOFF2", "/fonts/inter.woff2"],
      ])("skips %s file: %s", (_label, path) => {
        const ctx = createContext(`http://localhost${path}`);
        const next = createNext();

        trailingSlashHandler(ctx, next, true);

        expect(next).toHaveBeenCalled();
        expect(ctx.redirect).not.toHaveBeenCalled();
      });
    });

    describe("does not treat version-like segments as file extensions", () => {
      it("redirects /docs/v2.0 (number after dot)", () => {
        const ctx = createContext("http://localhost/docs/v2.0");
        const next = createNext();

        trailingSlashHandler(ctx, next, true);

        expect(ctx.redirect).toHaveBeenCalledWith("/docs/v2.0/", 301);
      });

      it("redirects /docs/release-1.2.3 (starts with number)", () => {
        const ctx = createContext("http://localhost/docs/release-1.2.3");
        const next = createNext();

        trailingSlashHandler(ctx, next, true);

        expect(ctx.redirect).toHaveBeenCalledWith("/docs/release-1.2.3/", 301);
      });
    });

    it("redirects deeply nested paths", () => {
      const ctx = createContext("http://localhost/docs/guides/getting-started");
      const next = createNext();

      trailingSlashHandler(ctx, next, true);

      expect(ctx.redirect).toHaveBeenCalledWith(
        "/docs/guides/getting-started/",
        301,
      );
    });

    it("redirects with empty query string", () => {
      const ctx = createContext("http://localhost/docs/guide");
      const next = createNext();

      trailingSlashHandler(ctx, next, true);

      // No query string → just trailing slash
      expect(ctx.redirect).toHaveBeenCalledWith("/docs/guide/", 301);
    });
  });
});
