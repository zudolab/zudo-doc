import { describe, expect, it } from "vitest";
import { ASSET_INDEX_PAGE_SCRIPT } from "../script.js";

describe("asset index inline script", () => {
  it("parses and carries page/document idempotence and SPA guards", () => {
    expect(() => new Function(ASSET_INDEX_PAGE_SCRIPT)).not.toThrow();
    expect(ASSET_INDEX_PAGE_SCRIPT).toContain("hasAttribute('data-zd-asset-index-ready')");
    expect(ASSET_INDEX_PAGE_SCRIPT).toContain("document.__zdAssetIndexPageInit");
    expect(ASSET_INDEX_PAGE_SCRIPT).toContain("zfb:after-swap");
  });

  it("initializes once and expands or collapses every disclosure", () => {
    const documentListeners: Array<() => void> = [];
    const buttonListeners: Array<() => void> = [];
    const attributes = new Set<string>();
    const details = [{ open: false }, { open: false }];
    const buttons = ["expand", "collapse"].map((action) => ({
      removeAttribute: () => undefined,
      getAttribute: () => action,
      addEventListener: (_name: string, listener: () => void) => buttonListeners.push(listener),
    }));
    const page = {
      hasAttribute: (name: string) => attributes.has(name),
      setAttribute: (name: string) => attributes.add(name),
      querySelectorAll: (selector: string) => selector === "[data-zd-asset-index-action]" ? buttons : details,
    };
    const documentFixture = {
      querySelectorAll: () => [page],
      addEventListener: (_name: string, listener: () => void) => documentListeners.push(listener),
    } as Record<string, unknown>;
    const execute = new Function("document", ASSET_INDEX_PAGE_SCRIPT);

    execute(documentFixture);
    execute(documentFixture);
    documentListeners[0]?.();
    buttonListeners[0]?.();
    expect(details.every((item) => item.open)).toBe(true);
    buttonListeners[1]?.();
    expect(details.every((item) => !item.open)).toBe(true);
    expect(buttonListeners).toHaveLength(2);
    expect(documentListeners).toHaveLength(1);
  });
});
