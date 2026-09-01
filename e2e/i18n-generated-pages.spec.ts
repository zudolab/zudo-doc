import { expect, test } from "./fixtures";
import { makeDistReader } from "./dist-helper";
import { desktopSidebar, waitForSidebarHydration } from "./sidebar-helpers";

const { readDistFile } = makeDistReader("i18n");
const GENERATED_SKILL_ROUTE = "/ja/docs/claude-skills/localized-shell";
const GENERATED_SKILL_PATH = `${GENERATED_SKILL_ROUTE}/`;
const JA_ASSET_PATH = "/ja/files/locale-diagram.svg/";

type SearchEntry = {
  url: string;
};

test.use({ viewport: { width: 1280, height: 900 } });

test.describe("i18n generated pages: static locale coverage", () => {
  test("emits localized resource overviews in every configured locale", () => {
    const jaOverview = readDistFile("ja/docs/claude/index.html");
    expect(jaOverview).toMatch(/<h1\b[^>]*>Claude<\/h1>/);
    expect(jaOverview).toContain("Claude Code の設定リファレンス。");
    expect(jaOverview).toContain(">リソース<");

    expect(readDistFile("de/docs/claude/index.html")).toMatch(
      /<h1\b[^>]*>Claude<\/h1>/,
    );
    expect(readDistFile("ja/docs/codex/index.html")).toContain(
      "OpenAI Codex の設定リファレンス。",
    );
    expect(readDistFile("de/docs/codex/index.html")).toMatch(
      /<h1\b[^>]*>Codex<\/h1>/,
    );
  });

  test("keeps fallback resource bodies out of JA llms and search", () => {
    const jaLlms = readDistFile("ja/llms.txt");
    expect(jaLlms).toMatch(/^\s*- \[Claude\]\(\/ja\/docs\/claude\):/m);
    expect(jaLlms).not.toMatch(
      /\/ja\/docs\/claude-skills\/localized-shell(?:\/|\b)/,
    );

    const searchEntries = JSON.parse(
      readDistFile("search-index.json"),
    ) as SearchEntry[];
    const urls = searchEntries.map(({ url }) => url);
    expect(urls).toContain("/ja/docs/claude");
    expect(urls).not.toContain(GENERATED_SKILL_ROUTE);
    expect(urls).not.toContain(GENERATED_SKILL_PATH);
  });

  test("preserves the locale in asset-index viewer links", () => {
    const jaIndex = readDistFile("ja/files/index.html");
    expect(jaIndex).toMatch(
      /href=["']?\/ja\/files\/locale-diagram\.svg\/?["']?(?=\s|>)/,
    );
    expect(jaIndex).not.toMatch(
      /href=["']?\/files\/locale-diagram\.svg\/?["']?(?=\s|>)/,
    );
  });
});

test.describe("i18n generated pages: localized resource shell", () => {
  test("renders Japanese chrome around the default-locale skill body", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    const response = await page.goto(GENERATED_SKILL_PATH, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);

    await expect(page.locator("h1")).toHaveText("localized-shell");
    await expect(
      page.locator("article h2#default-locale-resource-body"),
    ).toHaveText("Default-locale resource body");
    await expect(
      page.getByText("This English source body belongs to the default locale."),
    ).toBeVisible();
    await expect(page.locator('[role="note"]')).toHaveCount(0);

    await waitForSidebarHydration(page);
    const sidebar = desktopSidebar(page);
    await expect(sidebar.getByText("Claude", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("スキル", { exact: true })).toBeVisible();

    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumb.getByText("スキル", { exact: true })).toBeVisible();
    await expect(page.locator("header [data-language-toggle]")).toHaveAttribute(
      "aria-label",
      "言語",
    );
    assertNoConsoleErrors();
  });

  test("renders Japanese labels for the Codex resource sidebar", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    const response = await page.goto(
      "/ja/docs/codex-config/config-toml/",
      { waitUntil: "domcontentloaded" },
    );
    expect(response?.status()).toBe(200);

    await expect(page.locator("h1")).toHaveText("config.toml");
    await waitForSidebarHydration(page);
    const sidebar = desktopSidebar(page);
    await expect(sidebar.getByText("Codex", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("設定", { exact: true })).toBeVisible();

    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumb.getByText("設定", { exact: true })).toBeVisible();
    assertNoConsoleErrors();
  });

  test("offers EN and JA links on a fallback resource body", async ({ page }) => {
    await page.goto(GENERATED_SKILL_PATH, { waitUntil: "domcontentloaded" });

    const switcher = page.locator("[data-language-switcher]");
    await expect(switcher).toBeVisible();
    await expect(switcher.locator('[aria-current="page"]')).toHaveAttribute(
      "lang",
      "ja",
    );
    await expect(switcher.locator('a[lang="en"]')).toHaveAttribute(
      "href",
      "/docs/claude-skills/localized-shell/",
    );
    await expect(switcher.locator('a[lang="de"]')).toHaveAttribute(
      "href",
      "/de/docs/claude-skills/localized-shell/",
    );
  });
});

test.describe("i18n generated pages: localized asset viewer", () => {
  test("localizes an authored Markdown asset link", async ({ page }) => {
    const response = await page.goto("/ja/docs/getting-started", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);

    const article = page.locator("article");
    const assetLink = article.getByRole("link", { name: "ロケール図" });
    await expect(assetLink).toHaveAttribute("href", JA_ASSET_PATH);
    await expect(
      article.locator('a[href="/files/locale-diagram.svg/"]'),
    ).toHaveCount(0);
  });

  test("renders the Japanese asset shell and image controls", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    const response = await page.goto(JA_ASSET_PATH, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);

    await expect(page.locator("h1")).toHaveText("locale-diagram.svg");
    for (const label of ["アセット", "詳細", "種類", "全体表示", "チェッカー"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    const switcher = page.locator("header [data-language-switcher]");
    await expect(switcher).toBeVisible();
    await expect(switcher.locator('[aria-current="page"]')).toHaveAttribute(
      "lang",
      "ja",
    );
    // Asset viewers are directory-form routes even though ordinary fixture
    // docs inherit trailingSlash: false.
    await expect(switcher.locator('a[lang="en"]')).toHaveAttribute(
      "href",
      "/files/locale-diagram.svg/",
    );
    await expect(switcher.locator('a[lang="de"]')).toHaveAttribute(
      "href",
      "/de/files/locale-diagram.svg/",
    );
    assertNoConsoleErrors();
  });
});
