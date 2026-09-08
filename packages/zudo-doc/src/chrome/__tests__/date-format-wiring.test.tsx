/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * The settings -> props wiring seam for `dateFormat` (#4075).
 *
 * `dateFormat` is per-role AND per-locale, and islands have no ambient access
 * to settings: `virtual:zudo-doc-route-context` is an SSR-only build artifact.
 * The only channel is zfb's `<Island>` boundary, whose
 * `captureSerializableProps` JSON-stringifies the wrapper's props into
 * `data-props`. So the contract these tests pin is:
 *
 *   1. every wiring point resolves the setting for the RENDER locale at SSR
 *      and passes the resulting roles object down as `dateFormats`;
 *   2. that object reaches each island's serialized `data-props` (asserted
 *      against SSR HTML, where the JSON's quotes are `&quot;` entities);
 *   3. every new prop / deps field is OPTIONAL and absent-safe, so a host that
 *      hand-constructs props or deps keeps compiling and does not throw.
 *
 * Nothing here asserts rendered dates: at this point in the epic no consumer
 * reads `dateFormats` yet, and the default setting resolves every role to
 * `"locale"` — i.e. today's output.
 */

import { describe, expect, it } from "vitest";
import type { VNode } from "preact";
import { render } from "preact-render-to-string";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";
import { deriveDateFormats } from "../derive.js";
import { createDocHistoryArea } from "../../doc-history-area/index.js";
import { createHeaderWithDefaults } from "../../header-with-defaults/index.js";
import { createSidebarWithDefaults } from "../../sidebar-with-defaults/index.js";
import { createSiteTreeNavWrapper } from "../../site-tree-nav/index.js";
import type { SiteTreeNavDeps } from "../../site-tree-nav/index.js";
import { createNoteTrayIndexWrapper } from "../../note-tray-index/index.js";
import type { NoteTrayIndexDeps } from "../../note-tray-index/index.js";
import { SidebarTree } from "../../sidebar-tree-island/index.js";
import { SidebarToggle } from "../../sidebar-toggle-island/index.js";
import { SiteTreeNav } from "../../site-tree-nav-island/index.js";
import { NoteTrayIndex } from "../../nav-indexing/index.js";
import type { SidebarNavNode } from "../../sidebar/types.js";

/** The default `dateFormat` (absent) resolves every role to `"locale"`. */
const ALL_LOCALE = {
  full: "locale",
  monthDay: "locale",
  year: "locale",
  yearMonth: "locale",
  numericMonthDay: "locale",
};

/**
 * A per-locale setting: the two locales must resolve differently, so a test
 * that asserts JA output cannot pass by accidentally resolving EN.
 */
const PER_LOCALE_SETTING = {
  full: "MMM D, YYYY",
  yearMonth: "MMMM YYYY",
  locales: { ja: { full: "YYYY年M月D日", numericMonthDay: "M/D" } },
};

/** SSR HTML-escapes the `data-props` JSON, so match the entity form. */
function serializedProp(key: string, value: string): string {
  return `&quot;${key}&quot;:&quot;${value}&quot;`;
}

function makeNode(slug: string): SidebarNavNode {
  return { slug, label: slug, position: 0, hasPage: true, href: `/docs/${slug}`, children: [] };
}

// ---------------------------------------------------------------------------
// deriveDateFormats — the one settings -> roles seam
// ---------------------------------------------------------------------------

describe("deriveDateFormats", () => {
  it("resolves every role to \"locale\" when the setting is absent (today's behaviour)", () => {
    const dateFormatsFor = deriveDateFormats(makeFakeChromeContext());
    expect(dateFormatsFor("en")).toEqual(ALL_LOCALE);
  });

  it("layers per-locale overrides over the top-level roles, per locale", () => {
    const ctx = makeFakeChromeContext({ settings: { dateFormat: PER_LOCALE_SETTING } });
    const dateFormatsFor = deriveDateFormats(ctx);

    expect(dateFormatsFor("en")).toEqual({
      full: "MMM D, YYYY",
      monthDay: "locale",
      year: "locale",
      yearMonth: "MMMM YYYY",
      numericMonthDay: "locale",
    });
    expect(dateFormatsFor("ja")).toEqual({
      full: "YYYY年M月D日",
      monthDay: "locale",
      year: "locale",
      yearMonth: "MMMM YYYY",
      numericMonthDay: "M/D",
    });
  });

  it("memoizes per locale so repeated dated surfaces on one page share the object", () => {
    const dateFormatsFor = deriveDateFormats(makeFakeChromeContext());
    expect(dateFormatsFor("en")).toBe(dateFormatsFor("en"));
    expect(dateFormatsFor("en")).not.toBe(dateFormatsFor("ja"));
  });
});

// ---------------------------------------------------------------------------
// Islands — the resolved roles must survive into the serialized data-props
// ---------------------------------------------------------------------------

describe("dateFormats reaches the serialized island data-props", () => {
  it("desktop sidebar (SidebarTree) carries the roles resolved for the page locale", () => {
    const ctx = makeFakeChromeContext({ settings: { dateFormat: PER_LOCALE_SETTING } });
    const html = render(createSidebarWithDefaults(ctx)({ lang: "ja" }) as VNode);

    expect(html).toContain(serializedProp("full", "YYYY年M月D日"));
    expect(html).toContain(serializedProp("numericMonthDay", "M/D"));
    // The top-level role still applies where the locale block is silent.
    expect(html).toContain(serializedProp("yearMonth", "MMMM YYYY"));
  });

  it("mobile drawer (SidebarToggle, nested in the persisted header) carries them too", () => {
    const ctx = makeFakeChromeContext({ settings: { dateFormat: PER_LOCALE_SETTING } });
    const header = createHeaderWithDefaults(ctx)({ lang: "ja" }) as VNode<Record<string, unknown>>;
    const html = render(header.props["sidebarToggle"] as VNode);

    expect(html).toContain('data-zfb-island="SidebarToggle"');
    expect(html).toContain(serializedProp("full", "YYYY年M月D日"));
  });

  it("MDX <SiteTreeNav> wrapper resolves against its own `lang`, not the default locale", () => {
    const deps: SiteTreeNavDeps = {
      defaultLocale: "en",
      resolveNavSource: () => ({ navDocs: [], categoryMeta: new Map() }),
      buildNavTree: () => [makeNode("guides")],
      groupSatelliteNodes: (tree) => tree,
      getCategoryOrder: () => ["guides"],
      dateFormat: PER_LOCALE_SETTING,
    };
    const html = render(createSiteTreeNavWrapper(deps)({ lang: "ja" }) as VNode);

    expect(html).toContain('data-zfb-island="SiteTreeNav"');
    expect(html).toContain(serializedProp("full", "YYYY年M月D日"));
  });

  it("DocHistory resolves against the DISPLAY locale, not the storage-path locale", () => {
    const ctx = makeFakeChromeContext({
      settings: { bodyFootUtilArea: false, dateFormat: PER_LOCALE_SETTING },
    });
    // isFallback swaps the fetch path back to the default locale; the reader is
    // still on the JA page, so the patterns must stay JA (#4073 + #4075).
    const html = render(
      createDocHistoryArea(ctx)({ slug: "guide", locale: "ja", isFallback: true }) as VNode,
    );

    expect(html).not.toMatch(/&quot;locale&quot;:/);
    expect(html).toContain(serializedProp("displayLocale", "ja"));
    expect(html).toContain(serializedProp("full", "YYYY年M月D日"));
  });
});

// ---------------------------------------------------------------------------
// The note-tray prop chain (plain components, no ChromeContext of their own)
// ---------------------------------------------------------------------------

function makeNoteTrayDeps(dateFormat?: NoteTrayIndexDeps["dateFormat"]): NoteTrayIndexDeps {
  const tray = {
    slug: "notes",
    label: "Notes",
    shape: "note-tray" as const,
    children: [
      {
        slug: "notes/first",
        label: "First",
        href: "/docs/notes/first",
        date: "2026-08-22",
        children: [],
      },
    ],
  };
  return {
    defaultLocale: "en",
    docTags: false,
    resolveNavSource: () => ({ navDocs: [], categoryMeta: new Map() }),
    buildNavTree: () => [tray] as never,
    findNode: () => tray as never,
    toRouteSlug: (slug) => slug,
    resolveTag: (raw) => raw,
    tagHref: (tag) => `/docs/tags/${tag}`,
    t: (key) => key,
    versionedDocsUrl: (slug) => `/docs/${slug}`,
    dateFormat,
  };
}

describe("note-tray prop chain", () => {
  it("hands the roles resolved for `lang` to <NoteTrayIndex>", () => {
    const wrapper = createNoteTrayIndexWrapper(makeNoteTrayDeps(PER_LOCALE_SETTING));
    const vnode = wrapper({ lang: "ja", category: "notes" }) as VNode<Record<string, unknown>>;

    expect(vnode.props["dateFormats"]).toEqual({
      full: "YYYY年M月D日",
      monthDay: "locale",
      year: "locale",
      yearMonth: "MMMM YYYY",
      numericMonthDay: "M/D",
    });
  });

  it("falls back to every role \"locale\" when the deps field is omitted", () => {
    const wrapper = createNoteTrayIndexWrapper(makeNoteTrayDeps());
    const vnode = wrapper({ lang: "en", category: "notes" }) as VNode<Record<string, unknown>>;

    expect(vnode.props["dateFormats"]).toEqual(ALL_LOCALE);
  });
});

// ---------------------------------------------------------------------------
// Back-compat: every new prop / deps field is optional and absent-safe
// ---------------------------------------------------------------------------

describe("dateFormats back-compat — optional everywhere", () => {
  it("SidebarTree renders without the prop", () => {
    expect(() => render(<SidebarTree nodes={[makeNode("intro")]} />)).not.toThrow();
  });

  it("SidebarToggle renders without the prop", () => {
    expect(() => render(<SidebarToggle nodes={[makeNode("intro")]} />)).not.toThrow();
  });

  it("SiteTreeNav renders without the prop", () => {
    expect(() => render(<SiteTreeNav tree={[makeNode("intro")]} />)).not.toThrow();
  });

  it("NoteTrayIndex renders without the prop", () => {
    expect(() =>
      render(
        <NoteTrayIndex
          items={[{ slug: "a", label: "A", href: "/docs/a", date: "2026-08-22", children: [] }]}
          locale="en"
          updatedLabel="Updated"
          dated={true}
          showDate={true}
        />,
      ),
    ).not.toThrow();
  });

  it("SiteTreeNavDeps compiles and renders without `dateFormat` (frozen 1.0 subpath)", () => {
    const deps: SiteTreeNavDeps = {
      defaultLocale: "en",
      resolveNavSource: () => ({ navDocs: [], categoryMeta: new Map() }),
      buildNavTree: () => [makeNode("guides")],
      groupSatelliteNodes: (tree) => tree,
      getCategoryOrder: () => ["guides"],
    };
    const html = render(createSiteTreeNavWrapper(deps)({ lang: "en" }) as VNode);

    expect(html).toContain(serializedProp("full", "locale"));
  });

  it("a context with no `dateFormat` still serializes a complete roles object", () => {
    const ctx = makeFakeChromeContext();
    const html = render(createSidebarWithDefaults(ctx)({ lang: "en" }) as VNode);

    for (const role of Object.keys(ALL_LOCALE)) {
      expect(html).toContain(serializedProp(role, "locale"));
    }
  });

  it("the serialized data-props stays valid JSON once the roles object is in it", () => {
    const ctx = makeFakeChromeContext({ settings: { dateFormat: PER_LOCALE_SETTING } });
    const html = render(createSidebarWithDefaults(ctx)({ lang: "ja" }) as VNode);

    const match = /data-props="([^"]*)"/.exec(html);
    expect(match).not.toBeNull();
    const decoded = match![1]!
      .replaceAll("&quot;", '"')
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&#39;", "'")
      .replaceAll("&amp;", "&");
    const parsed = JSON.parse(decoded) as { dateFormats?: Record<string, string> };
    expect(parsed.dateFormats?.full).toBe("YYYY年M月D日");
  });
});
