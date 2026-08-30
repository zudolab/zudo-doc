import { describe, expect, it } from "vitest";
import { h, type ComponentType } from "preact";
import render from "preact-render-to-string";
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

  it("binds asset component translations to the active route locale", () => {
    const ctx = makeFakeChromeContext({
      overrides: {
        assetManifest: {
          dir: "assets",
          routePrefix: "files",
          entries: [
            {
              path: "demo.js",
              name: "demo.js",
              dir: "",
              kind: "code",
              mime: "text/javascript",
              language: "javascript",
              bytes: 100,
              lines: 3,
            },
          ],
          excerpts: {},
        },
        t: (key: string, locale?: string) =>
          key === "asset.lines" && locale === "ja" ? "{count} 行" : key,
      },
    });
    const { createMdxComponentsBound } = deriveMdxComponents(ctx);
    const components = createMdxComponentsBound("ja");
    const Asset = components.Asset as ComponentType<{ src: string }>;
    const html = render(h(Asset, { src: "/assets/demo.js" }));
    expect(html).toContain("3 行");
    expect(html).not.toContain("3 lines");
  });
});
