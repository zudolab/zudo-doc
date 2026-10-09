import { test, expect } from "./fixtures";

const DOCS_PAGE = "/docs/getting-started";

const PLATFORMS = [
  {
    name: "macOS",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36",
    platform: "macOS",
    shortcut: "⌘K",
    openKey: "Meta+k",
  },
  {
    name: "Windows",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36",
    platform: "Windows",
    shortcut: "Ctrl+K",
    openKey: "Control+k",
  },
];

for (const platform of PLATFORMS) {
  test(`${platform.name} shortcut badge survives clear, reopen, navigation, and reconnection (#4482)`, async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.addInitScript(
      ({ userAgent, platformName }: { userAgent: string; platformName: string }) => {
        Object.defineProperty(navigator, "userAgent", {
          configurable: true,
          value: userAgent,
        });
        Object.defineProperty(navigator, "userAgentData", {
          configurable: true,
          value: { platform: platformName },
        });
      },
      { userAgent: platform.userAgent, platformName: platform.platform },
    );

    await page.goto(DOCS_PAGE, { waitUntil: "domcontentloaded" });

    let mainFrameDocumentRequests = 0;
    page.on("request", (request) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        mainFrameDocumentRequests += 1;
      }
    });

    const search = page.locator("site-search").first();
    const dialog = search.locator("[data-search-dialog]");
    const input = search.locator("[data-search-input]");
    const shortcut = search.locator("[data-kbd-shortcut]");
    const results = search.locator("[data-search-results]");
    const placeholder = search.locator("[data-search-placeholder]");

    // First open must show the platform's shortcut label.
    await page.keyboard.press(platform.openKey);
    await expect(dialog).toBeVisible();
    await expect(shortcut).toHaveText(platform.shortcut);

    // Typing replaces the placeholder, and deleting the query restores it.
    await input.fill("Getting Started");
    await expect(results.locator("article a").first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(placeholder).toHaveCount(0);

    await input.fill("");
    await expect(placeholder).toBeVisible();
    await expect(shortcut).toHaveText(platform.shortcut);

    // The shipped input is type=text: Escape closes the native dialog and
    // preserves the query. Deleting it after reopening restores the placeholder.
    await input.fill("Getting Started");
    await expect(results.locator("article a").first()).toBeVisible({
      timeout: 10_000,
    });
    await input.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(input).toHaveValue("Getting Started");

    await page.keyboard.press(platform.openKey);
    await expect(dialog).toBeVisible();
    await expect(input).toHaveValue("Getting Started");
    await input.fill("");
    await expect(placeholder).toBeVisible();
    await expect(shortcut).toHaveText(platform.shortcut);

    // Disconnect/reconnect while populated, then clear. The first placeholder
    // snapshot must survive a reconnect whose results DOM contains an article.
    await input.fill("Getting Started");
    await expect(results.locator("article a").first()).toBeVisible({
      timeout: 10_000,
    });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await search.evaluate((element) => {
      element.remove();
      document.body.append(element);
    });
    await expect(results.locator("article a")).toHaveCount(1);
    await page.keyboard.press(platform.openKey);
    await expect(dialog).toBeVisible();
    await expect(input).toHaveValue("Getting Started");
    await expect(results.locator("article a").first()).toBeVisible();
    await input.fill("");
    await expect(placeholder).toBeVisible();
    await expect(shortcut).toHaveText(platform.shortcut);

    // Follow a result through the real SPA navigation without requesting a
    // replacement main-frame document.
    await input.fill("Guides");
    const resultLink = results.locator("article a").first();
    await expect(resultLink).toBeVisible({ timeout: 10_000 });
    const href = await resultLink.getAttribute("href");
    expect(href, "search results should link to a document").toBeTruthy();
    await resultLink.click();
    await page.waitForURL(
      new RegExp(href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      { timeout: 5_000 },
    );
    await expect(dialog).not.toBeVisible();
    await expect(shortcut).toHaveText(platform.shortcut);
    expect(mainFrameDocumentRequests).toBe(0);

    // A second same-node reconnect must not duplicate the global shortcut
    // listener or lose the platform label.
    const host = page.locator("site-search").first();
    await host.evaluate((element) => {
      element.remove();
      document.body.append(element);
    });
    await expect(host.locator("[data-kbd-shortcut]")).toHaveText(
      platform.shortcut,
    );
    await page.keyboard.press(platform.openKey);
    await expect(host.locator("[data-search-dialog]")).toBeVisible();
    await expect(host.locator("[data-kbd-shortcut]")).toHaveText(
      platform.shortcut,
    );
    await assertNoConsoleErrors();
  });
}
