/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Unit tests for the theme-pack FOUC-safe bootstrap (ADR
// `docs/adr/theme-packs.md` Decision 3 "Hard-load bootstrap"; #2822).
//
// Two layers of coverage:
//   1. RENDER — `ThemePackProvider` emits the inline script + the configured-
//      pack <noscript> fallback (omitted for "default") via
//      preact-render-to-string.
//   2. BEHAVIOR — the emitted script STRING is executed against a fake
//      document/localStorage/window (the script only references those three
//      globals, so `new Function` parameter shadowing injects the fakes),
//      proving the stored-slug resolution, validation fallback, base-prefixed
//      document.write, runtime-global publication, and the AFTER_NAVIGATE
//      re-apply handler (createElement/appendChild — NEVER document.write
//      after load).

import { describe, expect, it, vi } from "vitest";
import { render } from "preact-render-to-string";
import ThemePackProvider, {
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
    documentElement: { getAttribute(n: string): string | null };
    write: ReturnType<typeof vi.fn>;
    addEventListener: (type: string, handler: BootstrapEventHandler) => void;
    createElement: (tag: string) => FakeBootstrapLink;
    querySelectorAll: (selector: string) => FakeBootstrapLink[];
    head: FakeBootstrapHead;
  };
  window: Record<string, unknown>;
  attr: (name: string) => string | null;
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
      // @ts-expect-error — setAttribute lives on the same object literal.
      setAttribute: (n: string, v: string) => {
        attrs.set(n, v);
      },
    },
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
  // The script references exactly these three globals; parameter shadowing
  // injects the fakes.
  new Function("document", "localStorage", "window", script)(
    env.document,
    storage,
    env.window,
  );
}

// ---------------------------------------------------------------------------
// Behavior — executing the emitted script
// ---------------------------------------------------------------------------

describe("buildThemePackBootstrap (executed)", () => {
  it("uses a VALID persisted slug over the configured one and document.writes exactly one render-blocking link", () => {
    const env = makeBootstrapEnv("foundry");
    runBootstrap(buildThemePackBootstrap("default", ENABLED, "/"), env);

    expect(env.attr(THEME_PACK_ATTR)).toBe("foundry");
    expect(env.document.write).toHaveBeenCalledTimes(1);
    expect(env.document.write).toHaveBeenCalledWith(
      `<link rel="stylesheet" ${THEME_PACK_LINK_ATTR} href="/theme-packs/foundry/pack.css?v=1.2.3">`,
    );
  });

  it("falls back to the configured slug on an INVALID stored slug (no crash, no write for default)", () => {
    const env = makeBootstrapEnv("no-such-pack");
    runBootstrap(buildThemePackBootstrap("default", ENABLED, "/"), env);

    expect(env.attr(THEME_PACK_ATTR)).toBe("default");
    expect(env.document.write).not.toHaveBeenCalled();
  });

  it("survives a throwing localStorage (falls back to configured)", () => {
    const env = makeBootstrapEnv(null, true);
    runBootstrap(buildThemePackBootstrap("foundry", ENABLED, "/"), env);

    expect(env.attr(THEME_PACK_ATTR)).toBe("foundry");
    expect(env.document.write).toHaveBeenCalledTimes(1);
  });

  it("emits no stylesheet write when the resolved pack is default (stock look = zero requests)", () => {
    const env = makeBootstrapEnv(null);
    runBootstrap(buildThemePackBootstrap("default", ENABLED, "/"), env);

    expect(env.attr(THEME_PACK_ATTR)).toBe("default");
    expect(env.document.write).not.toHaveBeenCalled();
  });

  it("prefixes pack URLs with the deployment base", () => {
    const env = makeBootstrapEnv("foundry");
    runBootstrap(buildThemePackBootstrap("default", ENABLED, "/sub/"), env);

    expect(env.document.write).toHaveBeenCalledWith(
      `<link rel="stylesheet" ${THEME_PACK_LINK_ATTR} href="/sub/theme-packs/foundry/pack.css?v=1.2.3">`,
    );
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
      expect(env.document.write).toHaveBeenCalledTimes(1);

      // Simulate zfb's head swap dropping the pack link + the root-attribute
      // reset a missing preserve-list would cause.
      env.head.children.length = 0;
      (env.document.documentElement as unknown as {
        setAttribute(n: string, v: string): void;
      }).setAttribute(THEME_PACK_ATTR, "default");

      env.fireAfterNavigate();

      expect(env.attr(THEME_PACK_ATTR)).toBe("foundry");
      expect(env.head.children).toHaveLength(1);
      const link = env.head.children[0]!;
      expect(link.getAttribute("rel")).toBe("stylesheet");
      expect(link.hasAttribute(THEME_PACK_LINK_ATTR)).toBe(true);
      expect(link.getAttribute("href")).toBe("/theme-packs/foundry/pack.css?v=1.2.3");
      // Post-load re-apply must never document.write (it would clobber the doc).
      expect(env.document.write).toHaveBeenCalledTimes(1);
    });

    it("is idempotent when the correct link survived the swap", () => {
      const env = makeBootstrapEnv("foundry");
      runBootstrap(buildThemePackBootstrap("default", ENABLED, "/"), env);

      // Seed the head with the exact link the bootstrap would have written.
      const existing = new FakeBootstrapLink();
      existing.setAttribute("rel", "stylesheet");
      existing.setAttribute(THEME_PACK_LINK_ATTR, "");
      existing.setAttribute("href", "/theme-packs/foundry/pack.css?v=1.2.3");
      env.head.appendChild(existing);

      env.fireAfterNavigate();

      expect(env.head.children).toEqual([existing]);
    });

    it("keeps a live (unpersisted) pack across soft navigation when storage has nothing", () => {
      // Scenario: applyThemePack committed "foundry" at runtime but
      // localStorage.setItem failed (private mode) — the live html attribute
      // (which rides preserveHtmlAttrs) is the only surviving record.
      const env = makeBootstrapEnv(null);
      runBootstrap(buildThemePackBootstrap("default", ENABLED, "/"), env);
      (env.document.documentElement as unknown as {
        setAttribute(n: string, v: string): void;
      }).setAttribute(THEME_PACK_ATTR, "foundry");
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
      expect(env.document.write).toHaveBeenCalledTimes(1);

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
      expect(env.head.children).toHaveLength(0);

      // Fire with the SAME reference used as the shadowed `document` global.
      // Without the `newDocument === document` guard this would append a
      // second link straight into the LIVE head via env.document.createElement
      // / env.head.appendChild — corrupting the live document.
      env.fireBeforeSwap(env.document);

      expect(env.head.children).toHaveLength(0);
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
  it("emits the bootstrap script and the configured-pack noscript fallback", () => {
    const out = render(
      <ThemePackProvider configuredSlug="foundry" enabled={ENABLED} base="/" />,
    );
    expect(out).toContain("<script>");
    expect(out).toContain('"zudo-doc-theme-pack"');
    expect(out).toContain(
      '<noscript><link rel="stylesheet" href="/theme-packs/foundry/pack.css?v=1.2.3"/></noscript>',
    );
    // The script must precede the noscript (ADR emission order).
    expect(out.indexOf("<script>")).toBeLessThan(out.indexOf("<noscript>"));
  });

  it("omits the noscript fallback when the configured pack is default", () => {
    const out = render(
      <ThemePackProvider configuredSlug="default" enabled={ENABLED} base="/" />,
    );
    expect(out).toContain("<script>");
    expect(out).not.toContain("<noscript>");
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
