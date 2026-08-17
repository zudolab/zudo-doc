/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Unit tests for the theme-pack FOUC-safe bootstrap (ADR
// `docs/adr/theme-packs.md` Decision 3 "Hard-load bootstrap"; #2822;
// document.write → head appendChild + explicit latch, #3399).
//
// Two layers of coverage:
//   1. RENDER — `ThemePackProvider` emits the latch <style>, the inline
//      script, and the configured-pack <noscript> fallback (omitted for
//      "default") via preact-render-to-string.
//   2. BEHAVIOR — the emitted script STRING is executed against a fake
//      document/localStorage/window (the script references those three globals
//      plus `setTimeout`, so `new Function` parameter shadowing injects the
//      fakes and vitest's fake timers drive the watchdog), proving the
//      stored-slug resolution, validation fallback, base-prefixed single link
//      insertion, the latch lifecycle (armed before insertion; released on
//      load, on error, and by the watchdog), inertness of a post-load
//      re-evaluation, runtime-global publication, and the AFTER_NAVIGATE
//      re-apply handler.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "preact-render-to-string";
import ThemePackProvider, {
  THEME_PACK_LATCH_CSS,
  THEME_PACK_LOADING_ATTR,
  THEME_PACK_LOAD_WATCHDOG_MS,
  buildThemePackBootstrap,
  resolveThemePackSsrSlug,
  themePackVersionMap,
} from "../theme-pack-provider.js";
import { AFTER_NAVIGATE_EVENT, BEFORE_SWAP_EVENT } from "../../transitions/page-events.js";
import {
  THEME_PACK_ATTR,
  THEME_PACK_LINK_ATTR,
  THEME_PACK_RUNTIME_GLOBAL,
} from "../../theme-pack-switcher/theme-pack-sync.js";
import type { ThemePackRegistry } from "../../theme-packs-registry/index.js";

const ENABLED = { default: "0.0.0", foundry: "1.2.3" };

// ---------------------------------------------------------------------------
// Fake browser surface for executing the bootstrap string
// ---------------------------------------------------------------------------

class FakeBootstrapLink {
  parentNode: FakeBootstrapHead | null = null;
  // The bootstrap assigns these directly (the on* property form, so the fake
  // needs no addEventListener); tests fire them to drive the latch lifecycle.
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private attrs = new Map<string, string>();
  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }
  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }
  hasAttribute(name: string): boolean {
    return this.attrs.has(name);
  }
}

class FakeBootstrapHead {
  children: FakeBootstrapLink[] = [];
  appendChild(el: FakeBootstrapLink): void {
    el.parentNode = this;
    this.children.push(el);
  }
  removeChild(el: FakeBootstrapLink): void {
    const idx = this.children.indexOf(el);
    if (idx >= 0) this.children.splice(idx, 1);
    el.parentNode = null;
  }
  // Only "link" is exercised by the before-swap handler — it queries all
  // links then filters by rel/href itself (see production code comment on
  // NOT interpolating href into a selector).
  querySelectorAll(selector: string): FakeBootstrapLink[] {
    if (selector === "link") return [...this.children];
    throw new Error(`unexpected selector "${selector}"`);
  }
}

// Stand-in for the `newDocument` zfb's `zfb:before-swap` event carries — a
// SEPARATE (not-yet-live) document-like object with its own `head` and
// `createElement`, distinct from the live `document` fake above.
class FakeNewDocument {
  head: FakeBootstrapHead;
  constructor(initialLinks: FakeBootstrapLink[] = []) {
    this.head = new FakeBootstrapHead();
    for (const link of initialLinks) this.head.appendChild(link);
  }
  createElement(_tag: string): FakeBootstrapLink {
    return new FakeBootstrapLink();
  }
}

// The before-swap handler receives a real event with a `newDocument` field;
// every other handler in this file (after-navigate) is fired with no
// argument, so the shared listener signature makes it optional.
type BootstrapEventHandler = (event?: { newDocument?: unknown }) => void;

