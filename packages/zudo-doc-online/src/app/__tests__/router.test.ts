import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEGACY_FALLBACK_SLUG } from "../project.js";
import {
  formatRoute,
  isPoppedOutHash,
  navigateTo,
  parseRoute,
  readCurrentRoute,
  routeProjectSlug,
  subscribeRouteChanged,
  type Route,
} from "../router.js";

describe("parseRoute", () => {
  it("defaults to the projects route for an empty hash", () => {
    expect(parseRoute("")).toEqual({ name: "projects" });
    expect(parseRoute("#")).toEqual({ name: "projects" });
    expect(parseRoute("#/")).toEqual({ name: "projects" });
  });

  it("parses the new-project route", () => {
    expect(parseRoute("#/new")).toEqual({ name: "new-project" });
  });

  it("parses the project-scoped outline route", () => {
    expect(parseRoute("#/p/aurora-docs/outline")).toEqual({
      name: "outline",
      projectSlug: "aurora-docs",
    });
  });

  it("parses the project-scoped editor route with a single-segment pageId", () => {
    expect(parseRoute("#/p/aurora-docs/editor/installation")).toEqual({
      name: "editor",
      projectSlug: "aurora-docs",
      pageId: "installation",
    });
  });

  it("falls back to the default route for a pageId with an un-encoded slash", () => {
    // formatRoute always encodeURIComponent()s the pageId, so a nested
    // pageId like "getting-started/installation" becomes one segment
    // ("getting-started%2Finstallation"). A raw un-encoded slash instead
    // produces one extra segment, which doesn't match the editor shape.
    expect(
      parseRoute("#/p/aurora-docs/editor/getting-started/installation"),
    ).toEqual({ name: "projects" });
  });

  it("decodes a URI-encoded pageId segment", () => {
    expect(
      parseRoute(
        `#/p/aurora-docs/editor/${encodeURIComponent("getting-started/installation")}`,
      ),
    ).toEqual({
      name: "editor",
      projectSlug: "aurora-docs",
      pageId: "getting-started/installation",
    });
  });

  it("parses the project-scoped popped-out preview route with a pageId", () => {
    expect(parseRoute("#/p/aurora-docs/popped-out/preview/installation")).toEqual({
      name: "popped-out-preview",
      projectSlug: "aurora-docs",
      pageId: "installation",
    });
  });

  it("decodes a URI-encoded, Unicode project slug", () => {
    const slug = "ドキュメント";
    expect(parseRoute(`#/p/${encodeURIComponent(slug)}/outline`)).toEqual({
      name: "outline",
      projectSlug: slug,
    });
  });

  it("falls back to the default route for unknown hashes", () => {
    expect(parseRoute("#/nope")).toEqual({ name: "projects" });
    expect(parseRoute("#/p/aurora-docs/nope")).toEqual({ name: "projects" });
    expect(parseRoute("#/p/aurora-docs/editor")).toEqual({ name: "projects" });
    expect(parseRoute("#/p/aurora-docs/popped-out/preview")).toEqual({
      name: "projects",
    });
    expect(parseRoute("#/p/aurora-docs/popped-out/nope/installation")).toEqual({
      name: "projects",
    });
    expect(parseRoute("#/p")).toEqual({ name: "projects" });
  });

  it("falls back to the default route for a malformed percent-encoded segment instead of throwing", () => {
    expect(() => parseRoute("#/p/aurora-docs/editor/%")).not.toThrow();
    expect(parseRoute("#/p/aurora-docs/editor/%")).toEqual({ name: "projects" });
    expect(parseRoute("#/p/%/outline")).toEqual({ name: "projects" });
    expect(
      parseRoute("#/p/aurora-docs/popped-out/preview/%E0%A4%A"),
    ).toEqual({ name: "projects" });
  });

  it("tolerates a trailing slash", () => {
    expect(parseRoute("#/p/aurora-docs/editor/installation/")).toEqual({
      name: "editor",
      projectSlug: "aurora-docs",
      pageId: "installation",
    });
  });

  describe("legacy, un-scoped hashes", () => {
    it("maps #/outline to the legacy fallback project", () => {
      expect(parseRoute("#/outline")).toEqual({
        name: "outline",
        projectSlug: LEGACY_FALLBACK_SLUG,
      });
    });

    it("maps #/editor/:pageId to the legacy fallback project", () => {
      expect(parseRoute("#/editor/installation")).toEqual({
        name: "editor",
        projectSlug: LEGACY_FALLBACK_SLUG,
        pageId: "installation",
      });
    });

    it("maps #/popped-out/preview/:pageId to the legacy fallback project", () => {
      expect(parseRoute("#/popped-out/preview/installation")).toEqual({
        name: "popped-out-preview",
        projectSlug: LEGACY_FALLBACK_SLUG,
        pageId: "installation",
      });
    });

    it("decodes a legacy editor pageId", () => {
      expect(
        parseRoute(`#/editor/${encodeURIComponent("getting-started/installation")}`),
      ).toEqual({
        name: "editor",
        projectSlug: LEGACY_FALLBACK_SLUG,
        pageId: "getting-started/installation",
      });
    });
  });
});

