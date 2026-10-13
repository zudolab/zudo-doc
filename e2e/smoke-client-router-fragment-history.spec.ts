/**
 * Real-browser regression for zfb-runtime's null-state history entries
 * (zudo-front-builder#4157/#4165, fixed in zfb 4.4.0; zudo-doc#4569).
 *
 * A native same-page fragment link creates a history entry the router never
 * stamped. Before 4.4.0, A → A#fragment → soft navigation to B → Back changed
 * the URL to A#fragment while B stayed rendered, and the following Forward was
 * reported as `back`. Entries whose pathname matches the rendered page must
 * stay browser-owned: no preparation, no fetch, no swap.
 *
 * Waits are keyed to router lifecycle events and Playwright's retrying
 * URL/DOM assertions — no sleeps.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const PAGE_A = "/docs/router-fragment-a";
const PAGE_B = "/docs/router-fragment-b";
const HEADING_A = "Router Fragment Page A";
const HEADING_B = "Router Fragment Page B";

interface RouterEvent {
  name: string;
  seq: number;
  to: string | null;
  direction: string | null;
}

interface RouterHarness {
  events: RouterEvent[];
  seq: number;
}

function installRouterHarness(): void {
  const harnessWindow = window as Window & { __zfbFragmentHistory?: RouterHarness };
  if (harnessWindow.__zfbFragmentHistory) return;
  const harness: RouterHarness = { events: [], seq: 0 };
  harnessWindow.__zfbFragmentHistory = harness;
  for (const name of ["zfb:before-preparation", "zfb:after-swap", "zfb:page-load"]) {
    document.addEventListener(name, (event) => {
      const detail = event as Event & { to?: unknown; direction?: unknown };
      harness.events.push({
        name,
        seq: ++harness.seq,
        to: detail.to instanceof URL ? detail.to.pathname + detail.to.hash : null,
        direction: typeof detail.direction === "string" ? detail.direction : null,
      });
    });
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installRouterHarness);
});

async function currentSequence(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as Window & { __zfbFragmentHistory?: RouterHarness })
        .__zfbFragmentHistory?.seq ?? 0,
  );
}

async function eventsAfter(page: Page, after: number): Promise<RouterEvent[]> {
  return page.evaluate(
    (afterSequence) =>
      (
        (window as Window & { __zfbFragmentHistory?: RouterHarness })
          .__zfbFragmentHistory?.events ?? []
      ).filter((event) => event.seq > afterSequence),
    after,
  );
}

async function waitForPageLoadAfter(page: Page, after: number): Promise<void> {
  await page.waitForFunction(
    (afterSequence) =>
      (
        (window as Window & { __zfbFragmentHistory?: RouterHarness })
          .__zfbFragmentHistory?.events ?? []
      ).some((event) => event.name === "zfb:page-load" && event.seq > afterSequence),
    after,
  );
}

async function openPageA(page: Page): Promise<void> {
  await page.goto(PAGE_A, { waitUntil: "domcontentloaded" });
  // Router activation seeds the current entry with a finite history index.
  await page.waitForFunction(() => Number.isFinite(history.state?.index));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(HEADING_A);
}

async function followNativeFragment(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Jump to the fragment target" }).click();
  await expect(page).toHaveURL(new RegExp(`${PAGE_A}/?#fragment-target$`));
  await expect(page.getByRole("heading", { name: "Fragment target" })).toBeInViewport();
}

/**
 * Proves the preceding browser-owned traversal produced no router work. A
 * negative check read straight after a URL assertion could miss a late
 * (fetch- or microtask-deferred) preparation, so instead drive one known soft
 * navigation and wait for its page-load: any stale router work queued before it
 * would appear in the log ahead of B's single preparation.
 */
