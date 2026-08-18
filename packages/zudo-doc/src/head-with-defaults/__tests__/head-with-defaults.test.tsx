/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// head-with-defaults unit tests — SiteHeadConfig extras emission.
//
// Mirrors the exact-string assertion style of src/head/__tests__/doc-head.test.tsx.
// Each test builds a ChromeContext via makeFakeChromeContext, constructs the
// HeadWithDefaults component, renders it with preact-render-to-string, and
// asserts the emitted HTML string.
//
// Key coverage:
//   - Each descriptor type (preconnect, preload, stylesheet, alternateLinks, meta)
//   - async:true stylesheet → literal `onload="this.media='all'"` + media="print" + <noscript>
//   - Absent settings.head → head-extras fragment not emitted (byte-parity baseline)

import { describe, it, expect } from "vitest";
import { render } from "preact-render-to-string";
import { createHeadWithDefaults } from "../index.js";
import { renderAutoLogoIconSvg } from "../../auto-logo/icon.js";
import { pickGlyphName } from "../../auto-logo/shapes.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";

describe("HeadWithDefaults — SiteHeadConfig head extras", () => {
  it("baseline: emits nothing extra when settings.head is absent", () => {
    const ctx = makeFakeChromeContext({});
    const HeadWithDefaults = createHeadWithDefaults(ctx);
    const out = render(<HeadWithDefaults title="Test" />);
    // Head extras specific to SiteHeadConfig should not appear.
    expect(out).not.toContain('rel="preconnect"');
    expect(out).not.toContain('rel="preload"');
    expect(out).not.toContain('rel="stylesheet"');
    expect(out).not.toContain("<noscript>");
  });

  it("preconnect: emits <link rel='preconnect'> with crossorigin", () => {
    const ctx = makeFakeChromeContext({
      settings: {
        head: {
          preconnect: [
            { href: "https://fonts.googleapis.com", crossorigin: "anonymous" },
          ],
        },
      },
    });
    const HeadWithDefaults = createHeadWithDefaults(ctx);
    const out = render(<HeadWithDefaults title="Test" />);
    expect(out).toContain(
      '<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin="anonymous"/>',
    );
  });

  it("preconnect: omits crossorigin when not supplied", () => {
    const ctx = makeFakeChromeContext({
      settings: {
        head: {
          preconnect: [{ href: "https://cdn.example.com" }],
        },
      },
    });
    const HeadWithDefaults = createHeadWithDefaults(ctx);
    const out = render(<HeadWithDefaults title="Test" />);
    expect(out).toContain('<link rel="preconnect" href="https://cdn.example.com"/>');
    expect(out).not.toContain("crossorigin");
  });

  it("preload: emits <link rel='preload'> with as, type, crossorigin", () => {
    const ctx = makeFakeChromeContext({
      settings: {
        head: {
          preload: [
            {
              href: "/fonts/myfont.woff2",
              as: "font",
              type: "font/woff2",
              crossorigin: "anonymous",
            },
          ],
        },
      },
    });
    const HeadWithDefaults = createHeadWithDefaults(ctx);
    const out = render(<HeadWithDefaults title="Test" />);
    expect(out).toContain(
      '<link rel="preload" as="font" href="/fonts/myfont.woff2" type="font/woff2" crossorigin="anonymous"/>',
    );
  });

  it("preload: omits optional fields when absent", () => {
    const ctx = makeFakeChromeContext({
      settings: {
        head: {
          preload: [{ href: "/img/hero.png", as: "image" }],
        },
      },
    });
    const HeadWithDefaults = createHeadWithDefaults(ctx);
    const out = render(<HeadWithDefaults title="Test" />);
    expect(out).toContain('<link rel="preload" as="image" href="/img/hero.png"/>');
  });

  it("stylesheet (plain): emits <link rel='stylesheet'> with media and crossorigin", () => {
    const ctx = makeFakeChromeContext({
      settings: {
        head: {
          stylesheets: [
            {
              href: "https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css",
              crossorigin: "anonymous",
              media: "print",
            },
          ],
        },
      },
    });
    const HeadWithDefaults = createHeadWithDefaults(ctx);
    const out = render(<HeadWithDefaults title="Test" />);
    expect(out).toContain(
      '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css" media="print" crossorigin="anonymous"/>',
    );
    // Plain stylesheet must NOT emit a noscript fallback.
    expect(out).not.toContain("<noscript>");
  });

  it("stylesheet (async:true): emits media='print' + literal onload + <noscript> fallback", () => {
    // This test pins the EXACT SSR string for the async stylesheet pattern.
    // preact-render-to-string emits string-valued on* props as literal HTML
    // attributes (only function-valued event handlers are stripped), so the
    // `onload` workaround (spreading { onload: "this.media='all'" } as any)
    // must produce a literal `onload="this.media='all'"` attribute.
    const ctx = makeFakeChromeContext({
      settings: {
        head: {
          stylesheets: [
            {
              href: "https://cdn.example.com/style.css",
              async: true,
            },
          ],
        },
      },
    });
    const HeadWithDefaults = createHeadWithDefaults(ctx);
    const out = render(<HeadWithDefaults title="Test" />);
    // The <link> must carry media="print" and the literal onload attribute.
    expect(out).toContain(
      '<link rel="stylesheet" href="https://cdn.example.com/style.css" media="print" onload="this.media=\'all\'"/>',
    );
    // The <noscript> fallback must follow with a plain (non-self-closing) inner link.
    expect(out).toContain(
      '<noscript><link rel="stylesheet" href="https://cdn.example.com/style.css"></noscript>',
    );
  });

  it("stylesheet (async:true) with crossorigin: crossorigin emitted on both link and noscript inner link", () => {
    const ctx = makeFakeChromeContext({
      settings: {
        head: {
          stylesheets: [
            {
              href: "https://cdn.example.com/style.css",
              crossorigin: "anonymous",
              async: true,
            },
          ],
        },
      },
    });
    const HeadWithDefaults = createHeadWithDefaults(ctx);
    const out = render(<HeadWithDefaults title="Test" />);
    expect(out).toContain(
      '<link rel="stylesheet" href="https://cdn.example.com/style.css" crossorigin="anonymous" media="print" onload="this.media=\'all\'"/>',
    );
    expect(out).toContain(
      '<noscript><link rel="stylesheet" href="https://cdn.example.com/style.css" crossorigin="anonymous"></noscript>',
    );
  });

  it("stylesheet (async:true) with media: onload swaps to the configured media and <noscript> carries it", () => {
    // Regression (review #2435): an async stylesheet that also sets `media`
    // must swap to THAT media on load (not unconditionally "all"), and the
    // <noscript> fallback must carry the configured media too.
    const ctx = makeFakeChromeContext({
      settings: {
        head: {
          stylesheets: [
            {
              href: "https://cdn.example.com/print.css",
              media: "print",
              async: true,
            },
          ],
        },
      },
    });
    const HeadWithDefaults = createHeadWithDefaults(ctx);
    const out = render(<HeadWithDefaults title="Test" />);
    // Initial media stays "print" (the non-render-blocking trick); onload swaps
    // to the configured media ("print"), NOT "all".
    expect(out).toContain(
      '<link rel="stylesheet" href="https://cdn.example.com/print.css" media="print" onload="this.media=\'print\'"/>',
    );
    // The <noscript> fallback must include the configured media.
    expect(out).toContain(
      '<noscript><link rel="stylesheet" href="https://cdn.example.com/print.css" media="print"></noscript>',
    );
  });

  it("alternateLinks: emits <link rel={rel} href> with optional type and title", () => {
    const ctx = makeFakeChromeContext({
      settings: {
        head: {
          alternateLinks: [
            {
              rel: "alternate",
              href: "/rss.xml",
              type: "application/rss+xml",
              title: "RSS Feed",
            },
          ],
        },
      },
    });
    const HeadWithDefaults = createHeadWithDefaults(ctx);
    const out = render(<HeadWithDefaults title="Test" />);
    expect(out).toContain(
      '<link rel="alternate" href="/rss.xml" type="application/rss+xml" title="RSS Feed"/>',
    );
  });

  it("meta: emits <meta name content>", () => {
    const ctx = makeFakeChromeContext({
      settings: {
        head: {
          meta: [{ name: "theme-color", content: "#ffffff" }],
        },
      },
    });
    const HeadWithDefaults = createHeadWithDefaults(ctx);
    const out = render(<HeadWithDefaults title="Test" />);
    expect(out).toContain('<meta name="theme-color" content="#ffffff"/>');
  });

  it("meta: emits <meta property content> (Open Graph style)", () => {
    const ctx = makeFakeChromeContext({
      settings: {
        head: {
          meta: [{ property: "og:locale:alternate", content: "ja_JP" }],
        },
      },
    });
    const HeadWithDefaults = createHeadWithDefaults(ctx);
    const out = render(<HeadWithDefaults title="Test" />);
    expect(out).toContain('<meta property="og:locale:alternate" content="ja_JP"/>');
  });

  it("emit order: preconnect → preload → stylesheets → alternateLinks → meta", () => {
    const ctx = makeFakeChromeContext({
      settings: {
        head: {
          preconnect: [{ href: "https://fonts.googleapis.com" }],
          preload: [{ href: "/fonts/f.woff2", as: "font" }],
          stylesheets: [{ href: "/extra.css" }],
          alternateLinks: [{ rel: "alternate", href: "/rss.xml" }],
          meta: [{ name: "theme-color", content: "#fff" }],
        },
      },
    });
    const HeadWithDefaults = createHeadWithDefaults(ctx);
    const out = render(<HeadWithDefaults title="Test" />);
    const markers = [
      'rel="preconnect"',
      'rel="preload"',
      'rel="stylesheet"',
      'rel="alternate"',
      'name="theme-color"',
    ];
    let last = -1;
    for (const marker of markers) {
      const idx = out.indexOf(marker);
      expect(idx, `expected to find ${marker} after position ${last}`).toBeGreaterThan(last);
      last = idx;
    }
  });

  it("multiple descriptors of the same type are emitted in order", () => {
    const ctx = makeFakeChromeContext({
      settings: {
        head: {
          preconnect: [
            { href: "https://first.example.com" },
            { href: "https://second.example.com" },
          ],
        },
      },
    });
    const HeadWithDefaults = createHeadWithDefaults(ctx);
    const out = render(<HeadWithDefaults title="Test" />);
    const i1 = out.indexOf("first.example.com");
    const i2 = out.indexOf("second.example.com");
    expect(i1).toBeGreaterThan(0);
    expect(i2).toBeGreaterThan(i1);
  });
});

