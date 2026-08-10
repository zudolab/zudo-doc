// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { buildSiteMap } from "../../../core/outline/site-map.js";
import { pageMetaFromSnapshot } from "../outline-model.js";
import { SitemapPreview } from "../sitemap-preview.js";
import { mount, testSnapshot } from "./support.js";

function siteMapFor() {
  const snapshot = testSnapshot();
  return buildSiteMap(snapshot.outline, pageMetaFromSnapshot(snapshot));
}

describe("SitemapPreview", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows the generated top page with every category as a card", async () => {
    const view = await mount(
      <SitemapPreview siteMap={siteMapFor()} selectedCategoryId={null} />,
    );

    const text = view.container.textContent ?? "";
    expect(text).toContain("Top page");
    expect(text).toContain("generated category grid");
    expect(text).toContain("Alpha");
    expect(text).toContain("Beta");
    expect(text).toContain("Gamma");
    expect(text).toContain("3 pages");
    // Nothing scoped yet, so there is no category mock to show.
    expect(text).not.toContain("Category view");
    expect(text).toContain("Select a category");

    view.unmount();
  });

  it("scopes the sidebar mock to the selected category", async () => {
    const view = await mount(
      <SitemapPreview siteMap={siteMapFor()} selectedCategoryId="cat-alpha" />,
    );

    const text = view.container.textContent ?? "";
    expect(text).toContain("Category view");
    expect(text).toContain("/docs/alpha");
    expect(text).toContain("Sidebar scoped to");
    // The sidebar lists the category's own pages; the index page is the
    // landing page and reads as the heading rather than an entry.
    expect(text).toContain("One");
    expect(text).toContain("Two");

    view.unmount();
  });

  it("keeps draft pages visible and says what a draft means for visitors", async () => {
    const view = await mount(
      <SitemapPreview siteMap={siteMapFor()} selectedCategoryId="cat-alpha" />,
    );

    const text = view.container.textContent ?? "";
    expect(text).toContain("“Two” has unpublished edits");
    expect(text).toContain("visitors still see the last published version");

    view.unmount();
  });

  it("says nothing about drafts for a category that has none", async () => {
    const view = await mount(
      <SitemapPreview siteMap={siteMapFor()} selectedCategoryId="cat-beta" />,
    );

    expect(view.container.textContent ?? "").not.toContain("unpublished edits");

    view.unmount();
  });

  it("reports an empty category honestly instead of drawing a fake sidebar", async () => {
    const view = await mount(
      <SitemapPreview siteMap={siteMapFor()} selectedCategoryId="cat-gamma" />,
    );

    expect(view.container.textContent ?? "").toContain("No pages yet");

    view.unmount();
  });
});
