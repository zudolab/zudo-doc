import { expect, type Locator, type Page } from "@playwright/test";
import { test } from "./fixtures";
import { desktopSidebar, waitForSidebarHydration } from "./sidebar-helpers";
import { closeMobileDrawer, openMobileDrawer } from "./mobile-drawer-helpers";
import { spaClickSelector } from "./nav-helpers";

const DEEP_PAGE = `/docs/guides/deep/${Array.from({ length: 11 }, (_, index) => `level-${String(index + 2).padStart(2, "0")}`).join("/")}/page`;
const BOUNDED_PAGE = "/docs/bounded/utility/surfaces/background";

type Shot = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  href: string | null;
  rowOffset: number | null;
};

function linkSelector(href: string): string {
  const bare = href.replace(/\/$/, "");
  return `#desktop-sidebar a[href="${bare}"], #desktop-sidebar a[href="${bare}/"]`;
}

async function settleFrames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function readDesktop(page: Page): Promise<Shot> {
  return desktopSidebar(page).evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const link = [...element.querySelectorAll<HTMLAnchorElement>("a[href]")].find((candidate) => {
      if (candidate.getAttribute("aria-current") === "page") return false;
      const rect = candidate.getBoundingClientRect();
      return rect.height > 0 && rect.top >= bounds.top + 8 && rect.bottom <= bounds.bottom - 8;
    });
    const rect = link?.getBoundingClientRect();
    return {
      scrollTop: element.scrollTop,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      href: link?.getAttribute("href") ?? null,
      rowOffset: rect ? rect.top - bounds.top : null,
    };
  });
}

async function scrollDesktop(page: Page, top: number): Promise<number> {
  await desktopSidebar(page).evaluate((element, value) => {
    element.scrollTop = value as number;
  }, top);
  await settleFrames(page);
  return desktopSidebar(page).evaluate((element) => element.scrollTop);
}

/**
 * Place a Guides link at `offset` px inside the sidebar.
 * The chosen link must still have room below it, so the offset is not the
 * bottom edge a later reveal would produce, and the resulting scroll is nonzero.
 */
async function placeGuidesLink(page: Page, offset: number): Promise<Shot> {
  const shot = await desktopSidebar(page).evaluate((element, rowOffset) => {
    const bounds = element.getBoundingClientRect();
    const maxScroll = element.scrollHeight - element.clientHeight;
    const links = [...element.querySelectorAll<HTMLAnchorElement>("a[href]")].filter((candidate) => {
      const href = candidate.getAttribute("href") ?? "";
      return candidate.getAttribute("aria-current") !== "page" && href.includes("/docs/guides/") && candidate.getClientRects().length > 0;
    });
    const link = links.find((candidate) => {
      const natural = element.scrollTop + candidate.getBoundingClientRect().top - bounds.top;
      const desired = natural - (rowOffset as number);
      return desired > 100 && desired <= maxScroll + 0.5;
    }) ?? null;
    if (!link) {
      return {
        scrollTop: element.scrollTop,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        href: null,
        rowOffset: null,
      };
    }
    const natural = element.scrollTop + link.getBoundingClientRect().top - bounds.top;
    element.scrollTop = natural - (rowOffset as number);
    const next = link.getBoundingClientRect();
    return {
      scrollTop: element.scrollTop,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      href: link.getAttribute("href"),
      rowOffset: next.top - element.getBoundingClientRect().top,
    };
  }, offset);
  await settleFrames(page);
  return shot;
}

async function rowOffset(page: Page, href: string): Promise<number | null> {
  const bare = href.replace(/\/$/, "");
  return desktopSidebar(page).evaluate((element, id) => {
    const link = [...element.querySelectorAll<HTMLAnchorElement>("a[href]")].find((candidate) => {
      const value = candidate.getAttribute("href") ?? "";
      return value.replace(/\/$/, "") === id;
    });
    if (!link) return null;
    const rect = link.getBoundingClientRect();
    if (rect.height === 0) return null;
    return rect.top - element.getBoundingClientRect().top;
  }, bare);
}

