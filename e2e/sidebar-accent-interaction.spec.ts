import { test, expect } from "./fixtures";
import { spaClick } from "./nav-helpers";
import { desktopSidebar } from "./sidebar-helpers";
import type { Locator, Page } from "@playwright/test";

/**
 * Hover / keyboard-focus accent for note-tray rows. Every assertion reads the
 * computed color of a VISIBLE descendant (rank, date, label) rather than the
 * anchor, because the regression was descendants keeping their own muted/fg
 * color while the anchor around them turned accent.
 */

type Tokens = { accent: string; fg: string; muted: string; bg: string };

async function resolveTokens(page: Page): Promise<Tokens> {
  return page.evaluate(() => {
    const probe = document.createElement("span");
    document.body.append(probe);
    const read = (name: string) => {
      probe.style.color = `var(${name})`;
      return getComputedStyle(probe).color;
    };
    const tokens = {
      accent: read("--color-accent"),
      fg: read("--color-fg"),
      muted: read("--color-muted"),
      bg: read("--color-bg"),
    };
    probe.remove();
    return tokens;
  });
}

function colorOf(locator: Locator): Promise<string> {
  return locator.evaluate((el) => getComputedStyle(el).color);
}

async function expectColor(locator: Locator, expected: string) {
  await expect.poll(() => colorOf(locator)).toBe(expected);
}

/** Park the pointer away from every row, then keyboard-focus `target`. */
async function keyboardFocus(page: Page, target: Locator) {
  await page.mouse.move(1, 1);
  await page.keyboard.press("Shift");
  await target.focus();
  expect(await target.evaluate((el) => el.matches(":focus-visible"))).toBe(true);
  expect(await target.evaluate((el) => el.matches(":hover"))).toBe(false);
}

async function blur(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(1, 1);
}

