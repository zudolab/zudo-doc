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

/** Rounded antialiased corners include the animated article behind the button.
 * Compare pixels owned by the opaque button, including its entire icon and both
 * straight borders. Native geometry still covers the full snapshot below. */
async function opaqueToggleClip(page: import("@playwright/test").Page, selector: string) {
  return page.locator(selector).evaluate((button) => {
    const style = getComputedStyle(button);
    const bounds = button.getBoundingClientRect();
    const radii = [style.borderTopLeftRadius, style.borderTopRightRadius,
      style.borderBottomLeftRadius, style.borderBottomRightRadius].map((value) => {
      const vertical = value.trim().split(/\s+/).at(-1)!;
      if (!/^\d+(\.\d+)?px$/.test(vertical)) throw new Error("Expected resolved pixel corner radius");
      return Number.parseFloat(vertical);
    });
    // Theme tokens may resolve to oklch()/color(), not only rgb(). Ask the
    // browser to resolve alpha without changing or approximating that color.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    context.fillStyle = style.backgroundColor;
    context.fillRect(0, 0, 1, 1);
    if (style.opacity !== "1" || context.getImageData(0, 0, 1, 1).data[3] !== 255) {
      throw new Error("Toggle must have an opaque background");
    }
    const inset = Math.ceil(Math.max(...radii));
    const clip = { x: Math.ceil(bounds.left), y: Math.ceil(bounds.top) + inset,
      width: Math.floor(bounds.right) - Math.ceil(bounds.left),
      height: Math.floor(bounds.bottom) - Math.ceil(bounds.top) - 2 * inset };
    const icon = button.querySelector("svg")?.getBoundingClientRect();
    if (!icon || clip.height <= 0 || icon.left < clip.x || icon.right > clip.x + clip.width ||
      icon.top < clip.y || icon.bottom > clip.y + clip.height) {
      throw new Error("Opaque snapshot band must contain the entire toggle icon");
    }
    return clip;
  });
}

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
  const toggles = await Promise.all([sidebarToggle, tocToggle].map(async (toggle) => ({
    ...toggle, clip: await opaqueToggleClip(page, toggle.selector),
  })));
  const nodes = await proveActiveNativeTransition(page, testInfo, {
    label: "actual-desktop-toggles",
    regions: [{ name: "zfb-header", selector: "header" }, ...toggles],
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
