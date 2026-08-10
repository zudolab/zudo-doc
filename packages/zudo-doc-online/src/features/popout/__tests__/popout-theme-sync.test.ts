// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { subscribePopoutThemeSync } from "../popout-theme-sync";

function fireStorage(key: string, newValue: string | null): void {
  window.dispatchEvent(new StorageEvent("storage", { key, newValue }));
}

let unsubscribe: (() => void) | undefined;

afterEach(() => {
  unsubscribe?.();
  unsubscribe = undefined;
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.colorScheme = "";
});

describe("subscribePopoutThemeSync", () => {
  it("applies a valid theme value from the app's own storage key", () => {
    unsubscribe = subscribePopoutThemeSync();

    fireStorage("zudo-doc-online-theme", "dark");

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("ignores a storage event for an unrelated key", () => {
    unsubscribe = subscribePopoutThemeSync();

    fireStorage("some-other-key", "dark");

    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });

  it("ignores an invalid value", () => {
    unsubscribe = subscribePopoutThemeSync();

    fireStorage("zudo-doc-online-theme", "solarized");

    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });

  it("ignores a null newValue (key removed)", () => {
    document.documentElement.setAttribute("data-theme", "light");
    unsubscribe = subscribePopoutThemeSync();

    fireStorage("zudo-doc-online-theme", null);

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("stops applying changes after unsubscribe", () => {
    const unsub = subscribePopoutThemeSync();
    unsub();

    fireStorage("zudo-doc-online-theme", "dark");

    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });
});