test.describe("Note-tray accent interaction", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("numbered index rank, label and description turn accent together on hover and focus-visible", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto("/docs/notes", { waitUntil: "load" });
    const t = await resolveTokens(page);
    expect(t.accent).not.toBe(t.fg);

    const rows = page.locator("main ol.zd-list-items-no-margin > li > a");
    await expect(rows).toHaveCount(5);
    const row = rows.nth(1);
    const neighbour = rows.nth(0);
    const parts = (a: Locator) => {
      const spans = a.locator(":scope > span");
      return {
        rank: spans.nth(0),
        label: spans.nth(1).locator(":scope > span").nth(0),
        detail: spans.nth(1).locator(":scope > span").nth(1),
      };
    };
    const p = parts(row);
    const n = parts(neighbour);

    await expectColor(p.rank, t.muted);
    await expectColor(p.label, t.fg);
    await expectColor(p.detail, t.muted);

    await row.hover();
    await expectColor(p.rank, t.accent);
    await expectColor(p.label, t.accent);
    await expectColor(p.detail, t.accent);
    await expectColor(n.rank, t.muted);
    await expectColor(n.label, t.fg);

    await keyboardFocus(page, row);
    await expectColor(p.rank, t.accent);
    await expectColor(p.label, t.accent);
    await expectColor(p.detail, t.accent);
    await expectColor(n.rank, t.muted);

    await blur(page);
    await expectColor(p.rank, t.muted);
    assertNoConsoleErrors();
  });

  test("linked index and card dates follow their own link's accent", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto("/docs/dated-index", { waitUntil: "load" });
    const t = await resolveTokens(page);

    const rows = page.locator("main ol.zd-list-items-no-margin > li > a");
    await expect(rows.first()).toBeVisible();
    const row = rows.first();
    const time = row.locator("time").first();
    await expect(time).toBeVisible();
    await expectColor(time, t.muted);
    await row.hover();
    await expectColor(time, t.accent);
    await expectColor(rows.nth(1).locator("time").first(), t.muted);
    await keyboardFocus(page, row);
    await expectColor(time, t.accent);
    await blur(page);
    await expectColor(time, t.muted);

    // Wide cards: the DateStamp column.
    await page.goto("/docs/series-year", { waitUntil: "load" });
    const cards = page.locator("main a.group");
    await expect(cards.first()).toBeVisible();
    const card = cards.first();
    const stamp = card.locator(":scope > time");
    const stampDay = stamp.locator("span").first();
    await expect(stamp).toBeVisible();
    await expectColor(stampDay, t.muted);
    await card.hover();
    await expectColor(stampDay, t.accent);
    await expectColor(cards.nth(1).locator(":scope > time span").first(), t.muted);
    await keyboardFocus(page, card);
    await expectColor(stampDay, t.accent);
    await blur(page);

    // Narrow cards: the compact DateLine replaces the stamp.
    await page.setViewportSize({ width: 390, height: 844 });
    const lineTime = card.locator("h2 + span time").first();
    await expect(lineTime).toBeVisible();
    await expect(stamp).toBeHidden();
    await expectColor(lineTime, t.muted);
    await card.hover();
    await expectColor(lineTime, t.accent);
    await keyboardFocus(page, card);
    await expectColor(lineTime, t.accent);
    assertNoConsoleErrors();
  });

  test("sidebar tray rank and date move with the inactive label; current rows keep inverted ink", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto("/docs/notes/second-note", { waitUntil: "load" });
    const sidebar = desktopSidebar(page);
    const t = await resolveTokens(page);

    const first = sidebar.locator('nav a[href$="/first-note"], nav a[href$="/first-note/"]').first();
    const third = sidebar.locator('nav a[href$="/third-note"], nav a[href$="/third-note/"]').first();
    await expect(first).toBeVisible();
    const rank = first.locator(":scope > span").first();
    const label = first.locator(":scope > span").nth(1);
    await expectColor(rank, t.muted);
    await expectColor(label, t.muted);

    await first.hover();
    await expectColor(rank, t.accent);
    await expectColor(label, t.accent);
    await expectColor(third.locator(":scope > span").first(), t.muted);

    await keyboardFocus(page, first);
    await expectColor(rank, t.accent);
    await expectColor(label, t.accent);
    await blur(page);

    const current = sidebar.locator('nav a[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toContainText("Second Note");
    await expectColor(current.locator(":scope > span").first(), t.bg);
    await current.hover();
    await expectColor(current.locator(":scope > span").first(), t.bg);
    expect(await current.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(t.fg);

    // Client-side navigation to a dated tray: the sidebar date follows too.
    expect(await spaClick(page, "/docs/notes")).toBe(true);
    const root = sidebar.locator('nav a[aria-current="page"]');
    await expect(root).toHaveCount(1);
    await root.hover();
    await expectColor(root, t.bg);
    expect(await root.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(t.fg);

    await page.goto("/docs/journal/journal-middle", { waitUntil: "load" });
    const july = sidebar.getByRole("button", { name: "Expand 2026 July", exact: true });
    await july.click();
    const dated = sidebar.getByRole("link", { name: /Journal July/ });
    await expect(dated).toBeVisible();
    const date = dated.locator(":scope > span").last();
    await expectColor(date, t.muted);
    await dated.hover();
    await expectColor(date, t.accent);
    assertNoConsoleErrors();
  });

  test("site-tree note-tray rows tint their own rank/date only", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto("/", { waitUntil: "load" });
    const t = await resolveTokens(page);

    const rows = page.locator("[data-note-tray-row]");
    await expect(rows.first()).toBeVisible();
    const ranked = rows.filter({ hasText: "First Note" }).first();
    const sibling = rows.filter({ hasText: "Second Note" }).first();
    const rank = ranked.locator(":scope > span").first();
    const label = ranked.locator(":scope > span").last();
    await expectColor(rank, t.muted);
    await expectColor(label, t.fg);

    await ranked.hover();
    await expectColor(rank, t.accent);
    await expectColor(label, t.accent);
    await expectColor(sibling.locator(":scope > span").first(), t.muted);
    await expectColor(sibling.locator(":scope > span").last(), t.fg);

    await keyboardFocus(page, ranked);
    await expectColor(rank, t.accent);
    await expectColor(label, t.accent);
    await expectColor(sibling.locator(":scope > span").first(), t.muted);
    await blur(page);

    const datedRow = rows.filter({ has: page.locator("time") }).first();
    const time = datedRow.locator("time");
    await expect(time).toBeVisible();
    await expectColor(time, t.muted);
    await datedRow.hover();
    await expectColor(time, t.accent);
    await keyboardFocus(page, datedRow);
    await expectColor(time, t.accent);
    assertNoConsoleErrors();
  });
});