interface BootstrapEnv {
  document: {
    documentElement: {
      getAttribute(n: string): string | null;
      setAttribute(n: string, v: string): void;
      removeAttribute(n: string): void;
    };
    write: ReturnType<typeof vi.fn>;
    addEventListener: (type: string, handler: BootstrapEventHandler) => void;
    createElement: (tag: string) => FakeBootstrapLink;
    querySelectorAll: (selector: string) => FakeBootstrapLink[];
    head: FakeBootstrapHead;
  };
  window: Record<string, unknown>;
  attr: (name: string) => string | null;
  hasAttr: (name: string) => boolean;
  head: FakeBootstrapHead;
  listeners: Map<string, BootstrapEventHandler[]>;
  fireAfterNavigate: () => void;
  fireBeforeSwap: (newDocument: unknown) => void;
}

function makeBootstrapEnv(stored: string | null, storageThrows = false): BootstrapEnv {
  const attrs = new Map<string, string>();
  const head = new FakeBootstrapHead();
  const listeners = new Map<string, BootstrapEventHandler[]>();
  const doc: BootstrapEnv["document"] = {
    documentElement: {
      getAttribute: (n: string) => attrs.get(n) ?? null,
      setAttribute: (n: string, v: string) => {
        attrs.set(n, v);
      },
      removeAttribute: (n: string) => {
        attrs.delete(n);
      },
    },
    // Retained purely as a regression guard: the bootstrap must NEVER call it
    // (a post-load document.write implicitly document.open()s and destroys the
    // live document — the whole reason for #3399).
    write: vi.fn(),
    addEventListener: (type, handler) => {
      const arr = listeners.get(type) ?? [];
      arr.push(handler);
      listeners.set(type, arr);
    },
    createElement: () => new FakeBootstrapLink(),
    querySelectorAll: (selector: string) => {
      const m = selector.match(/^link\[([^\]]+)\]$/);
      if (!m || m[1] === undefined) throw new Error(`unexpected selector "${selector}"`);
      const attrName = m[1];
      return head.children.filter((el) => el.hasAttribute(attrName));
    },
    head,
  };
  const win: Record<string, unknown> = {};
  const localStorageFake = {
    getItem: (_key: string) => {
      if (storageThrows) throw new Error("storage disabled");
      return stored;
    },
  };
  return {
    document: doc,
    window: win,
    attr: (name) => attrs.get(name) ?? null,
    hasAttr: (name) => attrs.has(name),
    head,
    listeners,
    fireAfterNavigate: () => {
      for (const handler of listeners.get(AFTER_NAVIGATE_EVENT) ?? []) handler();
    },
    fireBeforeSwap: (newDocument: unknown) => {
      for (const handler of listeners.get(BEFORE_SWAP_EVENT) ?? []) {
        handler({ newDocument });
      }
    },
    // Stashed so runBootstrap can reach it.
    ...({ __storage: localStorageFake } as object),
  } as BootstrapEnv;
}

function runBootstrap(script: string, env: BootstrapEnv): void {
  const storage = (env as unknown as { __storage: unknown }).__storage;
  // The script references exactly these three globals (plus `setTimeout`,
  // which resolves to the ambient one — vitest's fake timers drive the
  // watchdog); parameter shadowing injects the fakes.
  new Function("document", "localStorage", "window", script)(
    env.document,
    storage,
    env.window,
  );
}

/** The single pack link the bootstrap inserted into the live head. */
function onlyPackLink(env: BootstrapEnv): FakeBootstrapLink {
  expect(env.head.children).toHaveLength(1);
  return env.head.children[0]!;
}

function expectPackLink(link: FakeBootstrapLink, href: string): void {
  expect(link.getAttribute("rel")).toBe("stylesheet");
  expect(link.hasAttribute(THEME_PACK_LINK_ATTR)).toBe(true);
  expect(link.getAttribute("href")).toBe(href);
}

// ---------------------------------------------------------------------------
// Behavior — executing the emitted script
// ---------------------------------------------------------------------------

