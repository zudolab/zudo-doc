/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * SSG HTML-presence test for the DesktopSidebarToggle island component.
 *
 * Verifies that the toggle button appears in the serialized HTML produced
 * by `preact-render-to-string`. The button renders in both visible and
 * hidden states with the correct aria attributes.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VNode } from "preact";
import { render } from "preact-render-to-string";
import { Island } from "@takazudo/zfb";
import {
  DesktopSidebarToggle,
  SIDEBAR_STORAGE_KEY,
  readState,
  setDataAttribute,
} from "../index.js";

describe("DesktopSidebarToggle — SSG HTML presence", () => {
  it("renders a button element in static HTML", () => {
    const html = render(<DesktopSidebarToggle />);
    expect(html).toContain("<button");
  });

  it("renders in visible (default) state with correct aria-label", () => {
    const html = render(<DesktopSidebarToggle />);
    // SSR defaults to visible=true
    expect(html).toContain('aria-label="Hide sidebar"');
    expect(html).toContain('aria-pressed="true"');
  });

  it("renders the zd-desktop-sidebar-toggle class in static HTML", () => {
    const html = render(<DesktopSidebarToggle />);
    expect(html).toContain("zd-desktop-sidebar-toggle");
  });

  it("renders the transition-persist data attribute", () => {
    const html = render(<DesktopSidebarToggle />);
    expect(html).toContain('data-zfb-transition-persist="desktop-sidebar-toggle"');
  });
});

// Behaviour test for the mount-time reconcile (bug zudolab/zudo-doc#2571):
// when localStorage has the collapsed preference, a freshly-mounted toggle
// must reconcile to hidden on INITIAL LOAD — independent of the SPA
// AFTER_NAVIGATE_EVENT. The package vitest config runs in a plain Node env
// (no jsdom), so — mirroring the sibling ThemeToggle's color-scheme-sync
// tests — the browser globals the mount effect touches are stubbed with
// minimal fakes and the two helpers the effect uses (`readState` to reconcile
// `visible`, `setDataAttribute` to apply `<html data-sidebar-hidden>`) are
// exercised directly. No AFTER_NAVIGATE_EVENT is ever dispatched here, so the
// reconcile is proven to happen on load alone.
function makeFakeDocument() {
  const attrs = new Map<string, string>();
  return {
    documentElement: {
      getAttribute: (name: string) => attrs.get(name) ?? null,
      hasAttribute: (name: string) => attrs.has(name),
      setAttribute: (name: string, value: string) => {
        attrs.set(name, value);
      },
      removeAttribute: (name: string) => {
        attrs.delete(name);
      },
    },
  };
}

function makeFakeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

describe("DesktopSidebarToggle — mount reconcile (hard-reload, no SPA nav)", () => {
  let fakeDocument: ReturnType<typeof makeFakeDocument>;
  let fakeStorage: ReturnType<typeof makeFakeStorage>;

  beforeEach(() => {
    fakeDocument = makeFakeDocument();
    fakeStorage = makeFakeStorage();
    // `window` must be defined for readState() to consult localStorage
    // (it short-circuits to `true` when window is undefined, i.e. during SSR).
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("document", fakeDocument);
    vi.stubGlobal("localStorage", fakeStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reconciles to hidden when localStorage says 'false'", () => {
    fakeStorage.setItem(SIDEBAR_STORAGE_KEY, "false");

    // This is exactly what the island's mount effect computes on initial load.
    const visible = readState();
    expect(visible).toBe(false);

    // ...and applies to <html> via setDataAttribute — no SPA nav involved.
    setDataAttribute(visible);
    expect(fakeDocument.documentElement.hasAttribute("data-sidebar-hidden")).toBe(
      true,
    );
    expect(fakeDocument.documentElement.getAttribute("data-sidebar-hidden")).toBe(
      "",
    );
  });

  it("reconciles to visible (attribute removed) when no preference is stored", () => {
    const visible = readState();
    expect(visible).toBe(true);

    setDataAttribute(visible);
    expect(fakeDocument.documentElement.hasAttribute("data-sidebar-hidden")).toBe(
      false,
    );
  });

  it("treats an explicit 'true' preference as visible", () => {
    fakeStorage.setItem(SIDEBAR_STORAGE_KEY, "true");
    expect(readState()).toBe(true);
  });
});

describe("DesktopSidebarToggle — displayName pin", () => {
  it("has displayName set to DesktopSidebarToggle", () => {
    expect(DesktopSidebarToggle.displayName).toBe("DesktopSidebarToggle");
  });
});

describe("DesktopSidebarToggle — call-site Island marker", () => {
  it("emits data-zfb-island=DesktopSidebarToggle in SSG output", () => {
    const html = render(
      // Island() returns the public IslandElement shape ({ type, props, key });
      // it is a real Preact VNode at runtime, so re-view it as VNode for render().
      Island({
        when: "load",
        children: <DesktopSidebarToggle />,
      }) as unknown as VNode,
    );
    expect(html).toContain('data-zfb-island="DesktopSidebarToggle"');
  });
});
