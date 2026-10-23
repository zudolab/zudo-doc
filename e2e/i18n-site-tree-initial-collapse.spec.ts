import { test, expect } from "./fixtures";

const island = '[data-zfb-island="SiteTreeNav"]';

function siteTreeHtml(html: string): string[] {
  return [...html.matchAll(/<nav\b[^>]*data-site-nav(?:=true)?[^>]*>[\s\S]*?<\/nav>/g)]
    .map((match) => match[0]);
}

function expectClosedInSsr(nav: string, localePrefix: string, rootLabel: string): void {
  expect(nav).toMatch(/aria-label="Expand Sub A"[^>]*aria-expanded=false/);
  expect(nav).toContain(`href=${localePrefix}/docs/guides/sub-a`);
  expect(nav).not.toContain(`href=${localePrefix}/docs/guides/sub-a/page-1`);
  expect(nav).toMatch(new RegExp(`aria-label="Collapse ${rootLabel}"[^>]*aria-expanded=true`));
}

for (const route of ["/", "/ja/"]) {
  test(`configured nested category stays closed across homepage hydration: ${route}`, async ({ page, request, assertNoConsoleErrors }) => {
    const response = await request.get(route);
    expect(response.ok()).toBe(true);
    const html = await response.text();
    const navs = siteTreeHtml(html);
    expect(navs).toHaveLength(1);
    const localePrefix = route === "/" ? "" : "/ja";
    const rootLabel = route === "/" ? "Guides" : "ガイド";
    expectClosedInSsr(navs[0]!, localePrefix, rootLabel);

    await page.goto(route);
    const siteTree = page.locator(island);
    await expect(siteTree).toHaveAttribute("data-zfb-island-mounted", "");
    await expect(siteTree.getByRole("button", { name: "Expand Sub A" })).toHaveAttribute("aria-expanded", "false");
    await expect(siteTree.getByRole("button", { name: `Collapse ${rootLabel}` })).toHaveAttribute("aria-expanded", "true");
    const childPage = siteTree.locator(`a[href="${localePrefix}/docs/guides/sub-a/page-1"]`);
    await expect(childPage).toHaveCount(0);
    await expect(siteTree.getByRole("link", { name: "Sub A" })).toBeVisible();

    await siteTree.getByRole("button", { name: "Expand Sub A" }).click();
    await expect(childPage).toBeVisible();
    await siteTree.getByRole("button", { name: "Collapse Sub A" }).click();
    await expect(childPage).toHaveCount(0);
    assertNoConsoleErrors();
  });
}

test("both MDX aliases inherit the configured initial state", async ({ page, request, assertNoConsoleErrors }) => {
  const route = "/ja/docs/guides/writing-docs/";
  const response = await request.get(route);
  expect(response.ok()).toBe(true);
  const html = await response.text();
  const navs = siteTreeHtml(html);
  expect(navs).toHaveLength(2);
  for (const nav of navs) expectClosedInSsr(nav, "/ja", "ガイド");

  await page.goto(route);
  const siteTrees = page.locator(island);
  await expect(siteTrees).toHaveCount(2);
  for (const siteTree of await siteTrees.all()) {
    await expect(siteTree).toHaveAttribute("data-zfb-island-mounted", "");
    await expect(siteTree.getByRole("button", { name: "Expand Sub A" })).toHaveAttribute("aria-expanded", "false");
  }
  assertNoConsoleErrors();
});
