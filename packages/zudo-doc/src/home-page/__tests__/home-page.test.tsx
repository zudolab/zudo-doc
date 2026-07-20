/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * Unit tests for `createHomePageView` (epic #2499, S3 #2502).
 *
 * Covers:
 *  1. Hero markup: logo mask block, `<h1>` siteName, description, overview
 *     link, and the GitHub link rendering the RICHER showcase SVG icon
 *     (instead of the old package plain-text link).
 *  2. `SiteTreeNav` still renders through the real `Island(when: "idle")`
 *     wrapper — same marker as before the extraction.
 *  3. `docTags` + `tagCount` gates the "all tags" section, same as before.
 *  4. The `homeExtras` seam: `extras` prop wins over
 *     `ctx.hostBindings.homeExtras`; the renderer receives `{ locale }`; the
 *     resolved result renders inside the hero text column, after the links
 *     row `<div>`.
 *  5. Locale-URL prefixing (default locale vs. non-default) for the overview
 *     link, header `currentPath`, and the "all tags" link — mirrors what
 *     `routes/index.tsx` / `routes/locale-index.tsx` computed inline before
 *     this extraction.
 */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { createHomePageView } from "../index.js";
import type { HomePageViewProps } from "../index.js";
import type { DocNavNode } from "../../doc-page-props/index.js";
import type { ChromeContext } from "../../factory-context/index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";

const EMPTY_TREE: DocNavNode[] = [];
const CHANGELOG_TREE: DocNavNode[] = [
  {
    slug: "changelog",
    label: "Release notes",
    position: 0,
    href: "/docs/changelog",
    hasPage: true,
    children: [
      {
        slug: "changelog/1.0.0",
        label: "1.0.0",
        position: 0,
        href: "/docs/changelog/1.0.0",
        hasPage: true,
        children: [],
      },
    ],
  },
];

function makeProps(overrides: Partial<HomePageViewProps> = {}): HomePageViewProps {
  return {
    locale: "en",
    tree: EMPTY_TREE,
    categoryOrder: [],
    tagCount: 0,
    ...overrides,
  };
}

describe("createHomePageView — hero markup", () => {
  it("renders the logo mask block, <h1> siteName, and description", () => {
    const ctx = makeFakeChromeContext({
      settings: { siteName: "Test Site", siteDescription: "A test description" },
    });
    const HomePageView = createHomePageView(ctx);
    const html = render(<HomePageView {...makeProps()} />);

    expect(html).toContain('<h1 class="text-heading font-bold mb-vsp-2xs">Test Site</h1>');
    expect(html).toContain(
      '<p class="text-muted text-small mb-vsp-sm">A test description</p>',
    );
    // Logo mask block: theme-adaptive <div> with a CSS mask, not an <img>.
    expect(html).toContain("aspect-[1200/630] bg-fg");
    expect(html).toContain("url(/img/logo.svg)");
  });

  it("renders the overview link from settings.headerNav[0] when present", () => {
    const ctx = makeFakeChromeContext({
      settings: { headerNav: [{ path: "/docs/getting-started", label: "Docs" }] },
    });
    const HomePageView = createHomePageView(ctx);
    const html = render(<HomePageView {...makeProps()} />);

    expect(html).toContain('href="/docs/getting-started"');
    expect(html).toContain("nav.overview");
  });

  it("omits the overview link when headerNav is empty", () => {
    const ctx = makeFakeChromeContext({ settings: { headerNav: [] } });
    const HomePageView = createHomePageView(ctx);
    const html = render(<HomePageView {...makeProps()} />);

    expect(html).not.toContain("nav.overview");
  });

  it("richer GitHub link: renders the inline SVG icon (not the old plain-text link)", () => {
    const ctx = makeFakeChromeContext({
      settings: { githubUrl: "https://github.com/example/example" },
    });
    const HomePageView = createHomePageView(ctx);
    const html = render(<HomePageView {...makeProps()} />);

    expect(html).toContain('href="https://github.com/example/example"');
    expect(html).toContain("<svg");
    // The exact showcase path data (pages/index.tsx) — proves this is the
    // copied showcase icon, not a different mark.
    expect(html).toContain("M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59");
    expect(html).toContain(">GitHub</a>");
  });

  it("omits the GitHub link entirely when githubUrl is false", () => {
    const ctx = makeFakeChromeContext({ settings: { githubUrl: false } });
    const HomePageView = createHomePageView(ctx);
    const html = render(<HomePageView {...makeProps()} />);

    expect(html).not.toContain("M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59");
    expect(html).not.toContain(">GitHub</a>");
  });
});

describe("createHomePageView — SiteTreeNav island", () => {
  it("uses the narrow content band when wide is omitted", () => {
    const HomePageView = createHomePageView(makeFakeChromeContext());
    const html = render(<HomePageView {...makeProps()} />);

    expect(html).toContain("data-zd-nosidebar");
    expect(html).not.toContain("data-zd-wide");
  });

  it("uses the wide content band when wide is true", () => {
    const HomePageView = createHomePageView(makeFakeChromeContext());
    const html = render(<HomePageView {...makeProps({ wide: true })} />);

    expect(html).toContain("data-zd-wide");
  });

  it("wraps SiteTreeNav in the real Island(when: idle) — same marker as before extraction", () => {
    const ctx = makeFakeChromeContext();
    const HomePageView = createHomePageView(ctx);
    const html = render(<HomePageView {...makeProps()} />);

    expect(html).toContain('data-zfb-island="SiteTreeNav"');
  });

  it("forwards the explicit initial-collapse slugs to SiteTreeNav", () => {
    const ctx = makeFakeChromeContext();
    const HomePageView = createHomePageView(ctx);
    const html = render(
      <HomePageView
        {...makeProps({
          tree: CHANGELOG_TREE,
          initiallyCollapsedCategorySlugs: ["changelog"],
        })}
      />,
    );

    expect(html).toContain('aria-expanded="false" aria-label="Expand Release notes"');
    expect(html).not.toContain('href="/docs/changelog/1.0.0"');
  });

  it("keeps the existing expanded default when no initial-collapse slugs are provided", () => {
    const ctx = makeFakeChromeContext();
    const HomePageView = createHomePageView(ctx);
    const html = render(<HomePageView {...makeProps({ tree: CHANGELOG_TREE })} />);

    expect(html).toContain('aria-expanded="true" aria-label="Collapse Release notes"');
    expect(html).toContain('href="/docs/changelog/1.0.0"');
  });
});

describe("createHomePageView — docTags gating", () => {
  it("renders the all-tags section when docTags is on and tagCount > 0", () => {
    const ctx = makeFakeChromeContext({ settings: { docTags: true } });
    const HomePageView = createHomePageView(ctx);
    const html = render(<HomePageView {...makeProps({ tagCount: 3 })} />);

    expect(html).toContain("doc.allTags");
  });

  it("omits the all-tags section when tagCount is 0", () => {
    const ctx = makeFakeChromeContext({ settings: { docTags: true } });
    const HomePageView = createHomePageView(ctx);
    const html = render(<HomePageView {...makeProps({ tagCount: 0 })} />);

    expect(html).not.toContain("doc.allTags");
  });

  it("omits the all-tags section when docTags is off, even with tagCount > 0", () => {
    const ctx = makeFakeChromeContext({ settings: { docTags: false } });
    const HomePageView = createHomePageView(ctx);
    const html = render(<HomePageView {...makeProps({ tagCount: 3 })} />);

    expect(html).not.toContain("doc.allTags");
  });
});

describe("createHomePageView — locale-URL prefixing", () => {
  it("default locale: overview / tags links have no locale prefix", () => {
    const ctx = makeFakeChromeContext({
      settings: {
        defaultLocale: "en",
        headerNav: [{ path: "/docs/getting-started", label: "Docs" }],
        docTags: true,
      },
      overrides: { defaultLocale: "en" } as Partial<ChromeContext>,
    });
    const HomePageView = createHomePageView(ctx);
    const html = render(<HomePageView {...makeProps({ locale: "en", tagCount: 1 })} />);

    expect(html).toContain('href="/docs/getting-started"');
    expect(html).toContain('href="/docs/tags"');
  });

  it("non-default locale: overview / tags links carry the /{locale} prefix", () => {
    const ctx = makeFakeChromeContext({
      settings: {
        defaultLocale: "en",
        headerNav: [{ path: "/docs/getting-started", label: "Docs" }],
        docTags: true,
      },
      overrides: { defaultLocale: "en" } as Partial<ChromeContext>,
    });
    const HomePageView = createHomePageView(ctx);
    const html = render(<HomePageView {...makeProps({ locale: "ja", tagCount: 1 })} />);

    expect(html).toContain('href="/ja/docs/getting-started"');
    expect(html).toContain('href="/ja/docs/tags"');
  });
});

describe("createHomePageView — homeExtras seam", () => {
  it("neither extras prop nor hostBindings.homeExtras set: renders nothing extra", () => {
    const ctx = makeFakeChromeContext({ overrides: { hostBindings: {} } as Partial<ChromeContext> });
    const HomePageView = createHomePageView(ctx);
    const html = render(<HomePageView {...makeProps()} />);

    expect(html).not.toContain("HOME-EXTRA");
  });

  it("hostBindings.homeExtras renderer: renders INLINE at the end of the links row, `/`-separated, receives { locale }", () => {
    const calls: unknown[] = [];
    const ctx = makeFakeChromeContext({
      settings: {
        headerNav: [{ path: "/docs/getting-started", label: "Docs" }],
        githubUrl: "https://github.com/example/example",
      },
      overrides: {
        hostBindings: {
          homeExtras: (args) => {
            calls.push(args);
            return <div class="home-extra">HOME-EXTRA-FROM-BINDING</div>;
          },
        },
      } as Partial<ChromeContext>,
    });
    const HomePageView = createHomePageView(ctx);
    const html = render(<HomePageView {...makeProps({ locale: "ja" })} />);

    expect(calls).toEqual([{ locale: "ja" }]);

    // Inline within the links row: right after the GitHub link, a single "/"
    // separator (a preceding row item exists) immediately followed by the
    // extra markup, then the row's own closing </div> — i.e. a row
    // continuation, not a standalone line after the row.
    expect(html).toContain(
      '>GitHub</a><span class="text-muted">/</span><div class="home-extra">HOME-EXTRA-FROM-BINDING</div></div>',
    );
  });

  it("heroLink override: resolves href with locale prefix and label from labelKey (default locale)", () => {
    const ctx = makeFakeChromeContext({
      settings: { defaultLocale: "en", headerNav: [{ path: "/docs/getting-started", label: "Docs" }] },
      overrides: { defaultLocale: "en" } as Partial<ChromeContext>,
    });
    const HomePageView = createHomePageView(ctx);
    const html = render(
      <HomePageView
        {...makeProps({
          locale: "en",
          heroLink: { path: "/docs/getting-started/introduction/", labelKey: "nav.introduction" },
        })}
      />,
    );

    expect(html).toContain('href="/docs/getting-started/introduction/"');
    expect(html).toContain(">nav.introduction<");
    expect(html).not.toContain(">nav.overview<");
  });

  it("heroLink override: resolves href with locale prefix and label from labelKey (non-default locale)", () => {
    const ctx = makeFakeChromeContext({
      settings: { defaultLocale: "en", headerNav: [{ path: "/docs/getting-started", label: "Docs" }] },
      overrides: { defaultLocale: "en" } as Partial<ChromeContext>,
    });
    const HomePageView = createHomePageView(ctx);
    const html = render(
      <HomePageView
        {...makeProps({
          locale: "ja",
          heroLink: { path: "/docs/getting-started/introduction/", labelKey: "nav.introduction" },
        })}
      />,
    );

    expect(html).toContain('href="/ja/docs/getting-started/introduction/"');
    expect(html).toContain(">nav.introduction<");
  });

  it("minimal config: no headerNav item, no githubUrl — extras render with NO leading separator", () => {
    const ctx = makeFakeChromeContext({
      settings: { headerNav: [], githubUrl: false },
    });
    const HomePageView = createHomePageView(ctx);
    const html = render(
      <HomePageView {...makeProps()} extras={<div class="home-extra">ONLY-EXTRA</div>} />,
    );

    expect(html).toContain('<div class="home-extra">ONLY-EXTRA</div>');
    expect(html).not.toContain('<span class="text-muted">/</span>');
  });

  it("extras prop takes precedence over ctx.hostBindings.homeExtras", () => {
    const bindingCalls: unknown[] = [];
    const ctx = makeFakeChromeContext({
      overrides: {
        hostBindings: {
          homeExtras: (args) => {
            bindingCalls.push(args);
            return <div class="home-extra">FROM-BINDING</div>;
          },
        },
      } as Partial<ChromeContext>,
    });
    const HomePageView = createHomePageView(ctx);
    const html = render(
      <HomePageView {...makeProps()} extras={<div class="home-extra">FROM-PROP</div>} />,
    );

    expect(html).toContain("FROM-PROP");
    expect(html).not.toContain("FROM-BINDING");
    // The renderer must not even be called when the value prop is supplied —
    // `extras ?? hostBindings.homeExtras?.(...)` short-circuits before the call.
    expect(bindingCalls).toEqual([]);
  });
});
