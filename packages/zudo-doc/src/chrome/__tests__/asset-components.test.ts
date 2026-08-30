import { describe, expect, it } from "vitest";
import type { ChromeContext } from "../../factory-context/index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";
import { deriveMdxComponents } from "../derive.js";

describe("asset MDX defaults", () => {
  it("registers Asset and AssetCode defaults", () => {
    const ctx = makeFakeChromeContext();
    const { createMdxComponentsBound } = deriveMdxComponents(ctx);
    const components = createMdxComponentsBound();
    expect(components.Asset).toBeTypeOf("function");
    expect(components.AssetCode).toBeTypeOf("function");
  });

  it("lets host mdxExtras win independently per key", () => {
    const HostAsset = () => "host asset";
    const ctx = makeFakeChromeContext({
      overrides: {
        hostBindings: { mdxExtras: { Asset: HostAsset } },
      } as Partial<ChromeContext>,
    });
    const { createMdxComponentsBound } = deriveMdxComponents(ctx);
    const components = createMdxComponentsBound();
    expect(components.Asset).toBe(HostAsset);
    expect(components.AssetCode).toBeTypeOf("function");
  });
});
