// Unit tests for the ThemeToggle color-scheme sync contract. Mirrors the
// test approach in @takazudo/zudo-doc's own
// theme-toggle/__tests__/color-scheme-sync.test.ts: the package vitest
// config runs in a plain Node environment (no jsdom), so `window` is a real
// Node EventTarget and `document`/`localStorage` are minimal fakes.

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
    fakeDocument.documentElement.setAttribute("data-theme", "dark");
    expect(readColorSchemeFromDom("light")).toBe("dark");
  });

  it("falls back to defaultMode when the attribute is absent", () => {
    expect(readColorSchemeFromDom("light")).toBe("light");
    expect(readColorSchemeFromDom("dark")).toBe("dark");
  });

  it("falls back to defaultMode on an unexpected attribute value", () => {
    fakeDocument.documentElement.setAttribute("data-theme", "solarized");
    expect(readColorSchemeFromDom("light")).toBe("light");
  });
});

describe("applyColorScheme", () => {
  it("mutates the DOM and persists the active mode under the app's own storage key", () => {
    applyColorScheme("dark");

    expect(fakeDocument.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(fakeDocument.documentElement.style.colorScheme).toBe("dark");
    expect(fakeStorage.getItem("zudo-doc-online-theme")).toBe("dark");
  });

  it("dispatches the color-scheme-changed window event", () => {
    const listener = vi.fn();
    window.addEventListener(COLOR_SCHEME_CHANGED_EVENT, listener);

    applyColorScheme("light");

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("subscribeColorSchemeChanged", () => {
  it("notifies every subscriber with the freshly applied mode", () => {
    const seenByFirst: string[] = [];
    const seenBySecond: string[] = [];
    subscribeColorSchemeChanged(() => {
      seenByFirst.push(readColorSchemeFromDom("light"));
    });
    subscribeColorSchemeChanged(() => {
      seenBySecond.push(readColorSchemeFromDom("light"));
    });

    applyColorScheme("dark");
    applyColorScheme("light");

    expect(seenByFirst).toEqual(["dark", "light"]);
    expect(seenBySecond).toEqual(["dark", "light"]);
  });

  it("stops notifying after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeColorSchemeChanged(listener);

    applyColorScheme("dark");
    unsubscribe();
    applyColorScheme("light");

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
