import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatRoute,
  isPoppedOutHash,
  navigateTo,
  parseRoute,
  readCurrentRoute,
  subscribeRouteChanged,
  type Route,
} from "../router.js";

describe("parseRoute", () => {
  it("defaults to the outline route for an empty hash", () => {
    expect(parseRoute("")).toEqual({ name: "outline" });
    expect(parseRoute("#")).toEqual({ name: "outline" });
    expect(parseRoute("#/")).toEqual({ name: "outline" });
  });

  it("parses the outline route", () => {
    expect(parseRoute("#/outline")).toEqual({ name: "outline" });
  });

  it("parses the editor route with a single-segment pageId", () => {
    expect(parseRoute("#/editor/installation")).toEqual({
      name: "editor",
      pageId: "installation",
    });
  });

  it("falls back to the default route for a pageId with an un-encoded slash", () => {
    // formatRoute always encodeURIComponent()s the pageId, so a nested
    // pageId like "getting-started/installation" becomes one segment
    // ("getting-started%2Finstallation"). A raw un-encoded slash instead
    // produces 3 segments, which doesn't match the 2-segment editor shape.
    expect(parseRoute("#/editor/getting-started/installation")).toEqual({
      name: "outline",
    });
  });

  it("decodes a URI-encoded pageId segment", () => {
    expect(
      parseRoute(`#/editor/${encodeURIComponent("getting-started/installation")}`),
    ).toEqual({
      name: "editor",
      pageId: "getting-started/installation",
    });
  });

  it("parses the popped-out preview route with a pageId", () => {
    expect(parseRoute("#/popped-out/preview/installation")).toEqual({
      name: "popped-out-preview",
      pageId: "installation",
    });
  });

  it("falls back to the default route for unknown hashes", () => {
    expect(parseRoute("#/nope")).toEqual({ name: "outline" });
    expect(parseRoute("#/editor")).toEqual({ name: "outline" });
    expect(parseRoute("#/popped-out/preview")).toEqual({ name: "outline" });
    expect(parseRoute("#/popped-out/nope/installation")).toEqual({
      name: "outline",
    });
  });

  it("falls back to the default route for a malformed percent-encoded pageId instead of throwing", () => {
    expect(() => parseRoute("#/editor/%")).not.toThrow();
    expect(parseRoute("#/editor/%")).toEqual({ name: "outline" });
    expect(parseRoute("#/popped-out/preview/%E0%A4%A")).toEqual({
      name: "outline",
    });
  });

  it("tolerates a trailing slash", () => {
    expect(parseRoute("#/editor/installation/")).toEqual({
      name: "editor",
      pageId: "installation",
    });
  });
});

describe("formatRoute", () => {
  it("formats every route back into a hash string", () => {
    expect(formatRoute({ name: "outline" })).toBe("#/outline");
    expect(formatRoute({ name: "editor", pageId: "installation" })).toBe(
      "#/editor/installation",
    );
    expect(
      formatRoute({ name: "popped-out-preview", pageId: "installation" }),
    ).toBe("#/popped-out/preview/installation");
  });

  it("URI-encodes the pageId", () => {
    expect(
      formatRoute({ name: "editor", pageId: "getting-started/installation" }),
    ).toBe("#/editor/getting-started%2Finstallation");
  });
});

describe("parseRoute / formatRoute round trip", () => {
  it("round-trips every route shape", () => {
    const routes: Route[] = [
      { name: "outline" },
      { name: "editor", pageId: "installation" },
      { name: "popped-out-preview", pageId: "installation" },
    ];

    for (const route of routes) {
      expect(parseRoute(formatRoute(route))).toEqual(route);
    }
  });
});

describe("isPoppedOutHash", () => {
  it("is true only for the popped-out preview route", () => {
    expect(isPoppedOutHash("#/popped-out/preview/installation")).toBe(true);
    expect(isPoppedOutHash("#/outline")).toBe(false);
    expect(isPoppedOutHash("#/editor/installation")).toBe(false);
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
    hash = "#/editor/installation";
    expect(readCurrentRoute()).toEqual({ name: "editor", pageId: "installation" });
  });

  it("navigateTo writes a formatted hash to window.location.hash", () => {
    navigateTo({ name: "editor", pageId: "installation" });
    expect(hash).toBe("#/editor/installation");
  });

  it("subscribeRouteChanged notifies on hashchange with the freshly read route, and unsubscribes cleanly", () => {
    const seen: Route[] = [];
    const unsubscribe = subscribeRouteChanged((route) => seen.push(route));

    hash = "#/editor/installation";
    listeners.get("hashchange")?.forEach((handler) => handler());

    unsubscribe();
    hash = "#/outline";
    listeners.get("hashchange")?.forEach((handler) => handler());

    expect(seen).toEqual([{ name: "editor", pageId: "installation" }]);
  });
});
