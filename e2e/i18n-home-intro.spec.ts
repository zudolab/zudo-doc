import { test, expect } from "./fixtures";

// Real host root/localized routes, compiled CSS and the production Markdown pipeline.
// Theme variants and wide/custom-logo variants remain in the manager's visual matrix.
for (const width of [1440, 1024, 768, 390, 320]) {
  test(`compact homepage geometry and rich prose at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    const prose = page.locator(".zd-compact-prose");
    await expect(prose).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("[data-home-rule]")).toHaveCount(2);
    await expect(prose.locator(".hash-link")).toHaveCount(0);
    await expect(prose.locator("pre.hi-root")).toHaveCount(1);
    await expect(prose.locator(".hi-kw").first()).toBeVisible();
    await expect(page.locator(".zd-home-sitemap > h2")).toHaveText("Explore the documentation");

    const geometry = await page.evaluate(() => {
      const identity = document.querySelector<HTMLElement>(".zd-home-hero > .zd-home-inner")!;
      const inner = document.querySelector<HTMLElement>(".zd-home-intro > .zd-home-inner")!;
      const rule = document.querySelector<HTMLElement>("[data-home-rule]")!;
      const outer = rule.parentElement!;
      const rect = (element: HTMLElement) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, width: box.width };
      };
      const outerStyle = getComputedStyle(outer);
      const paddingLeft = parseFloat(outerStyle.paddingLeft);
      const paddingRight = parseFloat(outerStyle.paddingRight);
      return {
        identity: rect(identity), inner: rect(inner),
        rules: [...document.querySelectorAll<HTMLElement>("[data-home-rule]")].map(rect),
        outerLeft: outer.getBoundingClientRect().left + outer.clientLeft + paddingLeft,
        available: outer.clientWidth - paddingLeft - paddingRight,
        cap: 60 * parseFloat(getComputedStyle(document.documentElement).fontSize),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(Math.abs(geometry.identity.width - geometry.inner.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.identity.left - geometry.inner.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.inner.width - Math.min(geometry.cap, geometry.available))).toBeLessThanOrEqual(1);
    for (const rule of geometry.rules) {
      expect(Math.abs(rule.width - geometry.available)).toBeLessThanOrEqual(1);
      expect(Math.abs(rule.left - geometry.outerLeft)).toBeLessThanOrEqual(1);
    }
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    await expect(prose).toHaveCSS("text-align", "left");
    await expect(prose).toHaveCSS("font-size", "16px");
    await expect(prose).toHaveCSS("line-height", "28px");
    for (const [tag, size] of [["h2", "20.8px"], ["h3", "18px"], ["h4", "16px"], ["h5", "15px"], ["h6", "15px"]] as const) {
      const heading = prose.locator(tag).first();
      await expect(heading).toHaveCSS("font-size", size);
      await expect(heading).toHaveCSS("font-weight", "700");
      await expect(heading).toHaveCSS("border-top-width", "0px");
      await expect(heading).toHaveCSS("border-bottom-width", "0px");
      await expect(heading).toHaveCSS("background-image", "none");
    }
    await expect(prose.locator(":scope > :first-child")).toHaveCSS("margin-top", "0px");
    await expect(prose.locator("h2").nth(1)).toHaveCSS("margin-top", "28px");
    await expect(prose.locator("h2 + p").first()).toHaveCSS("margin-top", "8px");
    await expect(prose.locator("pre")).toHaveCSS("overflow-x", "auto");
    const scrollContainers = await prose.locator("pre, table").evaluateAll(elements => elements.map(element => {
      let current: Element | null = element;
      while (current && !current.classList.contains("zd-compact-prose")) {
        if (["auto", "scroll"].includes(getComputedStyle(current).overflowX)) {
          return { internal: true, overflows: current.scrollWidth > current.clientWidth };
        }
        current = current.parentElement;
      }
      return { internal: false, overflows: false };
    }));
    expect(scrollContainers).toHaveLength(2);
    expect(scrollContainers.every(result => result.internal)).toBe(true);
    // The deliberately long fence proves this is a real overflow case.
    expect(scrollContainers.some(result => result.overflows)).toBe(true);
    const link = prose.getByRole("link", { name: "Getting started" });
    await expect(link).toHaveAttribute("href", "/docs/getting-started");
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/docs\/getting-started\/?$/);
    await expect(page.locator(".zd-compact-prose")).toHaveCount(0);
  });
}

test("localized whitespace suppresses fallback prose and its upper separator", async ({ page }) => {
  await page.goto("/ja/");
  await expect(page.locator(".zd-compact-prose")).toHaveCount(0);
  await expect(page.locator(".zd-home-intro")).toHaveCount(0);
  await expect(page.locator("[data-home-rule]")).toHaveCount(1);
  await expect(page.locator('[data-home-rule="lower"]')).toBeVisible();
  await expect(page.locator(".zd-home-sitemap > h2")).toHaveText("ドキュメントを探す");
  await expect(page.locator("h1")).toHaveCount(1);
});

test("a locale without an override inherits prose with localized links", async ({ page }) => {
  await page.goto("/de/");
  await expect(page.locator(".zd-compact-prose")).toBeVisible();
  await expect(page.locator(".zd-compact-prose").getByRole("link", { name: "Getting started" }))
    .toHaveAttribute("href", "/de/docs/getting-started");
});
