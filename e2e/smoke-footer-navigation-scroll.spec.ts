/**
 * Footer navigation must finish at the top of the destination page.
 *
 * The footer is persisted (`data-zfb-transition-persist="footer-en"`) and the
 * activated footer link keeps focus across the SPA swap. zfb moves persisted
 * chrome with moveBefore(); current Chromium (reproduced on 151 and 153, not
 * on the 145 build pinned by @playwright/test 1.58.2) queues a native focus
 * reveal for the moved focused subtree until the next layout. The router's
 * settleLocation() scrollTo(0, 0) can skip that layout, so the reveal used to
 * land afterwards and leave the viewport at the footer. The package-owned
 * persisted-focus-settle bootstrap flushes the reveal between the DOM move and
 * settleLocation().
 *
 * To prove the regression on a reproducing browser, point the pinned
 * Playwright at a newer Chromium via E2E_CHROMIUM_EXECUTABLE (see
 * e2e/CLAUDE.md). The browser version is attached to each test result.
 *
 * Instrumentation rule: nothing in the page may read layout (scrollY,
 * offsetHeight, getBoundingClientRect, screenshots) between the persisted DOM
 * move and settleLocation(). That read is itself the fix and would hide the
 * bug. The observer below records event names only; geometry is read after
 * page-load and transition completion.
 */
import { test, expect, type Page, type Locator } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 900 } });

const SHORT = { path: "/docs/getting-started", label: "Getting Started", heading: "Getting Started" };
const GUIDES = { path: "/docs/guides", label: "Guides", heading: "Guides" };
const LONG = { path: "/docs/footer-scroll-long", label: "Footer Scroll Long", heading: "Footer Scroll Long" };
type Target = typeof SHORT;

interface Observer {
  events: string[];
  native: boolean | null;
}
declare global {
  interface Window {
    __zdFooterNav?: Observer;
  }
}

function installObserver() {
  const observer: Observer = { events: [], native: null };
  window.__zdFooterNav = observer;
  for (const name of [
    "zfb:before-preparation",
    "zfb:after-preparation",
    "zfb:before-swap",
    "zfb:after-swap",
    "zfb:page-load",
  ]) {
    document.addEventListener(name, (event) => {
      observer.events.push(name);
      if (name !== "zfb:before-swap") return;
      const vt = (event as Event & { viewTransition?: ViewTransition }).viewTransition;
      observer.native = typeof ViewTransition !== "undefined" && vt instanceof ViewTransition;
      vt?.finished.then(
        () => observer.events.push("transition:finished"),
        () => observer.events.push("transition:rejected"),
      );
    });
  }
}

function removeNativeViewTransitions() {
  delete (Document.prototype as Partial<Document>).startViewTransition;
}

const errorsByPage = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page, browser }, testInfo) => {
  testInfo.annotations.push({ type: "browser", description: `chromium ${browser.version()}` });
  const errors: string[] = [];
  errorsByPage.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("[zfb]")) errors.push(message.text());
  });
  await page.addInitScript(installObserver);
});

async function openAtFooter(page: Page, from: Target, to: Target): Promise<Locator> {
  await page.goto(from.path);
  await page.waitForFunction(() => window.__zdFooterNav?.events.includes("zfb:page-load"));
  await page.evaluate(() => {
    window.__zdFooterNav!.events.length = 0;
    (document.querySelector("footer") as HTMLElement & { __zdMarker?: string }).__zdMarker = "footer";
  });
  const link = page.locator("footer").getByRole("link", { name: to.label, exact: true });
  await expect(link).toHaveCount(1);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  return link;
}

async function nextFrames(page: Page, count: number) {
  await page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        const step = (left: number) => (left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
        step(n);
      }),
    count,
  );
}

async function expectSettledAtTop(page: Page, to: Target, expectTransition: boolean) {
  await page.waitForFunction(() => window.__zdFooterNav?.events.includes("zfb:page-load"));
  if (expectTransition) {
    await page.waitForFunction(() => window.__zdFooterNav?.events.includes("transition:finished"));
  }
  await nextFrames(page, 2);

  await expect(page).toHaveURL(new RegExp(`${to.path}/?$`));
  await expect(page).toHaveTitle(new RegExp(to.heading));
  await expect(page.locator("main h1").first()).toHaveText(to.heading);

  const events = await page.evaluate(() => window.__zdFooterNav!.events);
  const order = ["zfb:before-preparation", "zfb:after-preparation", "zfb:before-swap", "zfb:after-swap", "zfb:page-load"];
  expect(events.filter((name) => order.includes(name)), "one SPA lifecycle, in order").toEqual(order);

  expect(await page.evaluate(() => window.scrollY), "destination must start at the top").toBeLessThanOrEqual(1);
  // No late return to the footer after further natural frames.
  await nextFrames(page, 10);
  expect(await page.evaluate(() => window.scrollY), "no late scroll back to the footer").toBeLessThanOrEqual(1);

  const footerKept = await page.evaluate(
    () => (document.querySelector("footer") as HTMLElement & { __zdMarker?: string }).__zdMarker === "footer",
  );
  expect(footerKept, "footer DOM node persists across the swap").toBe(true);
  expect(errorsByPage.get(page)).toEqual([]);
}

async function expectFocusRetained(page: Page, to: Target) {
  const focused = await page.evaluate(() => {
    const active = document.activeElement;
    return {
      inFooter: !!active?.closest("footer"),
      text: active?.textContent?.trim(),
      marked: (active as HTMLElement & { __zdMarker?: string } | null)?.__zdMarker === "link",
    };
  });
  expect(focused).toEqual({ inFooter: true, text: to.label, marked: true });
}

type Pair = [string, Target, Target];
const heightPairs: Pair[] = [
  ["long to short", LONG, SHORT],
  ["short to long", SHORT, LONG],
];
const pairs: Pair[] = [
  ["guides to getting started (reported case)", GUIDES, SHORT],
  ["getting started to guides (reported reverse case)", SHORT, GUIDES],
  ...heightPairs,
];

test.describe("footer navigation scroll (native view transition)", () => {
  for (const [name, from, to] of pairs) {
    test(`pointer: ${name}`, async ({ page }) => {
      const link = await openAtFooter(page, from, to);
      await link.click();
      await expectSettledAtTop(page, to, true);
      expect(await page.evaluate(() => window.__zdFooterNav!.native)).toBe(true);
    });
  }

  for (const [name, from, to] of heightPairs) {
    test(`keyboard: ${name}`, async ({ page }) => {
      const link = await openAtFooter(page, from, to);
      await link.focus();
      await link.evaluate((el) => {
        (el as HTMLElement & { __zdMarker?: string }).__zdMarker = "link";
      });
      await page.keyboard.press("Enter");
      await expectSettledAtTop(page, to, true);
      await expectFocusRetained(page, to);
    });
  }
});

test.describe("footer navigation scroll (reduced motion)", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });
  for (const [name, from, to] of heightPairs) {
    test(`pointer: ${name}`, async ({ page }) => {
      const link = await openAtFooter(page, from, to);
      await link.click();
      await expectSettledAtTop(page, to, false);
    });
  }
});

test.describe("footer navigation scroll (fallback without native view transitions)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(removeNativeViewTransitions);
  });
  for (const [name, from, to] of heightPairs) {
    test(`pointer: ${name}`, async ({ page }) => {
      const link = await openAtFooter(page, from, to);
      await link.click();
      await expectSettledAtTop(page, to, false);
      expect(await page.evaluate(() => window.__zdFooterNav!.native)).toBe(false);
    });
  }
});
