import { describe, expect, it } from "vitest";
import { ASSET_PAGE_SCRIPT } from "../script.js";

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
});