async function broadenToCeiling(sidebar: Locator): Promise<void> {
  for (let step = 0; step < 6; step += 1) {
    const button = sidebar.locator("[data-sidebar-broaden]");
    if ((await button.count()) === 0) return;
    await button.click();
  }
}

async function expectPreservedRow(page: Page, before: Shot): Promise<void> {
  expect(before.href).toBeTruthy();
  expect(before.rowOffset).not.toBeNull();
  await expect.poll(async () => rowOffset(page, before.href!)).not.toBeNull();
  const offset = await rowOffset(page, before.href!);
  expect(Math.abs((offset ?? 0) - (before.rowOffset ?? 0))).toBeLessThanOrEqual(2);
  const after = await readDesktop(page);
  if (Math.abs(after.scrollHeight - before.scrollHeight) <= 2) {
    expect(Math.abs(after.scrollTop - before.scrollTop)).toBeLessThanOrEqual(2);
  }
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
}

test("local guides navigation keeps the sidebar offset and the clicked row", async ({ page, assertNoConsoleErrors }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await page.goto(DEEP_PAGE);
  await waitForSidebarHydration(page);
  const before = await placeGuidesLink(page, 36);
  expect(before.scrollHeight).toBeGreaterThan(before.clientHeight + 150);
  expect(before.scrollTop).toBeGreaterThan(100);
  expect(before.href).toContain("/docs/guides/");
  expect(Math.abs((before.rowOffset ?? 0) - 36)).toBeLessThanOrEqual(2);
  const article = await page.evaluate(() => window.scrollY);
  expect(await spaClickSelector(page, linkSelector(before.href!))).toBe(true);
  await waitForSidebarHydration(page);
  await expectPreservedRow(page, before);
  expect(await page.evaluate(() => window.scrollY)).toBe(article);
  const sidebar = desktopSidebar(page);
  await sidebar.getByRole("textbox", { name: "Filter navigation" }).fill("no-such-sidebar-row");
  await expect(sidebar.locator('a[aria-current="page"]')).toHaveCount(0);
  await sidebar.getByRole("textbox").fill("");
  await expect(sidebar.locator('a[aria-current="page"]')).toBeVisible();
  assertNoConsoleErrors();
});

test("full-forest navigation after Broaden keeps a nonzero sidebar offset", async ({ page, assertNoConsoleErrors }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await page.goto(DEEP_PAGE);
  await waitForSidebarHydration(page);
  const sidebar = desktopSidebar(page);
  await broadenToCeiling(sidebar);
  await expect(sidebar.locator("[data-sidebar-scope-toolbar]")).toHaveCount(0);
  await expect(sidebar.locator('[data-sidebar-focus][data-sidebar-tip-detail="Guides"]')).toHaveCount(1);
  await expect(sidebar.getByRole("link", { name: "Getting Started", exact: true })).toHaveCount(1);
  await expect(sidebar.getByRole("link", { name: "Wind", exact: true })).toHaveCount(1);
  const before = await placeGuidesLink(page, 36);
  expect(before.scrollTop).toBeGreaterThan(100);
  expect(before.href).toContain("/docs/guides/");
  expect(Math.abs((before.rowOffset ?? 0) - 36)).toBeLessThanOrEqual(2);
  expect(await spaClickSelector(page, linkSelector(before.href!))).toBe(true);
  await waitForSidebarHydration(page);
  await expectPreservedRow(page, before);
  await expect(sidebar.locator("[data-sidebar-scope-toolbar]")).toHaveCount(0);
  assertNoConsoleErrors();
});