async function expectOnlyKnownNavigationAfter(page: Page, before: number): Promise<void> {
  await page.getByRole("link", { name: "Navigate to fragment page B" }).click();
  await waitForPageLoadAfter(page, before);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(HEADING_B);
  const preparations = (await eventsAfter(page, before)).filter(
    (event) => event.name === "zfb:before-preparation",
  );
  expect(preparations.map((event) => event.to), "only the known navigation prepares").toEqual([
    expect.stringMatching(new RegExp(`^${PAGE_B}/?$`)),
  ]);
}

test("Back to a browser-created fragment entry restores page A, and Forward is reported forward", async ({
  page,
  assertNoConsoleErrors,
}) => {
  await openPageA(page);
  await followNativeFragment(page);

  // Leave A through the link beside the target so the click needs no scroll:
  // Back restores the scroll position A was left at, which is then the fragment.
  const continueLink = page.getByRole("link", { name: "Continue to fragment page B" });
  await expect(continueLink).toBeInViewport();
  const departureScrollY = await page.evaluate(() => scrollY);
  expect(departureScrollY, "the fragment entry is scrolled past the first viewport").toBeGreaterThan(0);

  const beforeSoftNav = await currentSequence(page);
  await continueLink.click();
  await waitForPageLoadAfter(page, beforeSoftNav);
  await expect(page).toHaveURL(new RegExp(`${PAGE_B}/?$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(HEADING_B);

  const beforeBack = await currentSequence(page);
  await page.goBack();
  await waitForPageLoadAfter(page, beforeBack);
  await expect(page).toHaveURL(new RegExp(`${PAGE_A}/?#fragment-target$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(HEADING_A);
  await expect(page.getByRole("heading", { name: "Fragment target" })).toBeInViewport();
  // scrollY is fractional; the restored value may round to the neighbouring pixel.
  const restoredScrollY = await page.evaluate(() => scrollY);
  expect(
    Math.abs(restoredScrollY - departureScrollY),
    "Back restores the departure scroll",
  ).toBeLessThanOrEqual(1);
  const backPreparation = (await eventsAfter(page, beforeBack)).filter(
    (event) => event.name === "zfb:before-preparation",
  );
  expect(backPreparation).toHaveLength(1);
  expect(backPreparation[0]?.direction).toBe("back");

  const beforeForward = await currentSequence(page);
  await page.goForward();
  await waitForPageLoadAfter(page, beforeForward);
  await expect(page).toHaveURL(new RegExp(`${PAGE_B}/?$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(HEADING_B);
  const forwardPreparation = (await eventsAfter(page, beforeForward)).filter(
    (event) => event.name === "zfb:before-preparation",
  );
  expect(forwardPreparation).toHaveLength(1);
  expect(forwardPreparation[0]?.direction).toBe("forward");
  assertNoConsoleErrors();
});

test("same-page native fragment Back/Forward stays browser-owned", async ({
  page,
  assertNoConsoleErrors,
}) => {
  await openPageA(page);
  await followNativeFragment(page);

  const before = await currentSequence(page);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${PAGE_A}/?$`));
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`${PAGE_A}/?#fragment-target$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(HEADING_A);
  await expectOnlyKnownNavigationAfter(page, before);
  assertNoConsoleErrors();
});

test("app-owned null-state query entries on the same pathname stay no-fetch/no-swap", async ({
  page,
  assertNoConsoleErrors,
}) => {
  await openPageA(page);
  const documentRequests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "document" || request.resourceType() === "fetch") {
      documentRequests.push(request.url());
    }
  });

  await page.evaluate(() => {
    history.pushState(null, "", "?q=first");
    history.pushState(null, "", "?q=second");
  });
  const before = await currentSequence(page);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${PAGE_A}/?\\?q=first$`));
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`${PAGE_A}/?\\?q=second$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(HEADING_A);
  await expectOnlyKnownNavigationAfter(page, before);
  expect(
    documentRequests.filter((url) => new URL(url).pathname.startsWith(PAGE_A)),
    "no page fetch",
  ).toEqual([]);
  assertNoConsoleErrors();
});