describe("HeadWithDefaults — favicon set", () => {
  it("emits all four favicon links, svg first, with root-base hrefs", () => {
    const ctx = makeFakeChromeContext({});
    const HeadWithDefaults = createHeadWithDefaults(ctx);
    const out = render(<HeadWithDefaults title="Test" />);
    expect(out).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg"/>');
    expect(out).toContain('<link rel="icon" href="/favicon.ico" sizes="any"/>');
    expect(out).toContain(
      '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png"/>',
    );
    expect(out).toContain(
      '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png"/>',
    );
    // svg entry must be first in the favicon set.
    const svgIdx = out.indexOf('type="image/svg+xml"');
    const icoIdx = out.indexOf('href="/favicon.ico"');
    const png32Idx = out.indexOf('href="/favicon-32x32.png"');
    const png16Idx = out.indexOf('href="/favicon-16x16.png"');
    expect(svgIdx).toBeGreaterThan(-1);
    expect(icoIdx).toBeGreaterThan(svgIdx);
    expect(png32Idx).toBeGreaterThan(icoIdx);
    expect(png16Idx).toBeGreaterThan(png32Idx);
  });

  it("prefixes every favicon href with a non-root base", () => {
    const ctx = makeFakeChromeContext({
      overrides: {
        withBase: (p: string) => `/sub${p}`,
      },
    });
    const HeadWithDefaults = createHeadWithDefaults(ctx);
    const out = render(<HeadWithDefaults title="Test" />);
    expect(out).toContain('<link rel="icon" type="image/svg+xml" href="/sub/favicon.svg"/>');
    expect(out).toContain('<link rel="icon" href="/sub/favicon.ico" sizes="any"/>');
    expect(out).toContain(
      '<link rel="icon" type="image/png" sizes="32x32" href="/sub/favicon-32x32.png"/>',
    );
    expect(out).toContain(
      '<link rel="icon" type="image/png" sizes="16x16" href="/sub/favicon-16x16.png"/>',
    );
  });
});