test("full document load, reload, and Back/Forward keep the sidebar offset", async ({ page, assertNoConsoleErrors }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await page.goto(DEEP_PAGE);
  await waitForSidebarHydration(page);
  await broadenToCeiling(desktopSidebar(page));
  const first = await placeGuidesLink(page, 36);
  expect(first.scrollTop).toBeGreaterThan(100);
  expect(first.href).toContain("/docs/guides/");
  expect(Math.abs((first.rowOffset ?? 0) - 36)).toBeLessThanOrEqual(2);
  const target = new URL(first.href!, page.url());
  const link = page.locator(linkSelector(first.href!)).first();
  await link.evaluate((anchor) => anchor.setAttribute("data-zfb-reload", ""));
  await Promise.all([
    page.waitForURL((url) => url.pathname.replace(/\/$/, "") === target.pathname.replace(/\/$/, "")),
    link.click(),
  ]);
  await waitForSidebarHydration(page);
  await expectPreservedRow(page, first);

  const secondTop = await scrollDesktop(page, 40);
  expect(Math.abs(secondTop - first.scrollTop)).toBeGreaterThan(40);
  await expect.poll(() => page.evaluate(() => {
    const state = history.state as { zdSidebarScroll?: { desktop?: { scrollTop?: number } } } | null;
    return state?.zdSidebarScroll?.desktop?.scrollTop ?? -1;
  })).toBeGreaterThanOrEqual(secondTop - 2);
  await page.reload();
  await waitForSidebarHydration(page);
  await expect.poll(async () => desktopSidebar(page).evaluate((element) => element.scrollTop)).toBeGreaterThanOrEqual(secondTop - 2);
  await expect.poll(async () => desktopSidebar(page).evaluate((element) => element.scrollTop)).toBeLessThanOrEqual(secondTop + 2);

  await page.goBack();
  await waitForSidebarHydration(page);
  await expectPreservedRow(page, first);
  await page.goForward();
  await waitForSidebarHydration(page);
  await expect.poll(async () => desktopSidebar(page).evaluate((element) => element.scrollTop)).toBeGreaterThanOrEqual(secondTop - 2);
  await expect.poll(async () => desktopSidebar(page).evaluate((element) => element.scrollTop)).toBeLessThanOrEqual(secondTop + 2);
  assertNoConsoleErrors();
});

type SidebarHistorySlot = {
  scrollTop: number;
  contextId: string;
  viewKey: string;
  anchorId: string;
  anchorOffset: number;
};

async function readSidebarEntry(page: Page) {
  return desktopSidebar(page).evaluate((element) => {
    const state = history.state as {
      index: number;
      scrollX: number;
      scrollY: number;
      entryMarker?: string;
      zdSidebarScroll?: { desktop?: SidebarHistorySlot };
    };
    const slot = state.zdSidebarScroll?.desktop;
    const anchor = slot && [...element.querySelectorAll<HTMLElement>("[data-sidebar-focus-scope], a[href]")]
      .find((row) => (row.dataset.sidebarFocusScope || row.getAttribute("href")) === slot.anchorId);
    return {
      index: state.index,
      scrollX: state.scrollX,
      scrollY: state.scrollY,
      entryMarker: state.entryMarker,
      context: element.querySelector("nav")?.dataset.sidebarContext,
      liveOffset: element.scrollTop,
      liveAnchorOffset: anchor ? anchor.getBoundingClientRect().top - element.getBoundingClientRect().top : null,
      slot,
    };
  });
}

async function markSidebarEntry(page: Page, entryMarker: string) {
  await page.evaluate((marker) => history.replaceState({ ...history.state, entryMarker: marker }, ""), entryMarker);
}

async function traverseSidebarEntry(page: Page, direction: "back" | "forward", nextOffset?: number) {
  await desktopSidebar(page).evaluate((element, { direction, nextOffset }) => {
    return new Promise<void>((resolve) => {
      document.addEventListener("zfb:after-swap", () => resolve(), { once: true });
      if (nextOffset !== undefined) {
        element.scrollTop = nextOffset;
        // Queue the sidebar's persistence in the same task that starts browser traversal.
        element.dispatchEvent(new Event("scroll"));
      }
      history[direction]();
    });
  }, { direction, nextOffset });
}