describe("formatRoute", () => {
  it("formats every route back into a hash string", () => {
    expect(formatRoute({ name: "projects" })).toBe("#/");
    expect(formatRoute({ name: "new-project" })).toBe("#/new");
    expect(formatRoute({ name: "outline", projectSlug: "aurora-docs" })).toBe(
      "#/p/aurora-docs/outline",
    );
    expect(
      formatRoute({ name: "editor", projectSlug: "aurora-docs", pageId: "installation" }),
    ).toBe("#/p/aurora-docs/editor/installation");
    expect(
      formatRoute({
        name: "popped-out-preview",
        projectSlug: "aurora-docs",
        pageId: "installation",
      }),
    ).toBe("#/p/aurora-docs/popped-out/preview/installation");
  });

  it("URI-encodes the pageId", () => {
    expect(
      formatRoute({
        name: "editor",
        projectSlug: "aurora-docs",
        pageId: "getting-started/installation",
      }),
    ).toBe("#/p/aurora-docs/editor/getting-started%2Finstallation");
  });

  it("URI-encodes the project slug", () => {
    expect(
      formatRoute({ name: "outline", projectSlug: "getting started" }),
    ).toBe("#/p/getting%20started/outline");
  });
});

describe("parseRoute / formatRoute round trip", () => {
  it("round-trips every route shape", () => {
    const routes: Route[] = [
      { name: "projects" },
      { name: "new-project" },
      { name: "outline", projectSlug: "aurora-docs" },
      { name: "editor", projectSlug: "aurora-docs", pageId: "installation" },
      {
        name: "popped-out-preview",
        projectSlug: "aurora-docs",
        pageId: "installation",
      },
    ];

    for (const route of routes) {
      expect(parseRoute(formatRoute(route))).toEqual(route);
    }
  });

  it("round-trips encoded Japanese / Unicode project slugs", () => {
    const slugs = ["ドキュメント", "プロジェクト-1", "café"];
    for (const projectSlug of slugs) {
      const outline: Route = { name: "outline", projectSlug };
      expect(parseRoute(formatRoute(outline))).toEqual(outline);

      const editor: Route = { name: "editor", projectSlug, pageId: "installation" };
      expect(parseRoute(formatRoute(editor))).toEqual(editor);

      const popout: Route = {
        name: "popped-out-preview",
        projectSlug,
        pageId: "installation",
      };
      expect(parseRoute(formatRoute(popout))).toEqual(popout);
    }
  });

  it("round-trips an encoded Unicode pageId alongside a Unicode slug", () => {
    const route: Route = {
      name: "editor",
      projectSlug: "ドキュメント",
      pageId: "はじめに/インストール",
    };
    expect(parseRoute(formatRoute(route))).toEqual(route);
  });
});

describe("routeProjectSlug", () => {
  it("is null for routes with no project context", () => {
    expect(routeProjectSlug({ name: "projects" })).toBeNull();
    expect(routeProjectSlug({ name: "new-project" })).toBeNull();
  });

  it("is the route's slug for project-scoped routes", () => {
    expect(routeProjectSlug({ name: "outline", projectSlug: "aurora-docs" })).toBe(
      "aurora-docs",
    );
    expect(
      routeProjectSlug({ name: "editor", projectSlug: "aurora-docs", pageId: "x" }),
    ).toBe("aurora-docs");
    expect(
      routeProjectSlug({
        name: "popped-out-preview",
        projectSlug: "aurora-docs",
        pageId: "x",
      }),
    ).toBe("aurora-docs");
  });
});

describe("isPoppedOutHash", () => {
  it("is true only for the popped-out preview route", () => {
    expect(isPoppedOutHash("#/p/aurora-docs/popped-out/preview/installation")).toBe(
      true,
    );
    expect(isPoppedOutHash("#/popped-out/preview/installation")).toBe(true);
    expect(isPoppedOutHash("#/")).toBe(false);
    expect(isPoppedOutHash("#/p/aurora-docs/outline")).toBe(false);
    expect(isPoppedOutHash("#/p/aurora-docs/editor/installation")).toBe(false);
    expect(isPoppedOutHash("")).toBe(false);
  });
});

describe("readCurrentRoute / navigateTo / subscribeRouteChanged", () => {
  let hash: string;
  const listeners = new Map<string, Set<() => void>>();

  beforeEach(() => {
    hash = "";
    listeners.clear();
    vi.stubGlobal("window", {
      location: {
        get hash() {
          return hash;
        },
        set hash(value: string) {
          hash = value.startsWith("#") ? value : `#${value}`;
        },
      },
      addEventListener: (type: string, handler: () => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)?.add(handler);
      },
      removeEventListener: (type: string, handler: () => void) => {
        listeners.get(type)?.delete(handler);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("readCurrentRoute reads from window.location.hash", () => {
    hash = "#/p/aurora-docs/editor/installation";
    expect(readCurrentRoute()).toEqual({
      name: "editor",
      projectSlug: "aurora-docs",
      pageId: "installation",
    });
  });

  it("navigateTo writes a formatted hash to window.location.hash", () => {
    navigateTo({ name: "editor", projectSlug: "aurora-docs", pageId: "installation" });
    expect(hash).toBe("#/p/aurora-docs/editor/installation");
  });

  it("subscribeRouteChanged notifies on hashchange with the freshly read route, and unsubscribes cleanly", () => {
    const seen: Route[] = [];
    const unsubscribe = subscribeRouteChanged((route) => seen.push(route));

    hash = "#/p/aurora-docs/editor/installation";
    listeners.get("hashchange")?.forEach((handler) => handler());

    unsubscribe();
    hash = "#/p/aurora-docs/outline";
    listeners.get("hashchange")?.forEach((handler) => handler());

    expect(seen).toEqual([
      { name: "editor", projectSlug: "aurora-docs", pageId: "installation" },
    ]);
  });
});
