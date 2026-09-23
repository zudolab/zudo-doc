import { describe, expect, it, vi } from "vitest";
import { render } from "preact-render-to-string";
import { runInNewContext } from "node:vm";
import ColorSchemeProvider from "../color-scheme-provider.js";
import { applyThemePreference, readThemePreference } from "../../theme-toggle/color-scheme-sync.js";

function bootstrap(defaultMode: "light" | "dark", respectPrefersColorScheme: boolean) {
  const html = render(<ColorSchemeProvider cssText="" colorMode={{ defaultMode, respectPrefersColorScheme }} />);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (!script) throw new Error("missing bootstrap script");
  return script;
}

function harness(stored: string | null, dark: boolean) {
  const values = new Map<string, string>();
  if (stored !== null) values.set("zudo-doc-theme", stored);
  let root = makeRoot();
  const document = new EventTarget() as EventTarget & { documentElement: ReturnType<typeof makeRoot> };
  Object.defineProperty(document, "documentElement", { get: () => root });
  const media = new EventTarget() as EventTarget & { matches: boolean };
  media.matches = dark;
  const window = new EventTarget() as EventTarget & Record<string, unknown>;
  window.matchMedia = () => media;
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  const context = { window, document, localStorage, CustomEvent: Event, };
  return {
    window, document, media, values, context,
    replaceRoot: () => { root = makeRoot(); },
    run: (script: string) => runInNewContext(script, context),
  };
}

function makeRoot() {
  const attrs = new Map<string, string>();
  return {
    style: { colorScheme: "" },
    getAttribute: (name: string) => attrs.get(name) ?? null,
    setAttribute: (name: string, value: string) => { attrs.set(name, value); },
  };
}

describe("color-scheme bootstrap execution", () => {
  it.each([
    [null, false, true, "light"],
    [null, true, true, "dark"],
    [null, true, false, "light"],
    ["system", true, false, "dark"],
    ["light", true, true, "light"],
    ["dark", false, true, "dark"],
    ["invalid", true, false, "light"],
  ] as const)("resolves stored %s, OS dark %s, respect %s", (stored, dark, respect, expected) => {
    const h = harness(stored, dark);
    h.run(bootstrap("light", respect));
    expect(h.document.documentElement.getAttribute("data-theme")).toBe(expected);
    expect(h.document.documentElement.style.colorScheme).toBe(expected);
  });

  it("uses config fallback when storage cannot be read", () => {
    const h = harness(null, true);
    h.context.localStorage.getItem = () => { throw Error("blocked"); };
    h.run(bootstrap("light", true));
    expect(h.document.documentElement.getAttribute("data-theme")).toBe("dark");
    const optOut = harness(null, true);
    optOut.context.localStorage.getItem = () => { throw Error("blocked"); };
    optOut.run(bootstrap("light", false));
    expect(optOut.document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("retains System across navigation, follows media, and avoids duplicate listeners", () => {
    const h = harness("system", false);
    const changed = vi.fn();
    h.window.addEventListener("color-scheme-changed", changed);
    const script = bootstrap("dark", false);
    h.run(script);
    h.run(script);
    expect(changed).toHaveBeenCalledTimes(1);
    h.replaceRoot();
    h.document.dispatchEvent(new Event("zfb:after-swap"));
    expect(h.document.documentElement.getAttribute("data-theme")).toBe("light");
    h.media.matches = true;
    h.media.dispatchEvent(new Event("change"));
    expect(h.document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(changed).toHaveBeenCalledTimes(2);
    h.media.dispatchEvent(new Event("change"));
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it("runtime choice survives failed persistence and is observed by the bootstrap listener", () => {
    const h = harness(null, false);
    h.run(bootstrap("dark", true));
    vi.stubGlobal("window", h.window);
    vi.stubGlobal("document", h.document);
    vi.stubGlobal("localStorage", { ...h.context.localStorage, setItem: () => { throw Error("blocked"); } });
    try {
      applyThemePreference("light");
      applyThemePreference("system");
      expect(readThemePreference()).toBe("system");
      h.media.matches = true;
      h.media.dispatchEvent(new Event("change"));
      expect(h.document.documentElement.getAttribute("data-theme")).toBe("dark");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