test("same-document Back and Forward keep each sidebar context's own history", async ({ page, assertNoConsoleErrors }) => {
  await page.setViewportSize({ width: 1280, height: 255 });
  const documents: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
  });
  await page.goto(`${DEEP_PAGE}/`);
  await waitForSidebarHydration(page);
  const withinGuides = await placeGuidesLink(page, 36);
  expect(withinGuides.scrollTop).toBeGreaterThan(100);
  expect(withinGuides.href).toBeTruthy();
  expect(await spaClickSelector(page, linkSelector(withinGuides.href!))).toBe(true);
  await waitForSidebarHydration(page);
  await expectPreservedRow(page, withinGuides);
  await markSidebarEntry(page, "guides");
  const guides = await readSidebarEntry(page);
  expect(guides.slot).toMatchObject({
    scrollTop: guides.liveOffset,
    contextId: guides.context,
    viewKey: expect.any(String),
    anchorId: expect.any(String),
    anchorOffset: guides.liveAnchorOffset,
  });
  const guidesPath = new URL(page.url()).pathname;

  expect(await spaClickSelector(page, 'header a[href="/docs/notes"], header a[href="/docs/notes/"]')).toBe(true);
  await expect(desktopSidebar(page).getByRole("link", { name: /First Note/ })).toBeVisible();
  await markSidebarEntry(page, "notes");
  const notesOffset = await scrollDesktop(page, 25);
  expect(notesOffset).toBeGreaterThan(10);
  expect(notesOffset).toBeLessThan(guides.liveOffset - 30);
  await expect.poll(async () => (await readSidebarEntry(page)).slot?.scrollTop).toBe(notesOffset);
  const notes = await readSidebarEntry(page);
  expect(notes.context).not.toBe(guides.context);
  expect(notes.slot).toMatchObject({
    contextId: notes.context,
    viewKey: expect.any(String),
    anchorId: expect.any(String),
    anchorOffset: notes.liveAnchorOffset,
  });
  expect(notes.slot?.viewKey).not.toBe(guides.slot?.viewKey);
  expect(notes.index).not.toBe(guides.index);

  await traverseSidebarEntry(page, "back");
  await expect.poll(() => readSidebarEntry(page)).toEqual(guides);
  await traverseSidebarEntry(page, "forward");
  await expect.poll(() => readSidebarEntry(page)).toEqual(notes);

  await traverseSidebarEntry(page, "back", notesOffset - 5);
  await expect.poll(() => readSidebarEntry(page)).toEqual(guides);
  await traverseSidebarEntry(page, "forward", guides.liveOffset - 12);
  await expect.poll(() => readSidebarEntry(page)).toMatchObject({
    index: notes.index,
    scrollX: notes.scrollX,
    scrollY: notes.scrollY,
    entryMarker: "notes",
    context: notes.context,
    liveOffset: notesOffset - 5,
    slot: { contextId: notes.context, viewKey: notes.slot?.viewKey, scrollTop: notesOffset - 5 },
  });
  await traverseSidebarEntry(page, "back");
  await expect.poll(() => readSidebarEntry(page)).toMatchObject({
    index: guides.index,
    scrollX: guides.scrollX,
    scrollY: guides.scrollY,
    entryMarker: "guides",
    context: guides.context,
    liveOffset: guides.liveOffset - 12,
    slot: { contextId: guides.context, viewKey: guides.slot?.viewKey, scrollTop: guides.liveOffset - 12 },
  });
  expect(documents).toHaveLength(1);

  const beforeReload = await readSidebarEntry(page);
  expect(new URL(page.url()).pathname).toBe(guidesPath);
  await page.reload();
  await waitForSidebarHydration(page);
  await expect.poll(() => readSidebarEntry(page)).toEqual(beforeReload);
  expect(documents).toHaveLength(2);
  assertNoConsoleErrors();
});

