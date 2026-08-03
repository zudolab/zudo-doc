/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * SSG HTML-presence test for the DesktopTocToggle island component. Mirrors
 * desktop-sidebar-toggle-island/__tests__/desktop-sidebar-toggle-ssg.test.tsx
 * 1:1 for the desktop TOC-toggle feature (epic #3252, #3254).
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
  DesktopTocToggle,
  TOC_STORAGE_KEY,
  readState,
  setDataAttribute,
} from "../index.js";

describe("DesktopTocToggle — SSG HTML presence", () => {
  it("renders a button element in static HTML", () => {
    const html = render(<DesktopTocToggle />);
    expect(html).toContain("<button");
  });

  it("renders in visible (default) state with correct aria-label", () => {
    const html = render(<DesktopTocToggle />);
    // SSR defaults to visible=true
    expect(html).toContain('aria-label="Hide table of contents"');
    expect(html).toContain('aria-pressed="true"');
  });

  it("renders the zd-desktop-toc-toggle class in static HTML", () => {
    const html = render(<DesktopTocToggle />);
    expect(html).toContain("zd-desktop-toc-toggle");
  });

  it("renders the transition-persist data attribute", () => {
    const html = render(<DesktopTocToggle />);
    expect(html).toContain('data-zfb-transition-persist="desktop-toc-toggle"');
  });
});

// Reconcile-helper contract, mirroring desktop-sidebar-toggle-island's own
// (bug zudolab/zudo-doc#2571 pattern). The island's mount effect reconciles
// the persisted preference on initial load via exactly two helpers:
// `readState()` (reads localStorage → the `visible` value) and
// `setDataAttribute(visible)` (applies/removes `<html data-toc-hidden>`).
// These tests pin that helper contract — the units the mount effect composes.
//
// SCOPE NOTE (honest about what this does NOT cover): the package vitest runs
// in a plain Node env (no jsdom/happy-dom), so these exercise the helpers
// DIRECTLY — they do NOT mount the component or run its `useEffect`, and would
// still pass if the mount effect itself were deleted. The load-bearing
// pre-paint `<script>` hoisted into `<head>` before `.zd-toc-col` is guarded
// end-to-end by `toc-prepaint/__tests__/toc-prepaint-ssg.test`; the mount
// effect's actual firing is a browser-only behaviour outside this node test
// env's reach.
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

describe("DesktopTocToggle — reconcile helpers (readState / setDataAttribute)", () => {
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
    fakeStorage.setItem(TOC_STORAGE_KEY, "false");

    // This is exactly what the island's mount effect computes on initial load.
    const visible = readState();
    expect(visible).toBe(false);

    // ...and applies to <html> via setDataAttribute — no SPA nav involved.
    setDataAttribute(visible);
    expect(fakeDocument.documentElement.hasAttribute("data-toc-hidden")).toBe(
      true,
    );
    expect(fakeDocument.documentElement.getAttribute("data-toc-hidden")).toBe(
      "",
    );
  });

  it("reconciles to visible (attribute removed) when no preference is stored", () => {
    const visible = readState();
    expect(visible).toBe(true);

    setDataAttribute(visible);
    expect(fakeDocument.documentElement.hasAttribute("data-toc-hidden")).toBe(
      false,
    );
  });

  it("treats an explicit 'true' preference as visible", () => {
    fakeStorage.setItem(TOC_STORAGE_KEY, "true");
    expect(readState()).toBe(true);
  });
});

describe("DesktopTocToggle — displayName pin", () => {
  it("has displayName set to DesktopTocToggle", () => {
    expect(DesktopTocToggle.displayName).toBe("DesktopTocToggle");
  });
});

describe("DesktopTocToggle — call-site Island marker", () => {
  it("emits data-zfb-island=DesktopTocToggle in SSG output", () => {
    const html = render(
      // Island() returns the public IslandElement shape ({ type, props, key });
      // it is a real Preact VNode at runtime, so re-view it as VNode for render().
      Island({
        when: "load",
        children: <DesktopTocToggle />,
      }) as unknown as VNode,
    );
    expect(html).toContain('data-zfb-island="DesktopTocToggle"');
  });
});
