// Unit tests for the theme-pack runtime swap engine (ADR
// `docs/adr/theme-packs.md` Decision 3; epic Theme Core #2812, #2822).
//
// The package vitest config runs in a plain Node environment (no jsdom), so
// the browser surface `applyThemePack` touches is stubbed with minimal fakes
// (the `color-scheme-sync.test.ts` convention, extended with a fake <head> +
// <link> element model so the dual-link await-load commit, the rapid-switch
// race token, and the failure paths are all exercised for real).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_THEME_PACK_SLUG,
  THEME_PACK_ATTR,
  THEME_PACK_CHANGED_EVENT,
  THEME_PACK_LINK_ATTR,
  THEME_PACK_LINK_LOADING_ATTR,
  THEME_PACK_RUNTIME_GLOBAL,
  THEME_PACK_STORAGE_KEY,
  applyThemePack,
  buildPackCssUrl,
  readThemePackFromDom,
  subscribeThemePackChanged,
  type ThemePackChangeDetail,
  type ThemePackRuntimeConfig,
} from "../theme-pack-sync.js";
import { DEFAULT_THEME_PACK_SLUG as REGISTRY_DEFAULT_SLUG } from "../../theme-packs-registry/meta-schema.js";
import { applyColorScheme } from "../../theme-toggle/color-scheme-sync.js";

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

type LinkListener = () => void;

class FakeLinkElement {
  readonly tagName = "LINK";
  parentNode: FakeHead | null = null;
  private attrs = new Map<string, string>();
  private listeners = new Map<string, LinkListener[]>();

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }
  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }
  hasAttribute(name: string): boolean {
    return this.attrs.has(name);
  }
  removeAttribute(name: string): void {
    this.attrs.delete(name);
  }
  addEventListener(type: string, listener: LinkListener): void {
    const arr = this.listeners.get(type) ?? [];
    arr.push(listener);
    this.listeners.set(type, arr);
  }
  remove(): void {
    this.parentNode?.removeChild(this);
    this.parentNode = null;
  }
  fire(type: "load" | "error"): void {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
}

class FakeHead {
  children: FakeLinkElement[] = [];
  appendChild(el: FakeLinkElement): void {
    el.parentNode = this;
    this.children.push(el);
  }
  removeChild(el: FakeLinkElement): void {
    const idx = this.children.indexOf(el);
    if (idx >= 0) this.children.splice(idx, 1);
  }
}

