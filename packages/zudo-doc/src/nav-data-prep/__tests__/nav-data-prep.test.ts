import { describe, it, expect } from "vitest";
import {
  remapVersionedHrefs,
  buildRootMenuItems,
  buildLocaleLinksForNav,
  type NavDataPrepNode,
  type NavDataPrepHeaderNavItem,
  type LocaleLink,
} from "../index.js";

/** Tiny NavNode fixture builder, mirroring build-tree.test.ts's `entry()`. */
function navNode(
  slug: string,
  overrides: Partial<NavDataPrepNode> = {},
): NavDataPrepNode {
  return {
    slug,
    label: slug,
    href: `/docs/${slug}/`,
    children: [],
    ...overrides,
  };
}

describe("remapVersionedHrefs", () => {
  const versionedDocsUrl = (slug: string, version: string, lang: string) =>
    lang === "en"
      ? `/v/${version}/docs/${slug}/`
      : `/v/${version}/${lang}/docs/${slug}/`;

  it("rewrites a leaf node's href to the versioned URL", () => {
    const [result] = remapVersionedHrefs([navNode("intro")], "1.0", "en", versionedDocsUrl);
    expect(result?.href).toBe("/v/1.0/docs/intro/");
  });

  it("rewrites to a versioned ja-locale href", () => {
    const [result] = remapVersionedHrefs([navNode("intro")], "2.0", "ja", versionedDocsUrl);
    expect(result?.href).toBe("/v/2.0/ja/docs/intro/");
  });

  it("recurses into children and rewrites nested hrefs", () => {
    const tree = [
      navNode("guides", { children: [navNode("guides/a"), navNode("guides/b")] }),
    ];
    const [result] = remapVersionedHrefs(tree, "1.0", "ja", versionedDocsUrl);
    expect(result?.href).toBe("/v/1.0/ja/docs/guides/");
    expect(result?.children.map((c) => c.href)).toEqual([
      "/v/1.0/ja/docs/guides/a/",
      "/v/1.0/ja/docs/guides/b/",
    ]);
  });

  it("leaves a node without an href untouched but still recurses into its children", () => {
    const tree = [
      navNode("category", { href: undefined, children: [navNode("category/a")] }),
    ];
    const [result] = remapVersionedHrefs(tree, "1.0", "en", versionedDocsUrl);
    expect(result?.href).toBeUndefined();
    expect(result?.children[0]?.href).toBe("/v/1.0/docs/category/a/");
  });

  it("skips a __link__ node even when it carries an href", () => {
    const linkNode = navNode("__link__external", { href: "https://example.com" });
    const [result] = remapVersionedHrefs([linkNode], "1.0", "en", versionedDocsUrl);
    expect(result?.href).toBe("https://example.com");
  });

  it("returns the identical node reference for a childless, href-less node (no-op)", () => {
    const leaf = navNode("category", { href: undefined });
    const [result] = remapVersionedHrefs([leaf], "1.0", "en", versionedDocsUrl);
    expect(result).toBe(leaf);
  });
});

describe("buildRootMenuItems", () => {
  const t = (key: string, lang: string) => `${key}:${lang}`;
  const navHref = (
    path: string,
    lang: string | undefined,
    version: string | undefined,
    versioned = true,
  ) =>
    `${versioned && version ? `/v/${version}` : ""}${lang && lang !== "en" ? `/${lang}` : ""}${path}`;

  it("uses labelKey via t() when present", () => {
    const items = buildRootMenuItems(
      "ja",
      undefined,
      [{ label: "Guides", labelKey: "nav.guides", path: "/docs/guides/" }],
      t,
      navHref,
    );
    expect(items[0]?.label).toBe("nav.guides:ja");
  });

  it("falls back to the literal label when labelKey is absent", () => {
    const items = buildRootMenuItems(
      "en",
      undefined,
      [{ label: "Guides", path: "/docs/guides/" }],
      t,
      navHref,
    );
    expect(items[0]?.label).toBe("Guides");
  });

  it("builds the href via navHref with the current version", () => {
    const items = buildRootMenuItems(
      "en",
      "1.0",
      [{ label: "Guides", path: "/docs/guides/" }],
      t,
      navHref,
    );
    expect(items[0]?.href).toBe("/v/1.0/docs/guides/");
  });

  it("maps children with the same label/href rules", () => {
    const headerNav: NavDataPrepHeaderNavItem[] = [
      {
        label: "Guides",
        path: "/docs/guides/",
        children: [{ label: "Intro", labelKey: "nav.intro", path: "/docs/guides/intro/" }],
      },
    ];
    const items = buildRootMenuItems("ja", undefined, headerNav, t, navHref);
    expect(items[0]?.children).toEqual([
      { label: "nav.intro:ja", href: "/ja/docs/guides/intro/" },
    ]);
  });

  it("leaves children undefined when the source item has no children", () => {
    const items = buildRootMenuItems(
      "en",
      undefined,
      [{ label: "Guides", path: "/docs/guides/" }],
      t,
      navHref,
    );
    expect(items[0]?.children).toBeUndefined();
  });

  // Reach-assertion (3/4, mobile/root-menu output) for headerNav's `versioned`
  // flag (#3216/#3190) — buildRootMenuItems is the builder behind the mobile
  // "back to menu" list rendered by SidebarToggle.
  it("suppresses the version prefix for a top-level item with versioned: false", () => {
    const items = buildRootMenuItems(
      "en",
      "1.0",
      [{ label: "Claude", path: "/docs/claude/", versioned: false }],
      t,
      navHref,
    );
    expect(items[0]?.href).toBe("/docs/claude/");
  });

  it("suppresses the version prefix for a child item with versioned: false", () => {
    const headerNav: NavDataPrepHeaderNavItem[] = [
      {
        label: "Guides",
        path: "/docs/guides/",
        children: [
          { label: "Intro", path: "/docs/guides/intro/", versioned: false },
          { label: "Advanced", path: "/docs/guides/advanced/" },
        ],
      },
    ];
    const items = buildRootMenuItems("en", "1.0", headerNav, t, navHref);
    expect(items[0]?.children).toEqual([
      { label: "Intro", href: "/docs/guides/intro/" },
      { label: "Advanced", href: "/v/1.0/docs/guides/advanced/" },
    ]);
  });

  it("keeps the version prefix when versioned is omitted (default true)", () => {
    const items = buildRootMenuItems(
      "en",
      "1.0",
      [{ label: "Guides", path: "/docs/guides/" }],
      t,
      navHref,
    );
    expect(items[0]?.href).toBe("/v/1.0/docs/guides/");
  });
});

describe("buildLocaleLinksForNav", () => {
  it("delegates to buildLocaleLinks when more than one locale is configured", () => {
    const links: LocaleLink[] = [
      { code: "en", label: "EN", href: "/docs/x/", active: false },
      { code: "ja", label: "JA", href: "/ja/docs/x/", active: true },
    ];
    let calledWith: [string, string] | undefined;
    const buildLocaleLinks = (path: string, lang: string) => {
      calledWith = [path, lang];
      return links;
    };
    const result = buildLocaleLinksForNav("/docs/x/", "ja", 2, buildLocaleLinks);
    expect(result).toBe(links);
    expect(calledWith).toEqual(["/docs/x/", "ja"]);
  });

  it("returns undefined without calling buildLocaleLinks for a single-locale project", () => {
    let called = false;
    const buildLocaleLinks = () => {
      called = true;
      return [];
    };
    const result = buildLocaleLinksForNav("/docs/x/", "en", 1, buildLocaleLinks);
    expect(result).toBeUndefined();
    expect(called).toBe(false);
  });
});
