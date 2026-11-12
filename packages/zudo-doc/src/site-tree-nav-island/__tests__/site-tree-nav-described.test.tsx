/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
import { afterEach, describe, expect, it } from "vitest";
import { flushAll, renderIsland, renderSsr } from "../../__tests__/helpers/zudo-react.js";
import { SiteTreeNav } from "../index.js";
import { countCategoryDocuments } from "../count.js";
import type { SiteTreeNavProps } from "../index.js";
import type { SidebarNavNode } from "../../sidebar/types.js";

const leaf = (slug: string, label: string, description?: string): SidebarNavNode => ({
  slug, label, position: 0, href: `/docs/${slug}/`, hasPage: true, children: [],
  ...(description ? { description } : {}),
});

const STUDIO: SidebarNavNode = {
  slug: "studio", label: "Studio", description: "Team handbook.", position: 0, href: "/docs/studio/", hasPage: true,
  children: [
    leaf("studio/onboarding", "Onboarding", "First week."),
    { slug: "studio/tools", label: "Tools", position: 1, hasPage: false, children: [leaf("studio/tools/editor", "Editor"), leaf("studio/tools/release", "Release")] },
    leaf("studio/glossary", "Glossary"),
  ],
};
const MISC: SidebarNavNode = { slug: "misc", label: "Misc", position: 1, hasPage: false, children: [leaf("misc/a", "A doc")] };

const mounted: Array<() => void> = [];
afterEach(() => { for (const d of mounted.splice(0)) d(); });

async function mount(props: SiteTreeNavProps) {
  const view = await renderIsland(SiteTreeNav, props, { identity: { component: "SiteTreeNav", build: "test" } });
  expect(view.diagnostics).toEqual([]);
  mounted.push(view.dispose);
  return view.root;
}

describe("SiteTreeNav described variant — SSR", () => {
  it("shows only available descriptions and the category document count", () => {
    const html = renderSsr(<SiteTreeNav tree={[STUDIO, MISC]} variant="described" />);
    expect(html).toContain('data-variant="described"');
    expect(html).toContain("repeat(auto-fit, minmax(min(22rem, 100%), 1fr))");
    expect(html).toContain(">Team handbook.</p>");
    expect(html).toContain(">First week.</span>");
    expect(html.match(/data-site-tree-description/g)).toHaveLength(2);
    expect(html).toContain(">4 documents</p>");
    expect(html).toContain(">1 document</p>");
  });

  it("localizes the count through serializable templates and Intl plural rules", () => {
    const html = renderSsr(
      <SiteTreeNav tree={[MISC]} variant="described" locale="ja" countLabels={{ one: "{count} 件の文書", other: "{count} 件の文書" }} />,
    );
    expect(html).toContain(">1 件の文書</p>");
  });

  it("keeps the standard variant free of descriptions, counts and split markers", () => {
    const html = renderSsr(<SiteTreeNav tree={[STUDIO]} />);
    expect(html).toContain('data-variant="default"');
    expect(html).toContain("repeat(auto-fill, minmax(min(18rem, 100%), 1fr))");
    expect(html).not.toContain("data-site-tree-description");
    expect(html).not.toContain("data-site-tree-count");
    expect(html).not.toContain("data-split");
  });

  it("marks only a lone described category with children as a split candidate", () => {
    expect(renderSsr(<SiteTreeNav tree={[STUDIO]} variant="described" />)).toContain('data-split="true"');
    expect(renderSsr(<SiteTreeNav tree={[STUDIO, MISC]} variant="described" />)).not.toContain("data-split");
    expect(renderSsr(<SiteTreeNav tree={[STUDIO]} variant="described" initiallyCollapsedCategorySlugs={["studio"]} />)).toContain('data-split="false"');
  });

  it("marks the first/last rails of the root list for the lead-in and end clipping", () => {
    const html = renderSsr(<SiteTreeNav tree={[STUDIO]} />);
    expect(html).toContain('data-node="studio/onboarding"><span aria-hidden="true" class="zd-site-tree-rail" data-tree-rail="true" data-root="" data-first="true" data-last="false">');
    expect(html).toContain('data-node="studio/glossary"><span aria-hidden="true" class="zd-site-tree-rail" data-tree-rail="true" data-root="" data-first="false" data-last="true">');
    // Nested rails are not root rails.
    expect(html).toContain('data-node="studio/tools/editor"><span aria-hidden="true" class="zd-site-tree-rail" data-tree-rail="true" data-first="true" data-last="false">');
  });

  it("crops rails at the rows actually drawn when a leaf has no link", () => {
    const linkless: SidebarNavNode = { slug: "studio/draft", label: "Draft", position: 9, hasPage: false, children: [] };
    const html = renderSsr(<SiteTreeNav tree={[{ ...STUDIO, children: [linkless, ...STUDIO.children, linkless] }]} />);
    expect(html).not.toContain('data-node="studio/draft"');
    expect(html).toContain('data-node="studio/onboarding"><span aria-hidden="true" class="zd-site-tree-rail" data-tree-rail="true" data-root="" data-first="true"');
    expect(html).toContain('data-node="studio/glossary"><span aria-hidden="true" class="zd-site-tree-rail" data-tree-rail="true" data-root="" data-first="false" data-last="true">');
  });

  it("substitutes every {count} in a count template", () => {
    expect(renderSsr(<SiteTreeNav tree={[MISC]} variant="described" countLabels={{ one: "{count} / {count}", other: "{count} / {count}" }} />)).toContain(">1 / 1</p>");
  });

  it("counts published documents below a category, excluding the category page itself", () => {
    expect(countCategoryDocuments(STUDIO)).toBe(4);
    expect(countCategoryDocuments(MISC)).toBe(1);
  });
});

