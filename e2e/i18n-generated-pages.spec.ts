import { expect, test } from "./fixtures";
import { makeDistReader } from "./dist-helper";
import { desktopSidebar, waitForSidebarHydration } from "./sidebar-helpers";

const { readDistFile } = makeDistReader("i18n");
const GENERATED_SKILL_PATH = "/ja/docs/claude-skills/localized-shell/";

type SearchEntry = {
  url: string;
};

test.use({ viewport: { width: 1280, height: 900 } });

test.describe("i18n generated pages: static locale coverage", () => {
  test("emits localized resource overviews in every configured locale", () => {
    const jaOverview = readDistFile("ja/docs/claude/index.html");
    expect(jaOverview).toContain(">Claude<");
    expect(jaOverview).toContain("Claude Code の設定リファレンス。");
    expect(jaOverview).toContain(">リソース<");

    expect(readDistFile("de/docs/claude/index.html")).toContain(">Claude<");
    expect(readDistFile("ja/docs/codex/index.html")).toContain(
      "OpenAI Codex の設定リファレンス。",
    );
    expect(readDistFile("de/docs/codex/index.html")).toContain(">Codex<");
  });

  test("keeps fallback resource bodies out of JA llms and search", () => {
    const jaLlms = readDistFile("ja/llms.txt");
    expect(jaLlms).toContain("/ja/docs/claude/");
    expect(jaLlms).not.toContain(GENERATED_SKILL_PATH);

    const searchEntries = JSON.parse(
      readDistFile("search-index.json"),
    ) as SearchEntry[];
    const urls = searchEntries.map(({ url }) => url);
    expect(urls).toContain("/ja/docs/claude/");
    expect(urls).not.toContain(GENERATED_SKILL_PATH);
  });

  test("preserves the locale in asset-index viewer links", () => {
    const jaIndex = readDistFile("ja/files/index.html");
    expect(jaIndex).toContain('href="/ja/files/locale-diagram.svg/"');
    expect(jaIndex).not.toContain('href="/files/locale-diagram.svg/"');
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
    await expect(page.getByText("Default-locale resource body")).toBeVisible();
    await expect(
      page.getByText("This English source body belongs to the default locale."),
    ).toBeVisible();
    await expect(page.locator('[role="note"]')).toHaveCount(0);

    await waitForSidebarHydration(page);
    const sidebar = desktopSidebar(page);
    await expect(sidebar.getByText("Claude", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("Codex", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("スキル", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("設定", { exact: true })).toBeVisible();

    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumb.getByText("スキル", { exact: true })).toBeVisible();
    await expect(page.locator("header [data-language-toggle]")).toHaveAttribute(
      "aria-label",
      "言語",
    );
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
  test("renders the Japanese asset shell and image controls", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    const response = await page.goto("/ja/files/locale-diagram.svg/", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);

    await expect(page.locator("h1")).toHaveText("locale-diagram.svg");
    for (const label of ["アセット", "詳細", "種類", "全体表示", "チェッカー"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await expect(page.locator("[data-language-switcher]")).toBeVisible();
    assertNoConsoleErrors();
  });
});
