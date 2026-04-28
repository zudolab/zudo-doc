import { describe, it, expect } from "vitest";
import { render } from "preact-render-to-string";
import { DocHead } from "../doc-head";
import type { HeadProps } from "../types";

/**
 * Acceptance contract for the head topic: head HTML byte-diff between the
 * legacy Astro emission (src/layouts/doc-layout.astro) and DocHead is zero,
 * modulo asset hashes. These tests pin the exact output of DocHead for a
 * range of fixtures so any silent reordering or attribute-shape regression
 * trips the suite.
 *
 * The reference snapshots use the preact-render-to-string serialisation
 * (self-closing void tags). When DocHead is consumed inside a real .astro
 * page the host serialises through Astro's HTML5 emitter, which drops the
 * "/" — both sides go through the same serialiser, so the runtime byte
 * comparison stays valid.
 */
describe("DocHead — byte-parity fixtures", () => {
  it("emits the minimum required head when only title is supplied", () => {
    const props: HeadProps = { title: "Hello | Smoke Test" };
    expect(render(<DocHead {...props} />)).toBe(
      [
        '<meta charset="utf-8"/>',
        '<meta name="viewport" content="width=device-width, initial-scale=1"/>',
        "<title>Hello | Smoke Test</title>",
        '<meta property="og:title" content="Hello | Smoke Test"/>',
      ].join(""),
    );
  });

  it("matches the doc-layout.astro emission for a typical doc page", () => {
    const props: HeadProps = {
      title: "Writing Docs | Smoke Test",
      description: "How to write docs.",
    };
    expect(render(<DocHead {...props} />)).toBe(
      [
        '<meta charset="utf-8"/>',
        '<meta name="viewport" content="width=device-width, initial-scale=1"/>',
        "<title>Writing Docs | Smoke Test</title>",
        '<meta name="description" content="How to write docs."/>',
        '<meta property="og:title" content="Writing Docs | Smoke Test"/>',
        '<meta property="og:description" content="How to write docs."/>',
      ].join(""),
    );
  });

  it("emits noindex,nofollow when settings.noindex is true", () => {
    const props: HeadProps = {
      title: "Internal | Smoke Test",
      noindex: true,
      // unlisted is ignored when noindex is set sitewide
      unlisted: true,
    };
    const out = render(<DocHead {...props} />);
    expect(out).toContain('<meta name="robots" content="noindex, nofollow"/>');
    // Page-level noindex must NOT also be emitted alongside the sitewide one.
    expect(out).not.toContain('<meta name="robots" content="noindex"/>');
  });

  it("emits noindex (page-level) when only unlisted is set", () => {
    const props: HeadProps = {
      title: "Hidden | Smoke Test",
      unlisted: true,
    };
    expect(render(<DocHead {...props} />)).toContain(
      '<meta name="robots" content="noindex"/>',
    );
  });

  it("omits robots meta entirely when neither noindex nor unlisted is set", () => {
    const props: HeadProps = { title: "Public | Smoke Test" };
    expect(render(<DocHead {...props} />)).not.toContain(
      'name="robots"',
    );
  });

  it("falls through og:title to title when ogTitle is unset", () => {
    const props: HeadProps = { title: "Hello | Smoke Test" };
    expect(render(<DocHead {...props} />)).toContain(
      '<meta property="og:title" content="Hello | Smoke Test"/>',
    );
  });

  it("uses ogTitle override when supplied", () => {
    const props: HeadProps = {
      title: "Hello | Smoke Test",
      ogTitle: "Custom OG Title",
    };
    expect(render(<DocHead {...props} />)).toContain(
      '<meta property="og:title" content="Custom OG Title"/>',
    );
  });

  it("emits canonical link only when canonical is supplied", () => {
    const out = render(
      <DocHead
        title="Hello | Smoke Test"
        canonical="https://example.com/docs/page-1/"
      />,
    );
    expect(out).toContain(
      '<link rel="canonical" href="https://example.com/docs/page-1/"/>',
    );
    expect(
      render(<DocHead title="Hello | Smoke Test" />),
    ).not.toContain('rel="canonical"');
  });

  it("emits theme-color only when supplied", () => {
    expect(
      render(<DocHead title="Hello | Smoke Test" themeColor="#ffffff" />),
    ).toContain('<meta name="theme-color" content="#ffffff"/>');
    expect(
      render(<DocHead title="Hello | Smoke Test" />),
    ).not.toContain('name="theme-color"');
  });

  it("emits a full og:* / twitter:* set when configured", () => {
    const out = render(
      <DocHead
        title="Hello | Smoke Test"
        description="Desc."
        ogType="article"
        ogUrl="https://example.com/x/"
        ogImage="https://example.com/x.png"
        ogSiteName="Smoke Test"
        twitterCard="summary_large_image"
        twitterSite="@example"
        twitterCreator="@author"
        twitterTitle="Hello"
        twitterDescription="Desc."
        twitterImage="https://example.com/x.png"
      />,
    );
    expect(out).toBe(
      [
        '<meta charset="utf-8"/>',
        '<meta name="viewport" content="width=device-width, initial-scale=1"/>',
        "<title>Hello | Smoke Test</title>",
        '<meta name="description" content="Desc."/>',
        '<meta property="og:title" content="Hello | Smoke Test"/>',
        '<meta property="og:description" content="Desc."/>',
        '<meta property="og:type" content="article"/>',
        '<meta property="og:url" content="https://example.com/x/"/>',
        '<meta property="og:image" content="https://example.com/x.png"/>',
        '<meta property="og:site_name" content="Smoke Test"/>',
        '<meta name="twitter:card" content="summary_large_image"/>',
        '<meta name="twitter:site" content="@example"/>',
        '<meta name="twitter:creator" content="@author"/>',
        '<meta name="twitter:title" content="Hello"/>',
        '<meta name="twitter:description" content="Desc."/>',
        '<meta name="twitter:image" content="https://example.com/x.png"/>',
      ].join(""),
    );
  });

  it("emits stylesheets in the supplied order (KaTeX-shaped fixture)", () => {
    const out = render(
      <DocHead
        title="Math | Smoke Test"
        stylesheets={[
          {
            href: "https://cdn.jsdelivr.net/npm/katex@0.16.38/dist/katex.min.css",
            integrity:
              "sha384-/L6i+LN3dyoaK2jYG5ZLh5u13cjdsPDcFOSNJeFBFa/KgVXR5kOfTdiN3ft1uMAq",
            crossorigin: "anonymous",
          },
        ]}
      />,
    );
    expect(out).toContain(
      '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.38/dist/katex.min.css" integrity="sha384-/L6i+LN3dyoaK2jYG5ZLh5u13cjdsPDcFOSNJeFBFa/KgVXR5kOfTdiN3ft1uMAq" crossorigin="anonymous"/>',
    );
  });

  it("emits alternate links in the supplied order (llms.txt-shaped fixture)", () => {
    const out = render(
      <DocHead
        title="Hello | Smoke Test"
        alternateLinks={[
          {
            rel: "alternate",
            type: "text/plain",
            href: "/llms.txt",
            title: "llms.txt",
          },
          {
            rel: "alternate",
            type: "text/plain",
            href: "/llms-full.txt",
            title: "llms-full.txt",
          },
        ]}
      />,
    );
    expect(out).toContain(
      '<link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt"/>',
    );
    expect(out).toContain(
      '<link rel="alternate" type="text/plain" href="/llms-full.txt" title="llms-full.txt"/>',
    );
    // Order-sensitive — llms.txt must come before llms-full.txt.
    const i1 = out.indexOf("/llms.txt");
    const i2 = out.indexOf("/llms-full.txt");
    expect(i1).toBeGreaterThan(0);
    expect(i2).toBeGreaterThan(i1);
  });

  it("emits preload hints when supplied", () => {
    const out = render(
      <DocHead
        title="Hello | Smoke Test"
        preload={[
          {
            href: "/fonts/foo.woff2",
            as: "font",
            type: "font/woff2",
            crossorigin: "anonymous",
          },
        ]}
      />,
    );
    expect(out).toContain(
      '<link rel="preload" as="font" href="/fonts/foo.woff2" type="font/woff2" crossorigin="anonymous"/>',
    );
  });

  it("matches the doc-layout.astro slot order: meta → title → desc → robots → canonical → theme-color → og → twitter → stylesheets → alternates → preload", () => {
    const out = render(
      <DocHead
        title="Hello | Smoke Test"
        description="Desc."
        unlisted
        canonical="https://example.com/x/"
        themeColor="#fff"
        twitterCard="summary"
        stylesheets={[{ href: "/k.css" }]}
        alternateLinks={[{ rel: "alternate", href: "/llms.txt" }]}
        preload={[{ href: "/x.woff2", as: "font" }]}
      />,
    );
    const order = [
      'charset="utf-8"',
      'name="viewport"',
      "<title>",
      'name="description"',
      'name="robots"',
      'rel="canonical"',
      'name="theme-color"',
      'property="og:title"',
      'name="twitter:card"',
      'rel="stylesheet"',
      'rel="alternate"',
      'rel="preload"',
    ];
    let last = -1;
    for (const marker of order) {
      const idx = out.indexOf(marker);
      expect(idx, `expected to find ${marker}`).toBeGreaterThan(last);
      last = idx;
    }
  });
});
