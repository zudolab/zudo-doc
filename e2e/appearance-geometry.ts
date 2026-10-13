import type { Locator, Page } from "@playwright/test";
import { expect } from "./fixtures";
import { openMobileDrawer } from "./mobile-drawer-helpers";

const TRIGGERS = '[data-zd-theme-menu] > button[aria-haspopup="menu"]';

export interface AppearanceGeometry {
  scrollHeight: number;
  clientHeight: number;
  scrollWidth: number;
  clientWidth: number;
  menu: { top: number; bottom: number; left: number; right: number; width: number };
  trigger: { top: number; bottom: number; width: number; height: number };
  viewport: { width: number; height: number };
  rowHeights: number[];
  rowsInsideMenu: boolean;
  systemPartsOverlap: boolean;
  deviceStatus: string;
  documentOverflowsX: boolean;
}

export interface ScrollState {
  windowY: number;
  drawerTop: number;
}

/**
 * Width of a classic (space-taking) scrollbar on an overflowing probe. Zero
 * means scrollbars are overlay/hidden and geometry assertions would not prove
 * the classic-scrollbar case from #4567.
 */
export function classicScrollbarGutter(page: Page): Promise<number> {
  return page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll;border:0";
    document.body.append(probe);
    const gutter = probe.offsetWidth - probe.clientWidth;
    probe.remove();
    return gutter;
  });
}

export function readScrollState(page: Page): Promise<ScrollState> {
  return page.evaluate(() => ({
    windowY: window.scrollY,
    drawerTop: document.querySelector("[data-zd-mobile-sidebar]")?.scrollTop ?? 0,
  }));
}

/**
 * The header trigger when it is inside the viewport, otherwise the mobile
 * drawer's sidebar-footer instance (opening the drawer first).
 */
export async function visibleAppearanceTrigger(page: Page): Promise<Locator> {
  const header = page.locator(`header .ml-auto ${TRIGGERS}`).first();
  if (await header.isVisible() && await header.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight;
  })) return header;
  await openMobileDrawer(page);
  const drawerTrigger = page.locator(`[data-zd-mobile-sidebar] ${TRIGGERS}`);
  await drawerTrigger.scrollIntoViewIfNeeded();
  return drawerTrigger;
}

export async function measureAppearanceMenu(menu: Locator, trigger: Locator): Promise<AppearanceGeometry> {
  const triggerBox = await trigger.boundingBox();
  expect(triggerBox).not.toBeNull();
  const geometry = await menu.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const rows = [...el.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
    const inside = rows.every((row) => {
      const r = row.getBoundingClientRect();
      return r.top >= rect.top && r.bottom <= rect.bottom && r.left >= rect.left && r.right <= rect.right;
    });
    const system = rows[2]!;
    const parts = [...system.querySelectorAll<HTMLElement>(":scope > span")]
      .map((span) => span.getBoundingClientRect())
      .filter((r) => r.width > 0);
    const overlap = parts.some((a, i) => parts.slice(i + 1).some((b) =>
      a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5));
    const root = document.documentElement;
    return {
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      menu: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width },
      viewport: { width: root.clientWidth, height: root.clientHeight },
      rowHeights: rows.map((row) => row.getBoundingClientRect().height),
      rowsInsideMenu: inside,
      systemPartsOverlap: overlap,
      deviceStatus: system.querySelector("[data-zd-device-mode]")?.textContent ?? "",
      documentOverflowsX: root.scrollWidth > root.clientWidth,
    };
  });
  return {
    ...geometry,
    trigger: { top: triggerBox!.y, bottom: triggerBox!.y + triggerBox!.height, width: triggerBox!.width, height: triggerBox!.height },
  };
}

/** The #4567 acceptance shape: natural fit, inside the viewport, no overlap. */
export function expectNaturalFit(geometry: AppearanceGeometry, deviceLabel: string): void {
  expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  expect(geometry.menu.top).toBeGreaterThanOrEqual(0);
  expect(geometry.menu.left).toBeGreaterThanOrEqual(0);
  expect(geometry.menu.bottom).toBeLessThanOrEqual(geometry.viewport.height);
  expect(geometry.menu.right).toBeLessThanOrEqual(geometry.viewport.width);
  expect(geometry.rowsInsideMenu).toBe(true);
  expect(geometry.rowHeights).toHaveLength(3);
  for (const height of geometry.rowHeights) expect(height).toBeGreaterThanOrEqual(44);
  expect(geometry.trigger.width).toBe(40);
  expect(geometry.trigger.height).toBe(40);
  expect(geometry.systemPartsOverlap).toBe(false);
  expect(geometry.deviceStatus).toBe(deviceLabel);
  expect(geometry.documentOverflowsX).toBe(false);
}