test("desktop and mobile offsets stay independent across navigation", async ({ page, assertNoConsoleErrors }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto(DEEP_PAGE);
  await openMobileDrawer(page);
  const drawer = page.locator("[data-zd-mobile-sidebar] .flex-1.overflow-y-auto");
  await drawer.evaluate((element, value) => {
    element.scrollTop = value as number;
  }, 180);
  await settleFrames(page);
  const mobileBefore = await drawer.evaluate((element) => element.scrollTop);
  expect(mobileBefore).toBeGreaterThan(100);
  await closeMobileDrawer(page);

  await page.setViewportSize({ width: 1280, height: 640 });
  await waitForSidebarHydration(page);
  const desktop = await placeGuidesLink(page, 36);
  expect(desktop.scrollTop).toBeGreaterThan(100);
  expect(desktop.href).toContain("/docs/guides/");
  expect(Math.abs(desktop.scrollTop - mobileBefore)).toBeGreaterThan(20);
  expect(await spaClickSelector(page, linkSelector(desktop.href!))).toBe(true);
  await waitForSidebarHydration(page);
  await expectPreservedRow(page, desktop);

  await page.setViewportSize({ width: 390, height: 700 });
  await openMobileDrawer(page);
  await expect.poll(async () => drawer.evaluate((element) => element.scrollTop)).toBeGreaterThanOrEqual(mobileBefore - 2);
  await expect.poll(async () => drawer.evaluate((element) => element.scrollTop)).toBeLessThanOrEqual(mobileBefore + 2);
  assertNoConsoleErrors();
});

test("configured notes section does not broaden into other roots", async ({ page, assertNoConsoleErrors }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/docs/notes/first-note");
  const sidebar = desktopSidebar(page);
  await sidebar.locator("nav").waitFor({ state: "attached" });
  await expect(sidebar.getByRole("link", { name: /First Note/ })).toBeVisible();
  await expect(sidebar.locator("[data-sidebar-broaden]")).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: "Guides", exact: true })).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: "Getting Started", exact: true })).toHaveCount(0);
  await page.reload();
  await sidebar.locator("nav").waitFor({ state: "attached" });
  await expect(sidebar.locator("[data-sidebar-broaden]")).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: "Guides", exact: true })).toHaveCount(0);
  assertNoConsoleErrors();
});

for (const width of [1280, 390]) {
  test(`configured nested directory stops at Bounded Wind at ${width}px`, async ({ page, assertNoConsoleErrors }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(BOUNDED_PAGE);
    const container = width < 1024
      ? page.locator("[data-zd-mobile-sidebar]")
      : desktopSidebar(page);
    if (width < 1024) await openMobileDrawer(page);
    else await waitForSidebarHydration(page);
    await expect(container.locator('[data-sidebar-focus][data-sidebar-tip-detail="Surfaces"]')).toBeVisible();
    await expect(container.getByRole("link", { name: "Background", exact: true })).toBeVisible();
    await expect(container.getByRole("link", { name: "Utility reference", exact: true })).toHaveCount(0);
    await expect(container.getByRole("link", { name: "Bounded Wind", exact: true })).toHaveCount(0);
    await container.locator("[data-sidebar-broaden]").click();
    await expect(container.locator('[data-sidebar-focus][data-sidebar-tip-detail="Utility reference"]')).toBeVisible();
    await container.locator("[data-sidebar-restore]").click();
    await expect(container.locator('[data-sidebar-focus][data-sidebar-tip-detail="Surfaces"]')).toBeVisible();
    await container.locator("[data-sidebar-broaden]").click();
    await container.locator("[data-sidebar-broaden]").click();
    await expect(container.locator('[data-sidebar-focus][data-sidebar-tip-detail="Bounded Wind"]')).toBeVisible();
    await expect(container.locator("[data-sidebar-scope-toolbar]")).toHaveCount(0);
    await expect(container.getByRole("link", { name: "Guides", exact: true })).toHaveCount(0);
    await expect(container.locator('[data-sidebar-focus][data-sidebar-tip-detail="Guides"]')).toHaveCount(0);
    assertNoConsoleErrors();
  });
}
