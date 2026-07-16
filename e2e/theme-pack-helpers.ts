/**
 * Shared helpers for theme-pack e2e specs (`theme-pack-switcher.spec.ts`,
 * `theme-pack-zdtp-interplay.spec.ts`) — the `sidebar-helpers.ts` /
 * `nav-helpers.ts` convention (see `e2e/CLAUDE.md`).
 *
 * Selectors follow the DOM/state contracts locked by
 * `packages/zudo-doc/docs/adr/theme-packs.md` (Decisions 3 and 7): the
 * `data-theme-pack` html attribute, the `data-zd-theme-pack-css` link
 * marker, the `zudo-doc-theme-pack` localStorage key, the
 * `theme-pack-changed` window event, and the flyout/dialog's accessible
 * names/roles as rendered by `packages/zudo-doc/src/theme-pack-switcher/index.tsx`
 * and `packages/zudo-doc/src/theme-pack-dialog/index.tsx`.
 */
import type { Locator, Page } from "@playwright/test";
import { expect } from "./fixtures";

export const THEME_PACK_STORAGE_KEY = "zudo-doc-theme-pack";
export const THEME_PACK_CHANGED_EVENT = "theme-pack-changed";
export const THEME_PACK_ATTR = "data-theme-pack";
export const THEME_PACK_LINK_SELECTOR = "link[data-zd-theme-pack-css]";
export const THEME_PACK_LINK_LOADING_SELECTOR = "link[data-zd-theme-pack-css-loading]";

export interface ThemePackChangeDetail {
  pack: string;
  previous: string;
}

/** The always-mounted bottom-right launcher button. */
export function launcherButton(page: Page): Locator {
  return page.getByRole("button", { name: "Theme pack switcher", exact: true });
}

/** The flyout card (only present in the DOM while open). */
export function flyoutCard(page: Page): Locator {
  return page.getByRole("dialog", { name: "Theme pack switcher", exact: true });
}

export function nextPackButton(page: Page): Locator {
  return page.getByRole("button", { name: "Next theme pack" });
}

export function prevPackButton(page: Page): Locator {
  return page.getByRole("button", { name: "Previous theme pack" });
}

export function browseAllButton(page: Page): Locator {
  return page.getByRole("button", { name: "Browse all theme packs" });
}

/** The browse-all grid dialog (#2825). Accessible name comes from its
 *  `aria-labelledby` heading ("Preview theme"). */
export function dialogLocator(page: Page): Locator {
  return page.getByRole("dialog", { name: "Preview theme" });
}

/** A pack's preview card inside the browse-all dialog, matched by its
 *  `Apply <name> theme pack — <Light|Dark>. <description>` aria-label. */
export function packCard(page: Page, packName: string): Locator {
  return page.getByRole("button", { name: new RegExp(`^Apply ${packName} theme pack`) });
}

/**
 * Open the flyout via the launcher and wait for the card to mount.
 *
 * The launcher's `onClick` only exists once `ThemePackSwitcher`'s Preact
 * island has actually hydrated. `Island({ when: "load" })` starts hydration
 * eagerly, but the real mount still lands via an async dynamic import — there
 * is no observable DOM difference between "SSR, not yet hydrated" and
 * "hydrated but still closed" for the closed default state, and (unlike the
 * design-token-panel trigger, which has a dedicated pre-hydration click-queue
 * shim) this island has no such fallback. A single click right after
 * `page.goto` can therefore land before the handler is attached and be
 * silently dropped. Retry the click-and-check as a unit via `toPass` — driven
 * by Playwright's own retry schedule, never an arbitrary sleep — so a dropped
 * first click self-heals instead of flaking the test.
 */
export async function openFlyout(page: Page): Promise<void> {
  await expect(async () => {
    await launcherButton(page).click();
    await expect(flyoutCard(page)).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 10000 });
}

/** Close the flyout via Escape (registered while the card is open) and wait
 *  for it to unmount. */
export async function closeFlyout(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(flyoutCard(page)).toBeHidden({ timeout: 5000 });
}

/** Poll `<html data-theme-pack>` until it settles on `slug` — the switch
 *  commits only after the incoming stylesheet loads (ADR Decision 3), so this
 *  is a state wait, never a duration wait. */
export async function waitForActivePack(page: Page, slug: string, timeout = 10000): Promise<void> {
  await expect(page.locator("html")).toHaveAttribute(THEME_PACK_ATTR, slug, { timeout });
}

export async function readActivePack(page: Page): Promise<string> {
  return (await page.locator("html").getAttribute(THEME_PACK_ATTR)) ?? "default";
}

export async function readStoredPack(page: Page): Promise<string | null> {
  return page.evaluate((key) => localStorage.getItem(key), THEME_PACK_STORAGE_KEY);
}

/**
 * Arm a one-shot capture of the next `theme-pack-changed` event's detail.
 * Call BEFORE the action that triggers the switch (Next/Prev click, a
 * dialog card click) so there is no race window between listener
 * registration and the commit — mirrors `spaClick`'s "install listener and
 * act atomically" pattern in `nav-helpers.ts`.
 */
export async function armThemePackChangeCapture(page: Page): Promise<void> {
  await page.evaluate((eventName) => {
    (window as unknown as Record<string, unknown>)["__themePackChangeDetail"] = undefined;
    window.addEventListener(
      eventName,
      (event) => {
        (window as unknown as Record<string, unknown>)["__themePackChangeDetail"] = (
          event as CustomEvent
        ).detail;
      },
      { once: true },
    );
  }, THEME_PACK_CHANGED_EVENT);
}

/** Read the detail captured by {@link armThemePackChangeCapture}. `undefined`
 *  means the event never fired since arming. */
export async function readThemePackChangeDetail(
  page: Page,
): Promise<ThemePackChangeDetail | undefined> {
  return page.evaluate(
    () => (window as unknown as Record<string, unknown>)["__themePackChangeDetail"],
  ) as Promise<ThemePackChangeDetail | undefined>;
}