describe("SiteTreeNav disclosure accessibility", () => {
  it("gives every disclosure a valid aria-controls target and hides collapsed children", async () => {
    const root = await mount({ tree: [STUDIO, MISC], variant: "described", initiallyCollapsedCategorySlugs: ["studio/tools"] });
    for (const control of root.querySelectorAll("[aria-controls]")) {
      const target = root.querySelector(`#${control.getAttribute("aria-controls")}`);
      expect(target, control.outerHTML).not.toBeNull();
    }
    const tools = root.querySelector<HTMLElement>("#zd-site-tree-studio_2ftools")!;
    expect(tools.hidden).toBe(true);
    expect(tools.querySelector("a")).toBeNull();
    // Decorative connectors and icons stay out of the accessibility tree.
    for (const deco of root.querySelectorAll("[data-tree-rail], [data-tree-branch], [data-tree-stem], .zd-site-tree-marker")) {
      expect(deco.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("toggles root and child independently and keeps focus on the pressed control", async () => {
    const root = await mount({ tree: [STUDIO] });
    const child = root.querySelector<HTMLButtonElement>('button[aria-label="Collapse Tools"]')!;
    child.focus();
    child.click();
    await flushAll();
    expect(child.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(child);
    expect(root.querySelector('a[href="/docs/studio/tools/editor/"]')).toBeNull();
    expect(root.querySelector("[data-tree-stem]")).toBeNull();
    expect(root.querySelector('a[href="/docs/studio/glossary/"]')).not.toBeNull();

    const rootToggle = root.querySelector<HTMLButtonElement>('button[aria-label="Collapse Studio"]')!;
    rootToggle.click();
    await flushAll();
    expect(root.querySelector<HTMLElement>("#zd-site-tree-studio")!.hidden).toBe(true);
    expect(root.querySelector('a[href="/docs/studio/glossary/"]')).toBeNull();
    rootToggle.click();
    await flushAll();
    // The child keeps its own state across the parent's remount of children.
    expect(root.querySelector('a[href="/docs/studio/glossary/"]')).not.toBeNull();
  });

  it("toggles a category without a page from its label button, never a fabricated link", async () => {
    const root = await mount({ tree: [MISC], variant: "described" });
    expect(root.querySelector('a[href=""]')).toBeNull();
    const label = root.querySelector<HTMLButtonElement>('.zd-site-tree-head button.zd-site-tree-label')!;
    expect(label.getAttribute("aria-controls")).toBe("zd-site-tree-misc");
    label.click();
    await flushAll();
    expect(label.getAttribute("aria-expanded")).toBe("false");
    expect(root.querySelector('a[href="/docs/misc/a/"]')).toBeNull();
    expect(root.querySelector('button[aria-label="Expand Misc"]')).not.toBeNull();
  });

  it("scopes ids with idPrefix for several trees on one page", () => {
    const html = renderSsr(<SiteTreeNav tree={[MISC]} idPrefix="second" />);
    expect(html).toContain('id="second-misc"');
    expect(html).toContain('aria-controls="second-misc"');
  });
});