function makeFakeDocument() {
  const attrs = new Map<string, string>();
  const attrHistory: Array<[string, string]> = [];
  const head = new FakeHead();
  return {
    documentElement: {
      getAttribute: (name: string) => attrs.get(name) ?? null,
      setAttribute: (name: string, value: string) => {
        attrs.set(name, value);
        attrHistory.push([name, value]);
      },
      style: { colorScheme: "" },
    },
    head,
    attrHistory,
    createElement: (tag: string) => {
      if (tag !== "link") throw new Error(`fake document only creates links, got "${tag}"`);
      return new FakeLinkElement();
    },
    // Supports exactly the comma-list-of-`link[attr]` selectors the engine
    // and the bootstrap use.
    querySelectorAll: (selector: string): FakeLinkElement[] => {
      const wantedAttrs = selector.split(",").map((part) => {
        const m = part.trim().match(/^link\[([^\]]+)\]$/);
        if (!m || m[1] === undefined) throw new Error(`fake querySelectorAll can't parse "${part}"`);
        return m[1];
      });
      return head.children.filter((el) => wantedAttrs.some((a) => el.hasAttribute(a)));
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

const RUNTIME: ThemePackRuntimeConfig = {
  base: "/",
  packs: { default: "0.0.0", foundry: "1.2.3", mono: "2.0.0" },
  configured: "default",
};

let fakeDocument: ReturnType<typeof makeFakeDocument>;
let fakeStorage: ReturnType<typeof makeFakeStorage>;
let fakeWindow: EventTarget & Record<string, unknown>;
let warnSpy: ReturnType<typeof vi.spyOn>;

/** Install (or, with `null`, remove) the bootstrap runtime global. */
function installRuntime(config: ThemePackRuntimeConfig | null = RUNTIME): void {
  if (config === null) {
    delete fakeWindow[THEME_PACK_RUNTIME_GLOBAL];
  } else {
    fakeWindow[THEME_PACK_RUNTIME_GLOBAL] = config;
  }
}

/** All pack link elements currently in the fake head. */
function packLinks(): FakeLinkElement[] {
  return fakeDocument.head.children.filter(
    (el) => el.hasAttribute(THEME_PACK_LINK_ATTR) || el.hasAttribute(THEME_PACK_LINK_LOADING_ATTR),
  );
}

beforeEach(() => {
  fakeDocument = makeFakeDocument();
  fakeStorage = makeFakeStorage();
  fakeWindow = new EventTarget() as EventTarget & Record<string, unknown>;
  vi.stubGlobal("window", fakeWindow);
  vi.stubGlobal("document", fakeDocument);
  vi.stubGlobal("localStorage", fakeStorage);
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  installRuntime();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  warnSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Companions
// ---------------------------------------------------------------------------

describe("constants", () => {
  it("keeps the reserved default slug in literal parity with the registry constant", () => {
    // theme-pack-sync re-declares the constant (meta-schema imports zod,
    // which must stay out of client island bundles) — guard the parity here.
    expect(DEFAULT_THEME_PACK_SLUG).toBe(REGISTRY_DEFAULT_SLUG);
  });

  it("pins the cross-package contract names (ADR naming rule)", () => {
    expect(THEME_PACK_CHANGED_EVENT).toBe("theme-pack-changed");
    expect(THEME_PACK_STORAGE_KEY).toBe("zudo-doc-theme-pack");
    expect(THEME_PACK_ATTR).toBe("data-theme-pack");
    expect(THEME_PACK_LINK_ATTR).toBe("data-zd-theme-pack-css");
  });
});

describe("buildPackCssUrl", () => {
  it("builds the ADR Decision 2 URL shape incl. the ?v= cache buster", () => {
    expect(buildPackCssUrl("/", "foundry", "1.2.3")).toBe(
      "/theme-packs/foundry/pack.css?v=1.2.3",
    );
  });

  it("respects a sub-path base prefix", () => {
    expect(buildPackCssUrl("/sub/", "mono", "2.0.0")).toBe(
      "/sub/theme-packs/mono/pack.css?v=2.0.0",
    );
  });
});

describe("readThemePackFromDom", () => {
  it("returns the data-theme-pack attribute when present", () => {
    fakeDocument.documentElement.setAttribute(THEME_PACK_ATTR, "foundry");
    expect(readThemePackFromDom()).toBe("foundry");
  });

  it('falls back to "default" when the attribute is absent or empty', () => {
    expect(readThemePackFromDom()).toBe("default");
    fakeDocument.documentElement.setAttribute(THEME_PACK_ATTR, "");
    expect(readThemePackFromDom()).toBe("default");
  });
});

// ---------------------------------------------------------------------------
// applyThemePack — happy paths
// ---------------------------------------------------------------------------

describe("applyThemePack", () => {
  it("commits a non-default pack: attr flip, link promotion, persistence, event", async () => {
    fakeDocument.documentElement.setAttribute(THEME_PACK_ATTR, "default");
    const detail: ThemePackChangeDetail[] = [];
    fakeWindow.addEventListener(THEME_PACK_CHANGED_EVENT, (e) => {
      detail.push((e as CustomEvent<ThemePackChangeDetail>).detail);
    });

    const p = applyThemePack("foundry");
    // The loading link is appended synchronously, marked loading, not active.
    const [link] = packLinks();
    expect(link).toBeDefined();
    expect(link!.hasAttribute(THEME_PACK_LINK_LOADING_ATTR)).toBe(true);
    expect(link!.hasAttribute(THEME_PACK_LINK_ATTR)).toBe(false);
    expect(link!.getAttribute("href")).toBe("/theme-packs/foundry/pack.css?v=1.2.3");
    expect(link!.getAttribute("rel")).toBe("stylesheet");
    // The attribute must NOT flip before the stylesheet loaded.
    expect(readThemePackFromDom()).toBe("default");

    link!.fire("load");
    await expect(p).resolves.toBe(true);

    expect(readThemePackFromDom()).toBe("foundry");
    expect(link!.hasAttribute(THEME_PACK_LINK_ATTR)).toBe(true);
    expect(link!.hasAttribute(THEME_PACK_LINK_LOADING_ATTR)).toBe(false);
    expect(fakeStorage.getItem(THEME_PACK_STORAGE_KEY)).toBe("foundry");
    expect(detail).toEqual([{ pack: "foundry", previous: "default" }]);
    expect(packLinks()).toHaveLength(1);
  });

  it("switching to \"default\" removes the pack link without inserting a new one", async () => {
    fakeDocument.documentElement.setAttribute(THEME_PACK_ATTR, "default");
    const p1 = applyThemePack("foundry");
    packLinks()[0]!.fire("load");
    await p1;

    const events: ThemePackChangeDetail[] = [];
    fakeWindow.addEventListener(THEME_PACK_CHANGED_EVENT, (e) => {
      events.push((e as CustomEvent<ThemePackChangeDetail>).detail);
    });

    await expect(applyThemePack("default")).resolves.toBe(true);
    expect(readThemePackFromDom()).toBe("default");
    expect(packLinks()).toHaveLength(0);
    expect(fakeStorage.getItem(THEME_PACK_STORAGE_KEY)).toBe("default");
    expect(events).toEqual([{ pack: "default", previous: "foundry" }]);
  });

  it("no-ops (returns true, no event, no link) when the pack is already active", async () => {
    fakeDocument.documentElement.setAttribute(THEME_PACK_ATTR, "foundry");
    const listener = vi.fn();
    fakeWindow.addEventListener(THEME_PACK_CHANGED_EVENT, listener);

    await expect(applyThemePack("foundry")).resolves.toBe(true);
    expect(packLinks()).toHaveLength(0);
    expect(listener).not.toHaveBeenCalled();
    expect(fakeStorage.getItem(THEME_PACK_STORAGE_KEY)).toBeNull();
  });

  it("builds base-prefixed URLs for sub-path deployments", async () => {
    installRuntime({ ...RUNTIME, base: "/docs-site/" });
    const p = applyThemePack("mono");
    const [link] = packLinks();
    expect(link!.getAttribute("href")).toBe("/docs-site/theme-packs/mono/pack.css?v=2.0.0");
    link!.fire("load");
    await expect(p).resolves.toBe(true);
  });

  it("still commits (returns true, dispatches) when localStorage.setItem throws", async () => {
    fakeStorage.setItem = () => {
      throw new Error("quota");
    };
    const listener = vi.fn();
    fakeWindow.addEventListener(THEME_PACK_CHANGED_EVENT, listener);

    const p = applyThemePack("foundry");
    packLinks()[0]!.fire("load");
    await expect(p).resolves.toBe(true);
    expect(readThemePackFromDom()).toBe("foundry");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Validation failures
  // -------------------------------------------------------------------------

  it("rejects a slug missing from the enabled registry (warn, false, no DOM change)", async () => {
    await expect(applyThemePack("nonexistent")).resolves.toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]![0])).toContain('"nonexistent"');
    expect(packLinks()).toHaveLength(0);
    expect(fakeDocument.attrHistory).toHaveLength(0);
  });

  it("rejects any switch when the bootstrap runtime global is absent", async () => {
    installRuntime(null);
    await expect(applyThemePack("foundry")).resolves.toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(packLinks()).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Failure paths — old pack preserved
  // -------------------------------------------------------------------------

  it("keeps the current pack fully intact on stylesheet error (no event, no persistence)", async () => {
    // Commit foundry first so there is a real "old pack" to preserve.
    const p1 = applyThemePack("foundry");
    packLinks()[0]!.fire("load");
    await p1;
    const committedLink = packLinks()[0]!;

    const listener = vi.fn();
    fakeWindow.addEventListener(THEME_PACK_CHANGED_EVENT, listener);
    const p2 = applyThemePack("mono");
    const loading = packLinks().find((l) => l.hasAttribute(THEME_PACK_LINK_LOADING_ATTR))!;
    loading.fire("error");

    await expect(p2).resolves.toBe(false);
    expect(readThemePackFromDom()).toBe("foundry");
    // The failed link is removed; the committed foundry link is untouched.
    expect(packLinks()).toEqual([committedLink]);
    expect(committedLink.hasAttribute(THEME_PACK_LINK_ATTR)).toBe(true);
    expect(fakeStorage.getItem(THEME_PACK_STORAGE_KEY)).toBe("foundry");
    expect(listener).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("treats a never-loading stylesheet as failed after the 10s timeout", async () => {
    vi.useFakeTimers();
    const p = applyThemePack("foundry");
    expect(packLinks()).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(10_000);
    await expect(p).resolves.toBe(false);
    expect(readThemePackFromDom()).toBe("default");
    expect(packLinks()).toHaveLength(0);
    expect(fakeStorage.getItem(THEME_PACK_STORAGE_KEY)).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Rapid switching — last-write-wins race token
  // -------------------------------------------------------------------------

  it("rapid switching: only the latest call commits; no intermediate attr flip; no leaked links", async () => {
    const detail: ThemePackChangeDetail[] = [];
    fakeWindow.addEventListener(THEME_PACK_CHANGED_EVENT, (e) => {
      detail.push((e as CustomEvent<ThemePackChangeDetail>).detail);
    });

    const p1 = applyThemePack("foundry");
    const p2 = applyThemePack("mono");
    const [l1, l2] = packLinks();
    expect(packLinks()).toHaveLength(2);

    // Loads resolve in call order: the superseded call must abort silently.
    l1!.fire("load");
    l2!.fire("load");
    await expect(p1).resolves.toBe(false);
    await expect(p2).resolves.toBe(true);

    // No intermediate "foundry" frame — the attribute flipped exactly once.
    const packFlips = fakeDocument.attrHistory.filter(([n]) => n === THEME_PACK_ATTR);
    expect(packFlips).toEqual([[THEME_PACK_ATTR, "mono"]]);
    // Exactly one (promoted) link remains — no orphans.
    expect(packLinks()).toHaveLength(1);
    expect(packLinks()[0]!.getAttribute("href")).toBe("/theme-packs/mono/pack.css?v=2.0.0");
    expect(packLinks()[0]!.hasAttribute(THEME_PACK_LINK_ATTR)).toBe(true);
    expect(detail).toEqual([{ pack: "mono", previous: "default" }]);
    expect(fakeStorage.getItem(THEME_PACK_STORAGE_KEY)).toBe("mono");
    // The superseded abort is silent — no misleading load-failure warning.
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("rapid switching: latest call winning FIRST leaves the earlier call impotent", async () => {
    vi.useFakeTimers();
    const p1 = applyThemePack("foundry");
    const p2 = applyThemePack("mono");
    const [l1, l2] = packLinks();

    // The LATEST call's stylesheet loads first (cache) and commits; its commit
    // sweeps the older call's still-loading link (step 6b).
    l2!.fire("load");
    await expect(p2).resolves.toBe(true);
    expect(readThemePackFromDom()).toBe("mono");
    expect(packLinks()).toHaveLength(1);

    // The earlier call's link fires late — it must not flip anything back.
    l1!.fire("load");
    await expect(p1).resolves.toBe(false);
    expect(readThemePackFromDom()).toBe("mono");
    expect(packLinks()).toHaveLength(1);
    expect(packLinks()[0]!.getAttribute("href")).toBe("/theme-packs/mono/pack.css?v=2.0.0");
    const packFlips = fakeDocument.attrHistory.filter(([n]) => n === THEME_PACK_ATTR);
    expect(packFlips).toEqual([[THEME_PACK_ATTR, "mono"]]);
  });

  // -------------------------------------------------------------------------
  // Mode toggle (light/dark) isolation — both directions
  // -------------------------------------------------------------------------

  it("does not touch the light/dark mode state (attr, colorScheme, storage)", async () => {
    fakeDocument.documentElement.setAttribute("data-theme", "dark");
    fakeDocument.documentElement.style.colorScheme = "dark";
    fakeStorage.setItem("zudo-doc-theme", "dark");

    const p = applyThemePack("foundry");
    packLinks()[0]!.fire("load");
    await p;

    expect(fakeDocument.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(fakeDocument.documentElement.style.colorScheme).toBe("dark");
    expect(fakeStorage.getItem("zudo-doc-theme")).toBe("dark");
  });

  it("mode toggle does not touch the theme-pack state (attr, link, storage)", async () => {
    const p = applyThemePack("foundry");
    packLinks()[0]!.fire("load");
    await p;
    const packListener = vi.fn();
    fakeWindow.addEventListener(THEME_PACK_CHANGED_EVENT, packListener);

    applyColorScheme("dark");
    applyColorScheme("light");

    expect(readThemePackFromDom()).toBe("foundry");
    expect(packLinks()).toHaveLength(1);
    expect(fakeStorage.getItem(THEME_PACK_STORAGE_KEY)).toBe("foundry");
    expect(packListener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// subscribeThemePackChanged
// ---------------------------------------------------------------------------

describe("subscribeThemePackChanged", () => {
  it("notifies every subscriber after a commit and supports unsubscribe", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubFirst = subscribeThemePackChanged(first);
    subscribeThemePackChanged(second);

    const p1 = applyThemePack("foundry");
    packLinks()[0]!.fire("load");
    await p1;
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    unsubFirst();
    await applyThemePack("default");
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });
});
