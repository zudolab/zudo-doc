/** Active native snapshot regression for #4580. Screenshots are per-run evidence,
 * never committed baselines. Identity/state coverage lives in sibling specs. */
import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { waitForSidebarHydration } from "./sidebar-helpers";
import {
  finishNativeTransition,
  installNativeTransitionProbe,
  navigateNativeTransition,
  nativeSnapshots,
  proveActiveNativeTransition,
  readNativeTransitionRecord,
  removeHeaderStationaryProtection,
  stationarySnapshots,
  visibleSnapshotClip,
} from "./native-transition-helpers";

test.use({ viewport: { width: 1280, height: 900 } });
const GUIDES_INDEX = "/docs/guides/";
const GUIDES_PAGE_1 = "/docs/guides/page-1";
const header = { name: "zfb-header", selector: "header" };
const sidebar = { name: "zfb-sidebar", selector: "#desktop-sidebar" };

function expectPairedSnapshots(nodes: Awaited<ReturnType<typeof nativeSnapshots>>, names: string[]) {
  for (const name of names) {
    expect(nodes.filter((node) => node.name === name && /view-transition-(old|new)$/.test(node.type))
      .map((node) => node.type).sort(), `${name} has two actual native snapshots`)
      .toEqual(["view-transition-new", "view-transition-old"]);
  }
  expect(stationarySnapshots(nodes, names)).toBe(true);
}

