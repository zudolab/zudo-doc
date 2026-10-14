/** The sidebar fixture enables both real desktop toggle islands. Keep their
 * native snapshot proof here; smoke intentionally does not mount the toggles. */
import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { waitForSidebarHydration } from "./sidebar-helpers";
import {
  finishNativeTransition,
  installNativeTransitionProbe,
  navigateNativeTransition,
  proveActiveNativeTransition,
  stationarySnapshots,
} from "./native-transition-helpers";

test.use({ viewport: { width: 1440, height: 900 } });
const FROM = "/docs/guides/sub-a/page-1";
const TO = "/docs/guides/sub-a/page-2";
const sidebarToggle = { name: "zfb-sidebar-toggle", selector: ".zd-desktop-sidebar-toggle" };
const tocToggle = { name: "zfb-toc-toggle", selector: ".zd-desktop-toc-toggle" };

test("enabled desktop toggles have independent visual names", async ({ page }) => {
  await page.goto(FROM);
  await waitForSidebarHydration(page);
  for (const { name, selector } of [sidebarToggle, tocToggle]) {
    const toggle = page.locator(selector);
    await expect(toggle).toBeVisible();
    const names = await toggle.evaluate((element) => {
      const before = getComputedStyle(element).viewTransitionName;
      element.removeAttribute("data-zfb-transition-persist");
      return { before, after: getComputedStyle(element).viewTransitionName };
    });
    expect(names).toEqual({ before: name, after: name });
  }
});

test("real footer and both desktop toggles retain paired stationary snapshots", async ({ page }, testInfo) => {
  // Both existing routes have two h2 headings, so the actual TOC toggle is
  // mounted on both sides. No test-only chrome or persistence marker is added.
  await page.goto(FROM);
  await waitForSidebarHydration(page);
  await expect(page.locator(sidebarToggle.selector)).toBeVisible();
  await expect(page.locator(tocToggle.selector)).toBeVisible();
  await installNativeTransitionProbe(page);
  await navigateNativeTransition(page, TO);
  const nodes = await proveActiveNativeTransition(page, testInfo, {
    label: "actual-desktop-toggles",
    regions: [{ name: "zfb-header", selector: "header" }, sidebarToggle, tocToggle],
  });
  // The footer is below the viewport. Require its actual paired pseudo nodes
  // and stationary policy; the helper additionally proves toggle pixel equality.
  const names = ["zfb-footer", sidebarToggle.name, tocToggle.name];
  for (const name of names) {
    expect(nodes.filter((node) => node.name === name && /view-transition-(old|new)$/.test(node.type))
      .map((node) => node.type).sort(), `${name} has two actual native snapshots`)
      .toEqual(["view-transition-new", "view-transition-old"]);
  }
  expect(stationarySnapshots(nodes, names)).toBe(true);
  await expect(page).toHaveTitle(/Test Page 2/);
  await finishNativeTransition(page);
});
