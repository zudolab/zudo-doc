import { describe, expect, it } from "vitest";
import {
  ASSET_DETAILS_HIDDEN_ATTR,
  ASSET_DETAILS_PREPAINT_SCRIPT,
  ASSET_DETAILS_STORAGE_KEY,
  ASSET_PAGE_SCRIPT,
} from "../script.js";

/** Minimal `localStorage` stand-in; `available: false` models private mode / blocked cookies. */
function fakeStorage(seed: Record<string, string> = {}, available = true) {
  const map = new Map(Object.entries(seed));
  return {
    map,
    api: {
      getItem(key: string): string | null {
        if (!available) throw new Error("storage disabled");
        return map.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        if (!available) throw new Error("storage disabled");
        map.set(key, value);
      },
    },
  };
}

/**
 * A DOM fixture carrying the pieces the details-rail controller touches:
 * `<html>`, one asset page, and the toggle button inside it.
 */
function makeDetailsDom() {
  const rootAttrs = new Map<string, string>();
  const root = {
    hasAttribute: (name: string) => rootAttrs.has(name),
    setAttribute: (name: string, value: string) => rootAttrs.set(name, value),
    removeAttribute: (name: string) => rootAttrs.delete(name),
  };
  const toggleAttrs = new Map<string, string>([
    ["data-zd-label-collapse", "Hide details"],
    ["data-zd-label-expand", "Show details"],
    ["disabled", ""],
    ["aria-expanded", "true"],
    ["aria-label", "Hide details"],
  ]);
  const toggle = {
    getAttribute: (name: string) => toggleAttrs.get(name) ?? null,
    setAttribute: (name: string, value: string) => toggleAttrs.set(name, value),
    removeAttribute: (name: string) => toggleAttrs.delete(name),
  };
  let click: ((event: { target: unknown }) => void) | undefined;
  const pageAttrs = new Set<string>();
  const page = {
    hasAttribute: (name: string) => pageAttrs.has(name),
    setAttribute: (name: string) => pageAttrs.add(name),
    querySelector: (selector: string) =>
      selector === "[data-zd-asset-details-toggle]" ? toggle : null,
    addEventListener: (_name: string, listener: typeof click) => { click = listener; },
  };
  class FakeElement {
    closest(selector: string): unknown {
      return selector === "[data-zd-asset-details-toggle]" ? toggle : null;
    }
  }
  const documentFixture = {
    documentElement: root,
    querySelectorAll: () => [page],
    addEventListener: () => undefined,
  } as Record<string, unknown>;

  return {
    rootAttrs,
    toggleAttrs,
    clickToggle: () => click?.({ target: new FakeElement() }),
    run(storage: unknown) {
      new Function(
        "document",
        "Element",
        "location",
        "getComputedStyle",
        "localStorage",
        ASSET_PAGE_SCRIPT,
      )(documentFixture, FakeElement, { hash: "" }, () => ({}), storage);
    },
  };
}

describe("asset page inline script", () => {
  it("parses and carries explicit page/document idempotence guards", () => {
    expect(() => new Function(ASSET_PAGE_SCRIPT)).not.toThrow();
    expect(ASSET_PAGE_SCRIPT).toContain("hasAttribute('data-zd-asset-ready')");
    expect(ASSET_PAGE_SCRIPT).toContain("document.__zdAssetPageInit");
    expect(ASSET_PAGE_SCRIPT).toContain("zfb:after-swap");
  });

  it("initializes once across repeated script evaluation and SPA swaps", () => {
    const pageListeners: Array<(event: unknown) => void> = [];
    const documentListeners: Array<() => void> = [];
    const attributes = new Set<string>();
    const page = {
      hasAttribute: (name: string) => attributes.has(name),
      setAttribute: (name: string) => attributes.add(name),
      querySelector: () => null,
      addEventListener: (_name: string, listener: (event: unknown) => void) => pageListeners.push(listener),
    };
    const documentFixture = {
      querySelectorAll: () => [page],
      addEventListener: (_name: string, listener: () => void) => documentListeners.push(listener),
    } as Record<string, unknown>;
    const execute = new Function(
      "document",
      "Element",
      "location",
      "getComputedStyle",
      ASSET_PAGE_SCRIPT,
    );

    execute(documentFixture, class {}, { hash: "" }, () => ({}));
    execute(documentFixture, class {}, { hash: "" }, () => ({}));
    documentListeners[0]?.();

    expect(attributes.has("data-zd-asset-ready")).toBe(true);
    expect(pageListeners).toHaveLength(1);
    expect(documentListeners).toHaveLength(1);
  });

  it("measures gutter clicks from the line edge, not a nested token's offsetX", () => {
    let clickListener: ((event: { target: unknown; clientX: number; offsetX: number }) => void) | undefined;
    const attributes = new Set<string>();
    const page = {
      hasAttribute: (name: string) => attributes.has(name),
      setAttribute: (name: string) => attributes.add(name),
      querySelector: () => null,
      addEventListener: (_name: string, listener: typeof clickListener) => { clickListener = listener; },
    };
    const documentFixture = {
      querySelectorAll: () => [page],
      addEventListener: () => undefined,
    } as Record<string, unknown>;
    const line = {
      id: "L7",
      getBoundingClientRect: () => ({ left: 100 }),
    };
    class FakeElement {
      closest(selector: string): unknown {
        if (selector === ".zd-asset-code .line") return line;
        return null;
      }
    }
    const locationFixture = { hash: "" };
    let measuredPseudo = "";
    new Function(
      "document",
      "Element",
      "location",
      "getComputedStyle",
      ASSET_PAGE_SCRIPT,
    )(documentFixture, FakeElement, locationFixture, (_element: unknown, pseudo: string) => {
      measuredPseudo = pseudo;
      return { width: "40px" };
    });

    clickListener?.({ target: new FakeElement(), clientX: 160, offsetX: 2 });
    expect(locationFixture.hash).toBe("");

    clickListener?.({ target: new FakeElement(), clientX: 120, offsetX: 99 });
    expect(locationFixture.hash).toBe("L7");
    expect(measuredPseudo).toBe("::before");
  });

  it("shares one storage-key constant between the controller and the pre-paint script", () => {
    const literal = JSON.stringify(ASSET_DETAILS_STORAGE_KEY);
    expect(ASSET_PAGE_SCRIPT).toContain(literal);
    expect(ASSET_DETAILS_PREPAINT_SCRIPT).toContain(literal);
    expect(ASSET_DETAILS_PREPAINT_SCRIPT).toContain(JSON.stringify(ASSET_DETAILS_HIDDEN_ATTR));
  });
});