test("visual names survive removal of persistence metadata", async ({ page }) => {
  await page.goto(GUIDES_INDEX);
  await waitForSidebarHydration(page);
  const names = await page.evaluate(() => {
    const selectors = ["header", "#desktop-sidebar", "footer"];
    return selectors.map((selector) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Required chrome is missing: ${selector}`);
      const before = getComputedStyle(element).viewTransitionName;
      if (selector === "header" || selector === "#desktop-sidebar") element.removeAttribute("data-zfb-transition-persist");
      return { before, after: getComputedStyle(element).viewTransitionName };
    });
  });
  expect(names).toEqual(["zfb-header", "zfb-sidebar", "zfb-footer"].map((name) => ({ before: name, after: name })));
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`same-category ${colorScheme}: stationary native chrome and animated article pixels`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme });
    await page.goto(GUIDES_INDEX);
    await waitForSidebarHydration(page);
    await installNativeTransitionProbe(page);
    await navigateNativeTransition(page, GUIDES_PAGE_1);
    const nodes = await proveActiveNativeTransition(page, testInfo, {
      label: `same-category-${colorScheme}`, regions: [header, sidebar],
    });
    expectPairedSnapshots(nodes, ["zfb-footer"]);
    await finishNativeTransition(page);
  });
}

test("category changes and Back/Forward retain stationary header snapshots", async ({ page }, testInfo) => {
  await page.goto(GUIDES_INDEX);
  await waitForSidebarHydration(page);
  await installNativeTransitionProbe(page);
  for (const [label, target] of [
    ["category", "/docs/getting-started"],
    ["back", { history: "back" }],
    ["forward", { history: "forward" }],
  ] as const) {
    await navigateNativeTransition(page, target);
    const nodes = await proveActiveNativeTransition(page, testInfo, { label, regions: [header] });
    expect(nodes.some((node) => node.name === "zfb-sidebar" && /view-transition-(old|new)$/.test(node.type) && node.style["animation-name"] !== "none"), "Changed category sidebar is independently animated").toBe(true);
    await finishNativeTransition(page);
  }
});

test("sidebar exit and entry are named one-sided snapshots while header stays stationary", async ({ page }, testInfo) => {
  await page.goto(GUIDES_INDEX);
  await waitForSidebarHydration(page);
  await installNativeTransitionProbe(page);
  // A real same-category hide_sidebar page keeps an sr-only ARIA landmark.
  // That landmark must not create a new named snapshot or a stationary pair.
  for (const [label, href, expectedType, title] of [
    ["exit", "/docs/guides/hidden-sidebar", "view-transition-old", "Hidden Sidebar"],
    ["entry", GUIDES_PAGE_1, "view-transition-new", "Writing Docs"],
  ] as const) {
    await navigateNativeTransition(page, href);
    const nodes = await proveActiveNativeTransition(page, testInfo, { label, regions: [header] });
    const images = nodes.filter((node) => node.name === "zfb-sidebar" && /view-transition-(old|new)$/.test(node.type));
    expect(images.map((node) => node.type)).toEqual([expectedType]);
    expect(images[0]!.style["animation-name"]).not.toBe("none");
    await expect(page.locator("html")).toHaveAttribute("data-zd-sidebar-transition", "changing");
    await expect(page.locator("[data-zd-nav-section]")).toHaveAttribute("data-zd-nav-section", "guides");
    await expect(page).toHaveTitle(new RegExp(title));
    await expect(page.locator("h1")).toContainText(title);
    if (label === "exit") {
      await expect(page.locator("#desktop-sidebar")).toHaveClass(/sr-only/);
      expect(await page.locator("#desktop-sidebar").evaluate((element) => getComputedStyle(element).viewTransitionName)).toBe("none");
    }
    await finishNativeTransition(page);
  }
});

for (const layer of ["old", "new", "group"] as const) {
  test(`negative control: removing header ${layer} protection fails the same pixel oracle`, async ({ page }, testInfo) => {
    await page.goto(GUIDES_INDEX);
    await waitForSidebarHydration(page);
    await installNativeTransitionProbe(page);
    await removeHeaderStationaryProtection(page, layer);
    await navigateNativeTransition(page, GUIDES_PAGE_1);
    await proveActiveNativeTransition(page, testInfo, {
      label: `missing-${layer}`, regions: [header], expectedStationary: false,
    });
    await finishNativeTransition(page);
  });
}

test("mobile replacement keeps native header snapshots stationary and destination metadata fresh", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(GUIDES_INDEX);
  await waitForSidebarHydration(page);
  await installNativeTransitionProbe(page);
  await page.evaluate(() => {
    const previous = document.querySelector("header");
    document.addEventListener("zfb:before-swap", (event) => {
      const next = (event as Event & { newDocument: Document }).newDocument.querySelector("header")!;
      next.removeAttribute("data-zfb-transition-persist");
      next.setAttribute("aria-label", "Fresh destination header");
    }, { once: true });
    document.addEventListener("zfb:after-swap", () => {
      document.documentElement.dataset.nativeProofHeaderReplaced = String(document.querySelector("header") !== previous);
    }, { once: true });
  });
  await navigateNativeTransition(page, GUIDES_PAGE_1);
  await proveActiveNativeTransition(page, testInfo, { label: "mobile-replacement", regions: [header] });
  await expect(page.locator("header")).toHaveAttribute("aria-label", "Fresh destination header");
  await expect(page.locator("html")).toHaveAttribute("data-native-proof-header-replaced", "true");
  await expect(page).toHaveTitle(/Writing Docs/);
  await expect(page.locator("h1")).toContainText("Writing Docs");
  await finishNativeTransition(page);
});

for (const side of ["old", "new"] as const) {
  test(`one-sided ${side} header remains stationary`, async ({ page }, testInfo) => {
    await page.goto(GUIDES_INDEX);
    await waitForSidebarHydration(page);
    const clip = await visibleSnapshotClip(page, "header");
    await installNativeTransitionProbe(page);
    await page.evaluate((imageSide) => {
      if (imageSide === "new") document.querySelector("header")!.remove();
      else document.addEventListener("zfb:before-swap", (event) => {
        (event as Event & { newDocument: Document }).newDocument.querySelector("header")!.remove();
      }, { once: true });
    }, side);
    await navigateNativeTransition(page, GUIDES_PAGE_1);
    await proveActiveNativeTransition(page, testInfo, {
      label: `one-sided-header-${side}`, regions: [{ name: "zfb-header", clip, images: [side] }],
    });
    await expect(page).toHaveTitle(/Writing Docs/);
    await expect(page.locator("h1")).toContainText("Writing Docs");
    await finishNativeTransition(page);
  });
}

test("native content animation advances on the browser clock", async ({ page }, testInfo) => {
  await page.goto(GUIDES_INDEX);
  await waitForSidebarHydration(page);
  await installNativeTransitionProbe(page, false);
  await navigateNativeTransition(page, GUIDES_PAGE_1);
  await page.waitForFunction(() => window.__zdNativeTransitionProof!.records.at(-1)?.clock !== undefined);
  const record = await readNativeTransitionRecord(page);
  const sample = record.clock!;
  expect(record.native).toBe(true);
  expect(record.animations.some(({ name, pseudo }) =>
    name === "contentFadeIn" && pseudo === "::view-transition-new(root)")).toBe(true);
  expect(sample.status).toBe("advanced");
  expect(sample.first).not.toBeNull();
  expect(sample.second).toBeGreaterThan(sample.first!);
  expect(sample.state).toBe("running");
  expect([sample.ready, sample.update, sample.finished]).toEqual(["fulfilled", "fulfilled", "pending"]);
  // Actual pseudo-node and active-pixel proof is covered by the held tests.
  // Querying CDP here would race the natural completion we are observing.
  await testInfo.attach("native-browser-clock.json", { body: JSON.stringify({ record, sample }, null, 2), contentType: "application/json" });
  await page.waitForFunction(() => window.__zdNativeTransitionProof!.records.at(-1)?.finished === "fulfilled");
  expect((await readNativeTransitionRecord(page)).update).toBe("fulfilled");
});