// ── settings.favicon (#3460) ────────────────────────────────────────────────
// The two tests above pin the OMITTED-DEFAULT path and must stay unchanged —
// they are the byte-identity baseline every case below is measured against.

describe("HeadWithDefaults — settings.favicon", () => {
  /** The emitted `<link rel="icon">` tags, so assertions can't be satisfied
   *  (or broken) by unrelated head markup. */
  function iconLinks(html: string): string[] {
    return html.match(/<link rel="icon"[^>]*\/>/g) ?? [];
  }

  // The equivalence #3461 leans on: the showcase can adopt the explicit object
  // form without moving the A2 parity hashes.
  it("object form spelling out all four slots is byte-identical to the omitted default", () => {
    const Default = createHeadWithDefaults(makeFakeChromeContext({}));
    const Explicit = createHeadWithDefaults(
      makeFakeChromeContext({
        settings: {
          favicon: {
            svg: "/favicon.svg",
            ico: "/favicon.ico",
            png32: "/favicon-32x32.png",
            png16: "/favicon-16x16.png",
          },
        },
      }),
    );
    const renderedDefault = render(<Default title="Test" />);
    expect(renderedDefault).toContain('href="/favicon.svg"'); // guard: not vacuously equal
    expect(render(<Explicit title="Test" />)).toBe(renderedDefault);
  });

  it("object subset emits only the supplied slots, keeping slot order", () => {
    const ctx = makeFakeChromeContext({
      settings: { favicon: { png32: "/icon-32.png", svg: "/icon.svg" } },
    });
    const HeadWithDefaults = createHeadWithDefaults(ctx);
    // Only the two supplied slots, in the declared order (not the object's own
    // key order) — and no `ico` link, which is the #3440 404 fix.
    expect(iconLinks(render(<HeadWithDefaults title="Test" />))).toEqual([
      '<link rel="icon" type="image/svg+xml" href="/icon.svg"/>',
      '<link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png"/>',
    ]);
  });

  it.each([
    ["false", false],
    ["{}", {}],
  ])("%s emits no favicon links at all", (_label, favicon) => {
    const HeadWithDefaults = createHeadWithDefaults(
      makeFakeChromeContext({ settings: { favicon } }),
    );
    const out = render(<HeadWithDefaults title="Test" />);
    expect(iconLinks(out)).toEqual([]);
    expect(out).not.toContain('rel="icon"');
  });

  it("string form emits one link with the extension-inferred type, base-prefixed", () => {
    const ctx = makeFakeChromeContext({
      settings: { favicon: "/assets/my-icon.png" },
      overrides: { withBase: (p: string) => `/sub${p}` },
    });
    const HeadWithDefaults = createHeadWithDefaults(ctx);
    // One link, no `sizes`, and none of the default four survives.
    expect(iconLinks(render(<HeadWithDefaults title="Test" />))).toEqual([
      '<link rel="icon" type="image/png" href="/sub/assets/my-icon.png"/>',
    ]);
  });

  it("string form omits type for an unknown extension", () => {
    const HeadWithDefaults = createHeadWithDefaults(
      makeFakeChromeContext({ settings: { favicon: "/icon.bmpx" } }),
    );
    expect(iconLinks(render(<HeadWithDefaults title="Test" />))).toEqual([
      '<link rel="icon" href="/icon.bmpx"/>',
    ]);
  });

  it("string form ignores a query/hash suffix when inferring type", () => {
    const HeadWithDefaults = createHeadWithDefaults(
      makeFakeChromeContext({ settings: { favicon: "/icon.svg?v=2" } }),
    );
    expect(iconLinks(render(<HeadWithDefaults title="Test" />))).toEqual([
      '<link rel="icon" type="image/svg+xml" href="/icon.svg?v=2"/>',
    ]);
  });

  it("absolute-URL string is emitted verbatim (no withBase prefix)", () => {
    const HeadWithDefaults = createHeadWithDefaults(
      makeFakeChromeContext({
        settings: { favicon: "https://cdn.example.com/icon.png" },
        overrides: { withBase: (p: string) => `/sub${p}` },
      }),
    );
    expect(iconLinks(render(<HeadWithDefaults title="Test" />))).toEqual([
      '<link rel="icon" type="image/png" href="https://cdn.example.com/icon.png"/>',
    ]);
  });

  it('"auto" emits one deterministic SVG data-URL link seeded by siteName', () => {
    function faviconHrefOf(siteName: string, withBase?: (p: string) => string): string {
      const Head = createHeadWithDefaults(
        makeFakeChromeContext({
          settings: { favicon: "auto", siteName },
          ...(withBase ? { overrides: { withBase } } : {}),
        }),
      );
      const out = render(<Head title="Test" />);
      const links = iconLinks(out);
      expect(links, `expected exactly one favicon link, got: ${out}`).toHaveLength(1);
      const m = links[0]!.match(
        /^<link rel="icon" type="image\/svg\+xml" href="(data:image\/svg\+xml,[^"]*)"\/>$/,
      );
      expect(m, `expected an SVG data-URL favicon link, got: ${links[0]}`).not.toBeNull();
      return m![1]!;
    }

    // A non-root base must NOT prefix a data: URL, and the payload is exactly
    // the auto-logo icon for that seed — the same seed rule as `logo: "auto"`.
    const href = faviconHrefOf("Test Site", (p: string) => `/sub${p}`);
    expect(href).toBe(
      `data:image/svg+xml,${encodeURIComponent(renderAutoLogoIconSvg("Test Site"))}`,
    );

    // Deterministic for one seed, and seed-sensitive across two. The pair is
    // chosen so the two seeds select different glyphs (the only thing that
    // varies per seed) — re-pick it if GLYPH_NAMES ever changes length.
    expect(faviconHrefOf("Test Site")).toBe(faviconHrefOf("Test Site"));
    expect(pickGlyphName("Test Site")).not.toBe(pickGlyphName("Another Site"));
    expect(faviconHrefOf("Test Site")).not.toBe(faviconHrefOf("Another Site"));
  });
});