describe("asset details rail pre-paint script", () => {
  function runPrepaint(storage: unknown) {
    const attrs = new Map<string, string>();
    new Function(
      "document",
      "localStorage",
      ASSET_DETAILS_PREPAINT_SCRIPT,
    )(
      {
        documentElement: {
          setAttribute: (name: string, value: string) => attrs.set(name, value),
        },
      },
      storage,
    );
    return attrs;
  }

  it("marks <html> collapsed only for the exact stored 'false' preference", () => {
    expect(
      runPrepaint(fakeStorage({ [ASSET_DETAILS_STORAGE_KEY]: "false" }).api).has(
        ASSET_DETAILS_HIDDEN_ATTR,
      ),
    ).toBe(true);
    expect(runPrepaint(fakeStorage().api).size).toBe(0);
    expect(
      runPrepaint(fakeStorage({ [ASSET_DETAILS_STORAGE_KEY]: "true" }).api).size,
    ).toBe(0);
  });

  it("leaves the rail expanded when storage throws", () => {
    expect(runPrepaint(fakeStorage({}, false).api).size).toBe(0);
  });
});

describe("asset details rail controller", () => {
  it("re-reads storage on init so an SPA entry honours a stored collapsed preference", () => {
    // `preserveHtmlAttrs` can only preserve an attribute that is already
    // present, so arriving from a non-asset page (attribute absent) has to be
    // restored by this read — not by preservation (#3941).
    const dom = makeDetailsDom();
    dom.run(fakeStorage({ [ASSET_DETAILS_STORAGE_KEY]: "false" }).api);

    expect(dom.rootAttrs.has(ASSET_DETAILS_HIDDEN_ATTR)).toBe(true);
    expect(dom.toggleAttrs.get("aria-expanded")).toBe("false");
    expect(dom.toggleAttrs.get("aria-label")).toBe("Show details");
  });

  it("arms the rendered-disabled toggle and leaves the rail expanded by default", () => {
    const dom = makeDetailsDom();
    dom.run(fakeStorage().api);

    expect(dom.toggleAttrs.has("disabled")).toBe(false);
    expect(dom.rootAttrs.has(ASSET_DETAILS_HIDDEN_ATTR)).toBe(false);
    expect(dom.toggleAttrs.get("aria-expanded")).toBe("true");
    expect(dom.toggleAttrs.get("aria-label")).toBe("Hide details");
  });

  it("toggles the <html> attribute, the disclosure state and the stored preference on click", () => {
    const dom = makeDetailsDom();
    const storage = fakeStorage();
    dom.run(storage.api);

    dom.clickToggle();
    expect(dom.rootAttrs.has(ASSET_DETAILS_HIDDEN_ATTR)).toBe(true);
    expect(dom.toggleAttrs.get("aria-expanded")).toBe("false");
    expect(dom.toggleAttrs.get("aria-label")).toBe("Show details");
    expect(storage.map.get(ASSET_DETAILS_STORAGE_KEY)).toBe("false");

    dom.clickToggle();
    expect(dom.rootAttrs.has(ASSET_DETAILS_HIDDEN_ATTR)).toBe(false);
    expect(dom.toggleAttrs.get("aria-expanded")).toBe("true");
    expect(dom.toggleAttrs.get("aria-label")).toBe("Hide details");
    expect(storage.map.get(ASSET_DETAILS_STORAGE_KEY)).toBe("true");
  });

  it("still toggles for the session when storage is disabled", () => {
    const dom = makeDetailsDom();
    dom.run(fakeStorage({}, false).api);

    expect(dom.rootAttrs.has(ASSET_DETAILS_HIDDEN_ATTR)).toBe(false);
    dom.clickToggle();
    expect(dom.rootAttrs.has(ASSET_DETAILS_HIDDEN_ATTR)).toBe(true);
    expect(dom.toggleAttrs.get("aria-expanded")).toBe("false");
  });
});
