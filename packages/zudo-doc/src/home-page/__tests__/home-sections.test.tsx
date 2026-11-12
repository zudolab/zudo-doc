/** @jsxRuntime automatic */
/**
 * `home.sections` composition: the optional recipe replaces the legacy
 * sitemap block with independent section headings, ONE canonical site tree
 * and optional selected-document cards, in the configured order.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderSsr as render } from "../../__tests__/helpers/zudo-react.js";
import type { Child } from "@takazudo/zfb/zudo-react";
import { createHomePageView } from "../index.js";
import type { HomePageViewProps } from "../index.js";
import type { DocNavNode } from "../../doc-page-props/index.js";
import type { ChromeContext } from "../../factory-context/index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";
import type { PreparedHomeIntro } from "../../home-intro/types.js";
import type { HomeSection } from "../../settings.js";

const { layoutProps, headProps, islandProps, introProps } = vi.hoisted(() => ({
  layoutProps: [] as Array<Record<string, unknown>>,
  headProps: [] as Array<Record<string, unknown>>,
  islandProps: [] as Array<Record<string, unknown>>,
  introProps: [] as Array<Record<string, unknown>>,
}));

// Isolate the home body factory from shared shell rendering (#4458), scanner-
// assigned island identity, and the concurrently ported HomeIntro/CompactProse
// body (#4457). These tests pin the props crossing those owned seams.
vi.mock("../../doclayout/index.js", () => ({
  DocLayoutWithDefaults: (props: Record<string, unknown>) => {
    layoutProps.push(props);
    return [props.head as Child, props.children as Child];
  },
}));
vi.mock("../../head-with-defaults/index.js", () => ({
  createHeadWithDefaults: () => (props: Record<string, unknown>) => {
    headProps.push(props);
    return null;
  },
}));
vi.mock("../../auto-logo/index.js", () => ({
  AutoLogo: ({ class: className, seed }: { class?: string; seed: string }) => (
    <svg class={className} data-auto-logo={seed} aria-hidden="true" />
  ),
}));
vi.mock("@takazudo/zfb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@takazudo/zfb")>();
  return {
    ...actual,
    Island: (props: Record<string, unknown>) => {
      islandProps.push(props);
      return <div data-zd-test-home-island data-when={props.when as string} />;
    },
  };
});
vi.mock("../../home-intro/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../home-intro/index.js")>();
  const { renderPreparedIntro } = await import("./render-prepared-intro.js");
  return {
    ...actual,
    CompactProse: (props: Record<string, unknown>) => {
      introProps.push(props);
      const intro = props.intro as PreparedHomeIntro | null | undefined;
      return intro?.nodes.length ? (
        <div class="zd-content zd-compact-prose" data-zd-test-home-intro>{renderPreparedIntro(intro)}</div>
      ) : null;
    },
  };
});

beforeEach(() => {
  layoutProps.length = 0;
  headProps.length = 0;
  islandProps.length = 0;
  introProps.length = 0;
});

function latestLayout(): Record<string, unknown> {
  return layoutProps.at(-1) ?? {};
}

function latestHead(): Record<string, unknown> {
  return headProps.at(-1) ?? {};
}

function latestIslandProps(): Record<string, unknown> {
  return islandProps.at(-1) ?? {};
}

function latestSiteTreeProps(): Record<string, unknown> {
  return ((latestIslandProps().children as { props?: Record<string, unknown> } | undefined)?.props ?? {});
}

const TREE: DocNavNode[] = [
  {
    slug: "guides",
    label: "Guides",
    description: "How-to guides.",
    position: 0,
    href: "/en/docs/guides",
    hasPage: true,
    children: [
      { slug: "guides/setup", label: "Setup", position: 0, href: "/en/docs/guides/setup", hasPage: true, children: [] },
    ],
  },
];

const DOCS = [
  { slug: "guides/setup", data: { title: "Setup guide", description: "Install and configure." } },
  { slug: "guides/deploy", data: { title: "Deploy", slug: "guides/deploy" } },
  { slug: "reference/index", data: { title: "Reference", slug: "reference", category_no_page: true } },
];

function makeView(sections: readonly HomeSection[] | undefined, settings: Record<string, unknown> = {}) {
  const ctx = makeFakeChromeContext({
    settings: { home: { wide: false, introMarkdown: "", sitemapHeading: "", ...(sections ? { sections } : {}) }, ...settings },
  });
  (ctx as { resolveNavSource: unknown }).resolveNavSource = () => ({ navDocs: DOCS, categoryMeta: new Map() });
  return createHomePageView(ctx);
}

function props(locale = "en"): HomePageViewProps {
  return { locale, tree: TREE, categoryOrder: [], tagCount: 0 };
}

const CARDS: HomeSection = { type: "doc-cards", docs: ["guides/deploy", "guides/setup", "guides/setup"] };
const TREE_SECTION: HomeSection = { type: "site-tree", variant: "described" };

describe("home.sections", () => {
  it("keeps the legacy sitemap block when sections is omitted", () => {
    const HomePageView = makeView(undefined);
    const html = render(<HomePageView {...props()} />);
    expect(html).toContain('data-home-rule="lower"');
    expect(html).toContain("zd-home-heading");
    expect(html).not.toContain("data-zd-home-sections");
    expect(islandProps).toHaveLength(1);
    expect(latestSiteTreeProps().variant).toBeUndefined();
  });

  it("renders cards before the tree in configured order, with exactly one tree and no legacy rule", () => {
    const HomePageView = makeView([CARDS, TREE_SECTION]);
    const html = render(<HomePageView {...props()} />);
    expect(html).not.toContain('data-home-rule="lower"');
    expect(html.indexOf('data-zd-home-section="doc-cards"')).toBeLessThan(
      html.indexOf('data-zd-home-section="site-tree"'),
    );
    expect(islandProps).toHaveLength(1);
    expect(islandProps[0]!.when).toBe("idle");
    expect(latestSiteTreeProps().variant).toBe("described");
    expect(latestSiteTreeProps().countLabels).toEqual({
      one: "siteTreeNav.documentCount.one",
      other: "siteTreeNav.documentCount.other",
    });
    // Request order + first-occurrence dedupe; title/description from the canonical doc.
    expect(html.indexOf("Deploy")).toBeLessThan(html.indexOf("Setup guide"));
    expect(html.match(/href="\/en\/docs\/guides\/setup"/g)).toHaveLength(1);
    expect(html).toContain("Install and configure.");
    expect(html).toContain('data-layout="auto"');
    // Section headings are the shared HeadingH2 rule, not the borderless home heading.
    expect(html).toContain('data-zd-section-heading=""');
    expect(html).toContain("border-t-[3px]");
    // Omitted headings use the translated fallbacks (the fake `t` echoes keys).
    expect(html).toContain(">home.selectedDocsHeading</h2>");
    expect(html).toContain(">home.sitemapHeading</h2>");
  });

  it("reverses the order when the tree comes first", () => {
    const HomePageView = makeView([TREE_SECTION, CARDS]);
    const html = render(<HomePageView {...props()} />);
    expect(html.indexOf('data-zd-home-section="site-tree"')).toBeLessThan(
      html.indexOf('data-zd-home-section="doc-cards"'),
    );
    expect(islandProps).toHaveLength(1);
  });

  it("omits the cards section and heading when no reference resolves, and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const HomePageView = makeView([{ type: "doc-cards", heading: "Picks", docs: ["missing/page", "reference"] }, TREE_SECTION]);
    const html = render(<HomePageView {...props()} />);
    expect(html).not.toContain('data-zd-home-section="doc-cards"');
    expect(html).not.toContain("Picks");
    expect(warn.mock.calls.map((c) => String(c[0]))).toEqual([
      expect.stringContaining('"missing/page" does not match a published document'),
      expect.stringContaining('"reference" is a category without a page'),
    ]);
    warn.mockRestore();
  });

  it("uses custom, per-locale and translated headings and descriptions", () => {
    const HomePageView = makeView([
      { type: "doc-cards", heading: "Picks", description: "Hand-picked.", docs: ["guides/setup"], locales: { ja: { heading: "おすすめ" } } },
      { type: "site-tree", heading: "  " },
    ]);
    const en = render(<HomePageView {...props("en")} />);
    expect(en).toContain(">Picks</h2>");
    expect(en).toContain('<p class="text-muted">Hand-picked.</p>');
    // Blank heading falls back to the sitemap heading chain.
    expect(en).toContain(">home.sitemapHeading</h2>");
    expect(latestSiteTreeProps().variant).toBeUndefined();
    const ja = render(<HomePageView {...props("ja")} />);
    expect(ja).toContain(">おすすめ</h2>");
    expect(ja).toContain('<p class="text-muted">Hand-picked.</p>');
  });

  it("falls back to the entry's own text when a locale override is blank", () => {
    const HomePageView = makeView([
      { type: "doc-cards", heading: "Picks", docs: ["guides/setup"], locales: { ja: { heading: " " } } },
      { type: "site-tree" },
    ]);
    expect(render(<HomePageView {...props("ja")} />)).toContain(">Picks</h2>");
  });

  it("caps a single-category tree at 80rem and leaves a multi-category tree on the full band", () => {
    const Single = makeView([TREE_SECTION]);
    const single = render(<Single {...props()} />);
    expect(single).toMatch(/data-zd-home-section="site-tree"[^>]*class="[^"]*max-w-\[80rem\]/);
    const HomePageView = makeView([TREE_SECTION]);
    const multi = render(
      <HomePageView {...props()} tree={[...TREE, { ...TREE[0]!, slug: "other", label: "Other" }]} />,
    );
    expect(multi).not.toMatch(/data-zd-home-section="site-tree"[^>]*max-w-\[80rem\]/);
  });

  it("keeps tags and secondary links with the composed tree", () => {
    const HomePageView = makeView([TREE_SECTION], {
      docTags: true,
      siteTreeNavSecondary: ["guides"],
    });
    const html = render(
      <HomePageView {...props()} tagCount={1} tags={[{ tag: "a", count: 1, href: "/docs/tags/a" }]} />,
    );
    const section = html.slice(html.indexOf('data-zd-home-section="site-tree"'));
    expect(section).toContain("data-home-secondary-nav");
    expect(html).toContain("data-zd-home-tags");
    expect(latestSiteTreeProps().categoryIgnore).toContain("guides");
  });
});