describe("buildThemePackBootstrap (executed)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses a VALID persisted slug over the configured one and head-appends exactly one link", () => {
    const env = makeBootstrapEnv("foundry");
    runBootstrap(buildThemePackBootstrap("default", ENABLED, "/"), env);

    expect(env.attr(THEME_PACK_ATTR)).toBe("foundry");
    expectPackLink(onlyPackLink(env), "/theme-packs/foundry/pack.css?v=1.2.3");
    // The mechanism #3399 removed: document.write after load destroys the doc.
    expect(env.document.write).not.toHaveBeenCalled();
  });

  it("falls back to the configured slug on an INVALID stored slug (no crash, no link for default)", () => {
    const env = makeBootstrapEnv("no-such-pack");
    runBootstrap(buildThemePackBootstrap("default", ENABLED, "/"), env);

    expect(env.attr(THEME_PACK_ATTR)).toBe("default");
    expect(env.head.children).toHaveLength(0);
  });

  it("survives a throwing localStorage (falls back to configured)", () => {
    const env = makeBootstrapEnv(null, true);
    runBootstrap(buildThemePackBootstrap("foundry", ENABLED, "/"), env);

    expect(env.attr(THEME_PACK_ATTR)).toBe("foundry");
    expectPackLink(onlyPackLink(env), "/theme-packs/foundry/pack.css?v=1.2.3");
  });

  it("inserts no stylesheet AND never arms the latch when the resolved pack is default (stock look = zero requests)", () => {
    const env = makeBootstrapEnv(null);
    runBootstrap(buildThemePackBootstrap("default", ENABLED, "/"), env);

    expect(env.attr(THEME_PACK_ATTR)).toBe("default");
    expect(env.head.children).toHaveLength(0);
    expect(env.hasAttr(THEME_PACK_LOADING_ATTR)).toBe(false);
    expect(env.document.write).not.toHaveBeenCalled();
  });

  it("prefixes pack URLs with the deployment base", () => {
    const env = makeBootstrapEnv("foundry");
    runBootstrap(buildThemePackBootstrap("default", ENABLED, "/sub/"), env);

    expectPackLink(onlyPackLink(env), "/sub/theme-packs/foundry/pack.css?v=1.2.3");
  });

  // -------------------------------------------------------------------------
  // Anti-FOUC latch lifecycle (#3399)
  // -------------------------------------------------------------------------

  describe("anti-FOUC latch", () => {
    it("is armed BEFORE the link is appended and stays set while the sheet is pending", () => {
      const env = makeBootstrapEnv("foundry");
      let attrAtAppend: string | null = null;
      const realAppend = env.head.appendChild.bind(env.head);
      env.head.appendChild = (el: FakeBootstrapLink) => {
        attrAtAppend = env.attr(THEME_PACK_LOADING_ATTR);
        realAppend(el);
      };

      runBootstrap(buildThemePackBootstrap("default", ENABLED, "/"), env);

      // Ordering is the whole point: arming after the append would race the
      // request it is supposed to cover.
      expect(attrAtAppend).toBe("");
      expect(env.hasAttr(THEME_PACK_LOADING_ATTR)).toBe(true);
    });

    it("is cleared when the stylesheet loads", () => {
      const env = makeBootstrapEnv("foundry");
      runBootstrap(buildThemePackBootstrap("default", ENABLED, "/"), env);

      onlyPackLink(env).onload!();

      expect(env.hasAttr(THEME_PACK_LOADING_ATTR)).toBe(false);
      // The pack attribute itself is untouched by the release.
      expect(env.attr(THEME_PACK_ATTR)).toBe("foundry");
    });

    it("is cleared when the stylesheet errors (a 404 pack must not blank the page)", () => {
      const env = makeBootstrapEnv("foundry");
      runBootstrap(buildThemePackBootstrap("default", ENABLED, "/"), env);

      onlyPackLink(env).onerror!();

      expect(env.hasAttr(THEME_PACK_LOADING_ATTR)).toBe(false);
    });

    it("is cleared by the watchdog on a sheet that never resolves — blank-screen avoidance wins", () => {
      const env = makeBootstrapEnv("foundry");
      runBootstrap(buildThemePackBootstrap("default", ENABLED, "/"), env);

      // Still latched right up to the deadline (the contract is "no FOUC
      // within the watchdog", not "clear early").
      vi.advanceTimersByTime(THEME_PACK_LOAD_WATCHDOG_MS - 1);
      expect(env.hasAttr(THEME_PACK_LOADING_ATTR)).toBe(true);

      vi.advanceTimersByTime(1);
      expect(env.hasAttr(THEME_PACK_LOADING_ATTR)).toBe(false);
    });

    it("survives the watchdog firing after an ordinary load (release is idempotent)", () => {
      const env = makeBootstrapEnv("foundry");
      runBootstrap(buildThemePackBootstrap("default", ENABLED, "/"), env);

      onlyPackLink(env).onload!();
      // The watchdog still fires; clearing an already-cleared latch must be a
      // harmless no-op rather than an error or a state reset.
      vi.advanceTimersByTime(THEME_PACK_LOAD_WATCHDOG_MS);

      expect(env.hasAttr(THEME_PACK_LOADING_ATTR)).toBe(false);
      expect(env.attr(THEME_PACK_ATTR)).toBe("foundry");
      expect(env.head.children).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Post-load re-evaluation (SPA embedding — #3393 companion)
  // -------------------------------------------------------------------------

  describe("duplicate evaluation is inert", () => {
    it("does not re-request or re-latch while the FIRST link is still pending", () => {
      const env = makeBootstrapEnv("foundry");
      const script = buildThemePackBootstrap("default", ENABLED, "/");
      runBootstrap(script, env);
      const first = onlyPackLink(env);

      // Second evaluation with the sheet still in flight (latch still armed).
      runBootstrap(script, env);

      expect(env.head.children).toEqual([first]);
      expect(env.document.write).not.toHaveBeenCalled();

      // The FIRST link's load still releases the latch — the second run must
      // not have replaced the handler or armed a second, unreleasable latch.
      first.onload!();
      expect(env.hasAttr(THEME_PACK_LOADING_ATTR)).toBe(false);
      vi.advanceTimersByTime(THEME_PACK_LOAD_WATCHDOG_MS * 2);
      expect(env.hasAttr(THEME_PACK_LOADING_ATTR)).toBe(false);
    });

    it("does not re-request or arm the latch when a matching link is ALREADY LOADED", () => {
      const env = makeBootstrapEnv("foundry");
      const script = buildThemePackBootstrap("default", ENABLED, "/");
      runBootstrap(script, env);
      const first = onlyPackLink(env);
      first.onload!();
      expect(env.hasAttr(THEME_PACK_LOADING_ATTR)).toBe(false);

      runBootstrap(script, env);

      expect(env.head.children).toEqual([first]);
      // Re-arming here would hide the body of an already-styled page for 2s.
      expect(env.hasAttr(THEME_PACK_LOADING_ATTR)).toBe(false);
      expect(env.document.write).not.toHaveBeenCalled();
    });

    it("DOES insert when only a STALE (wrong-slug) pack link is present", () => {
      // The guard keys on the resolved slug's href, not on the marker alone —
      // otherwise a leftover link from another pack would suppress the
      // correct one.
      const env = makeBootstrapEnv("foundry");
      const stale = new FakeBootstrapLink();
      stale.setAttribute("rel", "stylesheet");
      stale.setAttribute(THEME_PACK_LINK_ATTR, "");
      stale.setAttribute("href", "/theme-packs/foundry/pack.css?v=0.0.1");
      env.head.appendChild(stale);

      runBootstrap(buildThemePackBootstrap("default", ENABLED, "/"), env);

      expect(env.head.children).toHaveLength(2);
      const inserted = env.head.children.find((l) => l !== stale)!;
      expectPackLink(inserted, "/theme-packs/foundry/pack.css?v=1.2.3");
      expect(env.hasAttr(THEME_PACK_LOADING_ATTR)).toBe(true);
    });
  });

  it("publishes the runtime global applyThemePack validates against", () => {
    const env = makeBootstrapEnv(null);
    runBootstrap(buildThemePackBootstrap("default", ENABLED, "/sub/"), env);

    expect(env.window[THEME_PACK_RUNTIME_GLOBAL]).toEqual({
      base: "/sub/",
      packs: ENABLED,
      configured: "default",
    });
  });

  describe("AFTER_NAVIGATE re-apply handler (SPA navigation)", () => {
    it("registers exactly one listener on the zfb after-swap event", () => {
      const env = makeBootstrapEnv(null);
      runBootstrap(buildThemePackBootstrap("default", ENABLED, "/"), env);
      expect(env.listeners.get(AFTER_NAVIGATE_EVENT)).toHaveLength(1);
    });

    it("re-asserts the attribute and re-inserts a dropped link via appendChild — never document.write", () => {
      const env = makeBootstrapEnv("foundry");
      runBootstrap(buildThemePackBootstrap("default", ENABLED, "/"), env);
      onlyPackLink(env).onload!();

      // Simulate zfb's head swap dropping the pack link + the root-attribute
      // reset a missing preserve-list would cause.
      env.head.children.length = 0;
      env.document.documentElement.setAttribute(THEME_PACK_ATTR, "default");

      env.fireAfterNavigate();

      expect(env.attr(THEME_PACK_ATTR)).toBe("foundry");
      expectPackLink(onlyPackLink(env), "/theme-packs/foundry/pack.css?v=1.2.3");
      // Post-load re-apply must never document.write (it would clobber the doc)
      // and must not re-arm the hard-load latch.
      expect(env.document.write).not.toHaveBeenCalled();
      expect(env.hasAttr(THEME_PACK_LOADING_ATTR)).toBe(false);
    });

    it("is idempotent when the correct link survived the swap", () => {
      const env = makeBootstrapEnv("foundry");
      runBootstrap(buildThemePackBootstrap("default", ENABLED, "/"), env);
      const bootstrapped = onlyPackLink(env);
      bootstrapped.onload!();

      env.fireAfterNavigate();

      expect(env.head.children).toEqual([bootstrapped]);
    });

    it("keeps a live (unpersisted) pack across soft navigation when storage has nothing", () => {
      // Scenario: applyThemePack committed "foundry" at runtime but
      // localStorage.setItem failed (private mode) — the live html attribute
      // (which rides preserveHtmlAttrs) is the only surviving record.
      const env = makeBootstrapEnv(null);
      runBootstrap(buildThemePackBootstrap("default", ENABLED, "/"), env);
      env.document.documentElement.setAttribute(THEME_PACK_ATTR, "foundry");
      // The head swap dropped the runtime link.
      env.head.children.length = 0;

      env.fireAfterNavigate();

      // The validated live attribute wins over the configured fallback —
      // the in-session pack survives instead of silently reverting.
      expect(env.attr(THEME_PACK_ATTR)).toBe("foundry");
      expect(env.head.children).toHaveLength(1);
      expect(env.head.children[0]!.getAttribute("href")).toBe(
        "/theme-packs/foundry/pack.css?v=1.2.3",
      );
    });

    it("removes stale pack links (wrong slug) and removes the link entirely for default", () => {
      const env = makeBootstrapEnv(null);
      runBootstrap(buildThemePackBootstrap("default", ENABLED, "/"), env);

      const stale = new FakeBootstrapLink();
      stale.setAttribute("rel", "stylesheet");
      stale.setAttribute(THEME_PACK_LINK_ATTR, "");
      stale.setAttribute("href", "/theme-packs/foundry/pack.css?v=1.2.3");
      env.head.appendChild(stale);

      env.fireAfterNavigate();

      // Resolved slug is "default" → no pack link may remain.
      expect(env.head.children).toHaveLength(0);
      expect(env.attr(THEME_PACK_ATTR)).toBe("default");
    });
  });

  describe("BEFORE_SWAP injection handler (primary SPA soft-nav persistence, #3137)", () => {
    it("registers exactly one listener on the zfb before-swap event, alongside the after-swap one", () => {
      const env = makeBootstrapEnv(null);
      runBootstrap(buildThemePackBootstrap("default", ENABLED, "/"), env);
      expect(env.listeners.get(BEFORE_SWAP_EVENT)).toHaveLength(1);
      expect(env.listeners.get(AFTER_NAVIGATE_EVENT)).toHaveLength(1);
    });

    it("injects a matching link into newDocument.head for a CONFIGURED pack with EMPTY localStorage", () => {
      // The scaffolded fixed-theme-site path the bug report is about: no
      // switcher, no stored preference — just settings.themePack != "default".
      const env = makeBootstrapEnv(null);
      runBootstrap(buildThemePackBootstrap("foundry", ENABLED, "/"), env);
      expectPackLink(onlyPackLink(env), "/theme-packs/foundry/pack.css?v=1.2.3");

      const newDoc = new FakeNewDocument();
      env.fireBeforeSwap(newDoc);

      expect(newDoc.head.children).toHaveLength(1);
      const link = newDoc.head.children[0]!;
      expect(link.getAttribute("rel")).toBe("stylesheet");
      expect(link.hasAttribute(THEME_PACK_LINK_ATTR)).toBe(true);
      expect(link.getAttribute("href")).toBe("/theme-packs/foundry/pack.css?v=1.2.3");
    });

    it("does nothing when the resolved slug is default (stock look has no pack.css)", () => {
      const env = makeBootstrapEnv(null);
      runBootstrap(buildThemePackBootstrap("default", ENABLED, "/"), env);

      const newDoc = new FakeNewDocument();
      env.fireBeforeSwap(newDoc);

      expect(newDoc.head.children).toHaveLength(0);
    });

    it("does nothing when newDocument is the live document (defensive no-op)", () => {
      const env = makeBootstrapEnv("foundry");
      runBootstrap(buildThemePackBootstrap("default", ENABLED, "/"), env);
      const live = onlyPackLink(env);

      // Fire with the SAME reference used as the shadowed `document` global.
      // Without the `newDocument === document` guard this would append a
      // second link straight into the LIVE head via env.document.createElement
      // / env.head.appendChild — corrupting the live document.
      env.fireBeforeSwap(env.document);

      expect(env.head.children).toEqual([live]);
    });

    it("does nothing when newDocument.head already has a stylesheet link with the exact href", () => {
      const env = makeBootstrapEnv("foundry");
      runBootstrap(buildThemePackBootstrap("default", ENABLED, "/"), env);

      const existing = new FakeBootstrapLink();
      existing.setAttribute("rel", "stylesheet");
      existing.setAttribute("href", "/theme-packs/foundry/pack.css?v=1.2.3");
      const newDoc = new FakeNewDocument([existing]);

      env.fireBeforeSwap(newDoc);

      expect(newDoc.head.children).toEqual([existing]);
    });

    it("does NOT count a rel=preload link with the same href as present — a stylesheet link is still injected", () => {
      const env = makeBootstrapEnv("foundry");
      runBootstrap(buildThemePackBootstrap("default", ENABLED, "/"), env);

      const preload = new FakeBootstrapLink();
      preload.setAttribute("rel", "preload");
      preload.setAttribute("href", "/theme-packs/foundry/pack.css?v=1.2.3");
      const newDoc = new FakeNewDocument([preload]);

      env.fireBeforeSwap(newDoc);

      expect(newDoc.head.children).toHaveLength(2);
      const injected = newDoc.head.children.find((l) => l !== preload)!;
      expect(injected.getAttribute("rel")).toBe("stylesheet");
      expect(injected.hasAttribute(THEME_PACK_LINK_ATTR)).toBe(true);
      expect(injected.getAttribute("href")).toBe("/theme-packs/foundry/pack.css?v=1.2.3");
    });
  });

  it("contains no document.write anywhere in the emitted text (all branches, not just the exercised ones)", () => {
    // The behavior tests above prove the paths they exercise; this pins the
    // whole string, so a document.write reintroduced on a branch no test walks
    // still fails. It is the single defect #3399 exists to prevent.
    for (const configured of ["default", "foundry"]) {
      const script = buildThemePackBootstrap(configured, ENABLED, "/sub/");
      expect(script).not.toContain("document.write");
      expect(script).not.toContain("document.open");
      // …and the latch attribute IS inlined (a build-static JSON literal).
      expect(script).toContain(`"${THEME_PACK_LOADING_ATTR}"`);
      expect(script).toContain(`=${THEME_PACK_LOAD_WATCHDOG_MS};`);
    }
  });

  it("emits identical script text across repeated calls with the same arguments (build-static contract)", () => {
    // zfb's scriptsAlreadyRan dedupe is keyed on textContent — the bootstrap
    // must be a pure function of its inputs so every page's inline script is
    // byte-identical and the handlers are never double-registered.
    expect(buildThemePackBootstrap("foundry", ENABLED, "/")).toBe(
      buildThemePackBootstrap("foundry", ENABLED, "/"),
    );
  });
});

// ---------------------------------------------------------------------------
// Render — provider markup
// ---------------------------------------------------------------------------

describe("ThemePackProvider (rendered)", () => {
  it("emits the latch style, the bootstrap script and the configured-pack noscript fallback", () => {
    const out = render(
      <ThemePackProvider configuredSlug="foundry" enabled={ENABLED} base="/" />,
    );
    expect(out).toContain(`<style>${THEME_PACK_LATCH_CSS}</style>`);
    expect(out).toContain("<script>");
    expect(out).toContain('"zudo-doc-theme-pack"');
    expect(out).toContain(
      '<noscript><link rel="stylesheet" href="/theme-packs/foundry/pack.css?v=1.2.3"/></noscript>',
    );
    // Emission order (ADR Decision 3): latch style → script → noscript. The
    // latch MUST precede the script that arms it, or the rule would not be
    // live when the body parses.
    expect(out.indexOf("<style>")).toBeLessThan(out.indexOf("<script>"));
    expect(out.indexOf("<script>")).toBeLessThan(out.indexOf("<noscript>"));
  });

  it("emits the latch style even for the default pack (build-static, inert until armed)", () => {
    const out = render(
      <ThemePackProvider configuredSlug="default" enabled={ENABLED} base="/" />,
    );
    expect(out).toContain(`<style>${THEME_PACK_LATCH_CSS}</style>`);
    expect(out).toContain("<script>");
    expect(out).not.toContain("<noscript>");
  });

  it("keeps the latch rule scoped to the loading attribute (never a bare body rule)", () => {
    // A latch that hid the body unconditionally would blank every page the
    // instant the stylesheet failed to ship.
    expect(THEME_PACK_LATCH_CSS).toBe(
      `html[${THEME_PACK_LOADING_ATTR}] body{visibility:hidden}`,
    );
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe("themePackVersionMap / resolveThemePackSsrSlug", () => {
  const registry = [
    { slug: "default", meta: { version: "0.0.0" }, hasStylesheet: false },
    { slug: "foundry", meta: { version: "1.2.3" }, hasStylesheet: true },
  ] as unknown as ThemePackRegistry;

  it("builds the ordered slug → version map from the registry", () => {
    expect(themePackVersionMap(registry)).toEqual({
      default: "0.0.0",
      foundry: "1.2.3",
    });
    expect(Object.keys(themePackVersionMap(registry))).toEqual(["default", "foundry"]);
  });

  it("resolves the SSR html-attribute slug: configured slug, default fallback, inert on null registry", () => {
    expect(resolveThemePackSsrSlug(registry, { themePack: "foundry" })).toBe("foundry");
    expect(resolveThemePackSsrSlug(registry, {})).toBe("default");
    expect(resolveThemePackSsrSlug(null, { themePack: "foundry" })).toBeUndefined();
  });
});
