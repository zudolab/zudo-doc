// Unit tests for the theme-pack switcher flyout state helpers (ADR
// `docs/adr/theme-packs.md` Decision 7; epic Theme Core #2812, #2821):
// Prev/Next wraparound cycling, active-entry resolution, the
// sync-on-`theme-pack-changed` connector, and the Escape-to-close wiring.
//
// The package vitest config runs in a plain Node environment (no jsdom), so
// the browser globals the connectors touch are stubbed with minimal fakes —
// the `color-scheme-sync.test.ts` convention.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  connectActivePackSync,
  connectEscapeToClose,
  cyclePackSlug,
  nextPackSlug,
  prevPackSlug,
  resolveActiveEntry,
  type ThemePackOrderEntry,
} from "../switcher-state.js";
import {
  THEME_PACK_ATTR,
  THEME_PACK_CHANGED_EVENT,
} from "../theme-pack-sync.js";

function entry(slug: string): ThemePackOrderEntry {
  return { slug, name: slug.toUpperCase(), mode: "light", description: `${slug} pack` };
}

const ORDER: ThemePackOrderEntry[] = [entry("classic"), entry("foundry"), entry("mono")];

describe("nextPackSlug / prevPackSlug — wraparound cycling", () => {
  it("advances to the next entry in order", () => {
    expect(nextPackSlug(ORDER, "classic")).toBe("foundry");
    expect(nextPackSlug(ORDER, "foundry")).toBe("mono");
  });

  it("wraps around from the last entry to the first", () => {
    expect(nextPackSlug(ORDER, "mono")).toBe("classic");
  });

  it("goes back to the previous entry in order", () => {
    expect(prevPackSlug(ORDER, "mono")).toBe("foundry");
    expect(prevPackSlug(ORDER, "foundry")).toBe("classic");
  });

  it("wraps around from the first entry to the last", () => {
    expect(prevPackSlug(ORDER, "classic")).toBe("mono");
  });

  it("returns the same slug on a single-entry order (harmless no-op cycle)", () => {
    const single = [entry("classic")];
    expect(nextPackSlug(single, "classic")).toBe("classic");
    expect(prevPackSlug(single, "classic")).toBe("classic");
  });

  it("returns null on an empty order", () => {
    expect(nextPackSlug([], "classic")).toBeNull();
    expect(prevPackSlug([], "classic")).toBeNull();
    expect(cyclePackSlug([], "classic", 1)).toBeNull();
  });

  it("recovers onto the cycle when the active slug is not in the order", () => {
    // e.g. html[data-theme-pack] carries a slug outside the switcher order:
    // Next lands on the first entry, Prev on the last.
    expect(nextPackSlug(ORDER, "rogue")).toBe("classic");
    expect(prevPackSlug(ORDER, "rogue")).toBe("mono");
  });
});

describe("resolveActiveEntry", () => {
  it("returns the entry matching the active slug", () => {
    expect(resolveActiveEntry(ORDER, "foundry")).toEqual(entry("foundry"));
  });

  it("returns null when the active slug is not in the order", () => {
    expect(resolveActiveEntry(ORDER, "rogue")).toBeNull();
    expect(resolveActiveEntry([], "classic")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Browser-global-backed connectors (fakes — no jsdom).
// ---------------------------------------------------------------------------

function makeFakeDocument() {
  const attrs = new Map<string, string>();
  const listeners = new Map<string, Array<(event: unknown) => void>>();
  return {
    documentElement: {
      getAttribute: (name: string) => attrs.get(name) ?? null,
      setAttribute: (name: string, value: string) => {
        attrs.set(name, value);
      },
    },
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      const arr = listeners.get(type) ?? [];
      arr.push(listener);
      listeners.set(type, arr);
    },
    removeEventListener: (type: string, listener: (event: unknown) => void) => {
      const arr = listeners.get(type) ?? [];
      const idx = arr.indexOf(listener);
      if (idx >= 0) arr.splice(idx, 1);
    },
    fireKeydown(key: string) {
      for (const listener of listeners.get("keydown") ?? []) listener({ key });
    },
  };
}

let fakeDocument: ReturnType<typeof makeFakeDocument>;

beforeEach(() => {
  fakeDocument = makeFakeDocument();
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", fakeDocument);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("connectActivePackSync", () => {
  it("pushes the current DOM slug immediately on connect", () => {
    fakeDocument.documentElement.setAttribute(THEME_PACK_ATTR, "foundry");
    const seen: string[] = [];
    connectActivePackSync((slug) => seen.push(slug));
    expect(seen).toEqual(["foundry"]);
  });

  it("falls back to \"default\" when the attribute is absent", () => {
    const seen: string[] = [];
    connectActivePackSync((slug) => seen.push(slug));
    expect(seen).toEqual(["classic"]);
  });

  it("re-pushes the fresh DOM slug on every theme-pack-changed event (two surfaces stay in sync)", () => {
    const seenByFlyout: string[] = [];
    const seenByDialog: string[] = [];
    connectActivePackSync((slug) => seenByFlyout.push(slug));
    connectActivePackSync((slug) => seenByDialog.push(slug));

    // Simulate the engine's commit: attribute flip THEN event (ADR D3 6a→8).
    fakeDocument.documentElement.setAttribute(THEME_PACK_ATTR, "foundry");
    window.dispatchEvent(new Event(THEME_PACK_CHANGED_EVENT));
    fakeDocument.documentElement.setAttribute(THEME_PACK_ATTR, "mono");
    window.dispatchEvent(new Event(THEME_PACK_CHANGED_EVENT));

    expect(seenByFlyout).toEqual(["classic", "foundry", "mono"]);
    expect(seenByDialog).toEqual(["classic", "foundry", "mono"]);
  });

  it("stops pushing after unsubscribe", () => {
    const seen: string[] = [];
    const unsubscribe = connectActivePackSync((slug) => seen.push(slug));

    fakeDocument.documentElement.setAttribute(THEME_PACK_ATTR, "foundry");
    window.dispatchEvent(new Event(THEME_PACK_CHANGED_EVENT));
    unsubscribe();
    fakeDocument.documentElement.setAttribute(THEME_PACK_ATTR, "mono");
    window.dispatchEvent(new Event(THEME_PACK_CHANGED_EVENT));

    expect(seen).toEqual(["classic", "foundry"]);
  });
});

describe("connectEscapeToClose", () => {
  it("invokes the callback on Escape only", () => {
    const onEscape = vi.fn();
    connectEscapeToClose(onEscape);

    fakeDocument.fireKeydown("Enter");
    fakeDocument.fireKeydown("a");
    expect(onEscape).not.toHaveBeenCalled();

    fakeDocument.fireKeydown("Escape");
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("stops listening after teardown", () => {
    const onEscape = vi.fn();
    const teardown = connectEscapeToClose(onEscape);

    fakeDocument.fireKeydown("Escape");
    teardown();
    fakeDocument.fireKeydown("Escape");

    expect(onEscape).toHaveBeenCalledTimes(1);
  });
});
