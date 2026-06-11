// Unit tests for the ThemeToggle cross-instance sync contract (#2012 E3).
//
// The package vitest config runs in a plain Node environment (no jsdom),
// so the browser globals the helpers touch are stubbed with minimal
// fakes: `window` is a real Node EventTarget (dispatch/addEventListener
// semantics match the browser), `document.documentElement` is a tiny
// attribute bag, and `localStorage` is a Map-backed stub. The full
// two-mounted-instances behaviour (icon flips in both toggles) is
// covered by a manual headless-browser check — see issue #2012
// acceptance notes.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COLOR_SCHEME_CHANGED_EVENT,
  applyColorScheme,
  readColorSchemeFromDom,
  subscribeColorSchemeChanged,
} from "../color-scheme-sync.js";

function makeFakeDocument() {
  const attrs = new Map<string, string>();
  return {
    documentElement: {
      getAttribute: (name: string) => attrs.get(name) ?? null,
      setAttribute: (name: string, value: string) => {
        attrs.set(name, value);
      },
      style: { colorScheme: "" },
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

let fakeDocument: ReturnType<typeof makeFakeDocument>;
let fakeStorage: ReturnType<typeof makeFakeStorage>;

beforeEach(() => {
  fakeDocument = makeFakeDocument();
  fakeStorage = makeFakeStorage();
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", fakeDocument);
  vi.stubGlobal("localStorage", fakeStorage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readColorSchemeFromDom", () => {
  it("returns the data-theme attribute when valid", () => {
    fakeDocument.documentElement.setAttribute("data-theme", "light");
    expect(readColorSchemeFromDom("dark")).toBe("light");
  });

  it("falls back to defaultMode when the attribute is absent", () => {
    expect(readColorSchemeFromDom("dark")).toBe("dark");
    expect(readColorSchemeFromDom("light")).toBe("light");
  });

  it("falls back to defaultMode on an unexpected attribute value", () => {
    fakeDocument.documentElement.setAttribute("data-theme", "solarized");
    expect(readColorSchemeFromDom("dark")).toBe("dark");
  });
});

describe("applyColorScheme", () => {
  it("mutates the DOM and persists the active mode", () => {
    applyColorScheme("light");

    expect(fakeDocument.documentElement.getAttribute("data-theme")).toBe(
      "light",
    );
    expect(fakeDocument.documentElement.style.colorScheme).toBe("light");
    expect(fakeStorage.getItem("zudo-doc-theme")).toBe("light");
  });

  it("preserves zdtp tweak-state keys so saved tweaks carry over (#2037)", () => {
    // Carry-over contract: zdtp owns the tweak-state lifecycle. It persists the
    // unified envelope under `zudo-doc-tweak-state-v3` (auto-migrating the
    // legacy v2/v1 keys into it) and re-seeds the color slice from the newly
    // active scheme on the `color-scheme-changed` event this function fires.
    // The host must NOT reach into zdtp's private storage keys — deleting them
    // on every toggle wiped scheme-independent spacing/typography/size tweaks
    // and contradicted the documented carry-over guarantee.
    fakeStorage.setItem("zudo-doc-tweak-state", "{}"); // legacy v1
    fakeStorage.setItem("zudo-doc-tweak-state-v2", "{}"); // legacy v2
    fakeStorage.setItem("zudo-doc-tweak-state-v3", "{}"); // current

    applyColorScheme("light");

    expect(fakeStorage.getItem("zudo-doc-tweak-state")).toBe("{}");
    expect(fakeStorage.getItem("zudo-doc-tweak-state-v2")).toBe("{}");
    expect(fakeStorage.getItem("zudo-doc-tweak-state-v3")).toBe("{}");
  });

  it("dispatches the color-scheme-changed window event", () => {
    const listener = vi.fn();
    window.addEventListener(COLOR_SCHEME_CHANGED_EVENT, listener);

    applyColorScheme("dark");

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("cross-instance sync (subscribeColorSchemeChanged)", () => {
  it("notifies every subscriber with the freshly applied mode", () => {
    // Simulates two mounted ThemeToggle instances: each subscribes and
    // re-reads the DOM on the shared event.
    const seenByHeader: string[] = [];
    const seenBySidebar: string[] = [];
    subscribeColorSchemeChanged(() => {
      seenByHeader.push(readColorSchemeFromDom("dark"));
    });
    subscribeColorSchemeChanged(() => {
      seenBySidebar.push(readColorSchemeFromDom("dark"));
    });

    applyColorScheme("light");
    applyColorScheme("dark");

    expect(seenByHeader).toEqual(["light", "dark"]);
    expect(seenBySidebar).toEqual(["light", "dark"]);
  });

  it("stops notifying after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeColorSchemeChanged(listener);

    applyColorScheme("light");
    unsubscribe();
    applyColorScheme("dark");

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
