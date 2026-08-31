/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { h } from "preact";
import type { ComponentType } from "preact";
import render from "preact-render-to-string";
import { describe, expect, it } from "vitest";
import type { AssetManifest } from "../../route-context-payload/types.js";
import { createMdxComponents } from "../index.js";

const manifest: AssetManifest = {
  dir: "media",
  routePrefix: "view",
  entries: [
    {
      path: "images/diagram.png",
      name: "diagram.png",
      dir: "images",
      kind: "image",
      mime: "image/png",
      bytes: 400,
      width: 800,
      height: 600,
    },
  ],
  excerpts: {},
};

const nav = () => null;

function makeComponents(assetManifest: AssetManifest | null, imageEnlarge = true, assetViewerLocale?: string) {
  return createMdxComponents({
    settings: {
      base: "/project",
      imageEnlarge,
      assetViewerDir: "media",
      assetViewerRoutePrefix: "view",
    },
    assetManifest,
    assetViewerLocale,
    locale: "en",
    currentSlug: "test",
    navData: {
      CategoryNav: nav,
      CategoryTreeNav: nav,
      SiteTreeNav: nav,
      NoteTrayIndex: nav,
    },
  });
}

function renderImageParagraph(
  assetManifest: AssetManifest | null,
  props: Record<string, unknown>,
  imageEnlarge = true,
) {
  const components = makeComponents(assetManifest, imageEnlarge);
  const Img = components.img as ComponentType<Record<string, unknown>>;
  const Paragraph = components.p as (props: Record<string, unknown>) => unknown;
  return render(Paragraph({ children: h(Img, props) }) as never);
}

describe("manifest image captions", () => {
  it("adds the caption and base-prefixed viewer link to an enlargeable image", () => {
    const html = renderImageParagraph(manifest, {
      src: "/media/images/diagram.png",
      alt: "Architecture diagram",
    });
    expect(html).toContain('class="zd-enlargeable"');
    expect(html).toContain("Architecture diagram");
    expect(html).toContain("⤢ Open asset page · 800 × 600");
    expect(html).toContain('href="/project/view/images/diagram.png/"');
    expect(html).toContain('src="/project/media/images/diagram.png"');
  });

  it("preserves the active locale in the image-caption viewer link", () => {
    const components = makeComponents(manifest, true, "ja");
    const Img = components.img as ComponentType<Record<string, unknown>>;
    const Paragraph = components.p as (props: Record<string, unknown>) => unknown;
    const html = render(Paragraph({
      children: h(Img, { src: "/media/images/diagram.png", alt: "Diagram" }),
    }) as never);
    expect(html).toContain('href="/project/ja/view/images/diagram.png/"');
  });

  it("keeps a default-only image caption on the unprefixed viewer route", () => {
    const components = createMdxComponents({
      settings: {
        base: "/project",
        imageEnlarge: true,
        assetViewerDir: "media",
        assetViewerRoutePrefix: "view",
      },
      assetManifest: manifest,
      assetViewerLocale: "ja",
      isDefaultLocaleOnlyPath: (path) => path.startsWith("/view/"),
      locale: "ja",
      currentSlug: "test",
      navData: {
        CategoryNav: nav,
        CategoryTreeNav: nav,
        SiteTreeNav: nav,
        NoteTrayIndex: nav,
      },
    });
    const Img = components.img as ComponentType<Record<string, unknown>>;
    const Paragraph = components.p as (props: Record<string, unknown>) => unknown;
    const html = render(Paragraph({
      children: h(Img, { src: "/media/images/diagram.png", alt: "Diagram" }),
    }) as never);
    expect(html).toContain('href="/project/view/images/diagram.png/"');
    expect(html).not.toContain("/project/ja/view/");
  });

  it("keeps title=no-enlarge while retaining the asset-page caption", () => {
    const html = renderImageParagraph(manifest, {
      src: "/media/images/diagram.png",
      alt: "Diagram",
      title: "no-enlarge",
    });
    expect(html).not.toContain("zd-enlarge-btn");
    expect(html).not.toContain('title="no-enlarge"');
    expect(html).toContain("Open asset page");
  });

  it("adds the caption when image enlargement is globally disabled", () => {
    const html = renderImageParagraph(
      manifest,
      { src: "/media/images/diagram.png", alt: "Diagram" },
      false,
    );
    expect(html).not.toContain("zd-enlarge-btn");
    expect(html).toContain("Open asset page");
  });

  it("leaves a non-manifest image unchanged when enlargement is disabled", () => {
    const html = renderImageParagraph(
      manifest,
      { src: "/media/images/missing.png", alt: "Missing" },
      false,
    );
    expect(html).not.toContain("<figcaption");
    expect(html).not.toContain("Open asset page");
  });

  it("keeps null-manifest behavior unchanged", () => {
    const html = renderImageParagraph(
      null,
      { src: "/media/images/diagram.png", alt: "Diagram" },
      false,
    );
    expect(html).not.toContain("<figure");
    expect(html).toContain('src="/project/media/images/diagram.png"');
  });
});
