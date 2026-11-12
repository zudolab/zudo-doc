/** @jsxRuntime automatic */
import { describe, expect, it, vi } from "vitest";
import { h } from "@takazudo/zfb/zudo-react";
import type { Component } from "@takazudo/zfb/zudo-react";
import { renderSsr as render } from "../../__tests__/helpers/zudo-react.js";
import type { ChromeContext } from "../../factory-context/index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";
import { deriveMdxComponents } from "../derive.js";
import { createMdxComponents } from "../../mdx-components/index.js";

const NAV_DOCS = [{ slug: "guides/setup", data: { title: "Setup", description: "Install." } }];

describe("navigation composition MDX components", () => {
  it("registers DocCardNav and WideSectionHeading per page and binds the page locale/version", () => {
    const resolveNavSource = vi.fn(() => ({ navDocs: NAV_DOCS, categoryMeta: new Map() }));
    const ctx = makeFakeChromeContext({ overrides: { resolveNavSource } as Partial<ChromeContext> });
    const { createMdxComponentsBound } = deriveMdxComponents(ctx);
    const components = createMdxComponentsBound("ja", "1.0");
    const DocCardNav = components.DocCardNav as Component<{ docs: string[] }>;
    const html = render(h(DocCardNav, { docs: ["guides/setup"] }));
    expect(resolveNavSource).toHaveBeenCalledWith("ja", "1.0", expect.any(Object));
    expect(html).toContain('href="/v/1.0/ja/docs/guides/setup"');
    const Heading = components.WideSectionHeading as Component<{ id: string; children: string }>;
    expect(render(h(Heading, { id: "picks", children: "Picks" }))).toContain('<h2 id="picks" class="text-title font-bold leading-tight pt-vsp-sm border-t-[3px] border-transparent"');
  });

  it("lets host mdxExtras replace the defaults", () => {
    const HostCards = () => "host";
    const ctx = makeFakeChromeContext({
      overrides: { hostBindings: { mdxExtras: { DocCardNav: HostCards } } } as Partial<ChromeContext>,
    });
    expect(deriveMdxComponents(ctx).createMdxComponentsBound().DocCardNav).toBe(HostCards);
  });

  it("does not require new fields from hand-constructed MdxNavData", () => {
    const stub = () => null;
    const components = createMdxComponents({
      settings: { base: "/", imageEnlarge: false, assetViewerDir: "assets", assetViewerRoutePrefix: "assets" },
      locale: "en",
      currentSlug: "",
      navData: { CategoryNav: stub, CategoryTreeNav: stub, SiteTreeNav: stub, NoteTrayIndex: stub },
    });
    expect(components.SiteTreeNav).toBeTypeOf("function");
  });
});
