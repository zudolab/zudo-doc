/**
 * Real-browser regression for zfb-runtime's early-history-commit Back race
 * (zudo-front-builder#2617/#2622, zudo-doc#3700).
 *
 * A View Transition callback gate holds the forward A→B navigation before
 * updateDOM reaches `zfb:before-swap`. The URL/history entry has already been
 * committed to B at that point, while A's body is still live. A real Back
 * traversal must abort stale B and take the live-A same-page fast path: no
 * redundant A swap lifecycle is expected or allowed.
 *
 * Every wait is keyed to router lifecycle, the explicit callback gate,
 * transition attributes, or Playwright's retrying URL/DOM assertions. There
 * are no sleeps and no network-idle guesses.
 */
import { expect, test, type Page } from "@playwright/test";

const PAGE_A = "/docs/router-race-a";
const PAGE_B = "/docs/router-race-b";

interface RaceEvent {
  name: string;
  seq: number;
  to: string | null;
}

interface RaceHarness {
  events: RaceEvent[];
  seq: number;
  armGate: boolean;
  gateEntered: boolean;
  releaseGate: (() => void) | null;
  bScriptRuns: number;
}

function installRaceHarness(): void {
  const raceWindow = window as Window & { __zfbBackRace?: RaceHarness };
  if (raceWindow.__zfbBackRace) return;

  const harness: RaceHarness = {
    events: [],
    seq: 0,
    armGate: false,
    gateEntered: false,
    releaseGate: null,
    bScriptRuns: 0,
  };
  raceWindow.__zfbBackRace = harness;

  for (const name of [
    "zfb:before-preparation",
    "zfb:after-preparation",
    "zfb:before-swap",
    "zfb:after-swap",
    "zfb:page-load",
    "zfb:navigation-aborted",
  ]) {
    document.addEventListener(name, (event) => {
      const to = (event as Event & { to?: unknown }).to;
      harness.events.push({
        name,
        seq: ++harness.seq,
        to: to instanceof URL ? to.pathname : null,
      });
    });
  }

  const nativeStartViewTransition = document.startViewTransition?.bind(document);
  if (!nativeStartViewTransition) return;
  document.startViewTransition = ((callbackOrOptions) => {
    if (typeof callbackOrOptions !== "function") {
      return nativeStartViewTransition(callbackOrOptions);
    }
    const callback = callbackOrOptions;
    return nativeStartViewTransition(async () => {
      if (!harness.armGate) return callback();
      harness.armGate = false;
      harness.gateEntered = true;
      await new Promise<void>((resolve) => {
        harness.releaseGate = resolve;
      });
      return callback();
    });
  }) as Document["startViewTransition"];
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installRaceHarness);
});

async function currentSequence(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as Window & { __zfbBackRace?: RaceHarness }).__zfbBackRace?.seq ??
      0,
  );
}

async function waitForEventAfter(
  page: Page,
  name: string,
  after: number,
): Promise<void> {
  await page.waitForFunction(
    ({ eventName, afterSequence }) =>
      (
        (window as Window & { __zfbBackRace?: RaceHarness }).__zfbBackRace
          ?.events ?? []
      ).some(
        (event) => event.name === eventName && event.seq > afterSequence,
      ),
    { eventName: name, afterSequence: after },
  );
}

async function eventNamesAfter(page: Page, after: number): Promise<string[]> {
  return page.evaluate(
    (afterSequence) =>
      (
        (window as Window & { __zfbBackRace?: RaceHarness }).__zfbBackRace
          ?.events ?? []
      )
        .filter((event) => event.seq > afterSequence)
        .map((event) => event.name),
    after,
  );
}

test("Back wins during the early-history-commit/pre-swap window", async ({
  page,
}) => {
  await page.goto(PAGE_A, { waitUntil: "domcontentloaded" });
  // Router activation seeds the current entry with a finite history index.
  // Unlike a load-event wait, this remains observable even if the `when=load`
  // bootstrap bundle evaluates just after the browser's load event.
  await page.waitForFunction(() => Number.isFinite(history.state?.index));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Router Race Page A",
  );

  const beforeForward = await currentSequence(page);
  await page.evaluate(() => {
    const harness = (window as Window & { __zfbBackRace?: RaceHarness })
      .__zfbBackRace;
    if (!harness) throw new Error("Back-race harness was not installed");
    if (typeof document.startViewTransition !== "function") {
      throw new Error("This regression requires native View Transitions");
    }
    harness.armGate = true;
  });
  await page.getByRole("link", { name: "Navigate to race page B" }).click();

  // zfb commits B's URL before startViewTransition invokes updateDOM. The
  // harness gate holds that callback, making the vulnerable boundary explicit.
  await page.waitForFunction(
    () =>
      (window as Window & { __zfbBackRace?: RaceHarness }).__zfbBackRace
        ?.gateEntered === true,
  );
  await expect(page).toHaveURL(new RegExp(`${PAGE_B}/?$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Router Race Page A",
  );

  const beforeBack = await currentSequence(page);
  const backNavigation = page.goBack();
  await waitForEventAfter(page, "zfb:navigation-aborted", beforeBack);

  // Let stale B's held callback resume only after Back has taken ownership.
  await page.evaluate(() => {
    const harness = (window as Window & { __zfbBackRace?: RaceHarness })
      .__zfbBackRace;
    if (!harness?.releaseGate) throw new Error("B callback gate was not held");
    harness.releaseGate();
    harness.releaseGate = null;
  });
  await backNavigation;
  await page.waitForFunction(
    () => !document.documentElement.hasAttribute("data-zfb-transition"),
  );

  await expect(page).toHaveURL(new RegExp(`${PAGE_A}/?$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Router Race Page A",
  );

  const allForwardEffects = await eventNamesAfter(page, beforeForward);
  expect(
    allForwardEffects.filter((name) => name === "zfb:before-preparation"),
    "only B prepares; Back uses the live-A same-page fast path",
  ).toHaveLength(1);

  const postBackEffects = await eventNamesAfter(page, beforeBack);
  expect(
    postBackEffects.filter((name) => name === "zfb:navigation-aborted"),
    "stale B should emit exactly one abort",
  ).toHaveLength(1);
  expect(
    postBackEffects.filter(
      (name) =>
        name === "zfb:before-swap" ||
        name === "zfb:after-swap" ||
        name === "zfb:page-load",
    ),
    "neither stale B nor live-A Back may run a swap/post-swap lifecycle",
  ).toEqual([]);
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __zfbBackRace?: RaceHarness }).__zfbBackRace
          ?.bScriptRuns ?? -1,
    ),
    "B's destination-only script must not execute",
  ).toBe(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-zfb-transition");
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-zfb-transition-fallback",
  );
});
