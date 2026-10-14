/** A deliberately visible loading overlay must not contaminate native snapshots. */
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
  visibleSnapshotClip,
} from "./native-transition-helpers";

test.use({ viewport: { width: 1280, height: 900 } });

test("slow native navigation extracts visible loading feedback without dimming stationary chrome", async ({ page }, testInfo) => {
  await page.goto("/docs/guides/page-1/");
  await waitForSidebarHydration(page);
  await installNativeTransitionProbe(page);

  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/docs/guides/toc-test*", async (route) => {
    await gate;
    await route.continue();
  });
  const navigation = navigateNativeTransition(page, "/docs/guides/toc-test");
  const overlay = page.locator("#page-loading-overlay");
  try {
    // Hold the fetch until pending feedback is fully painted. No fixed delay
    // and no computed pseudo style can substitute for the native proof below.
    await expect(overlay).toHaveAttribute("data-visible", "");
    await expect(overlay).toHaveCSS("opacity", "1");
    await expect(overlay).toHaveCSS("view-transition-name", "zfb-loading");
  } finally { release(); }
  await navigation;

  const nodes = await proveActiveNativeTransition(page, testInfo, {
    label: "slow-loading-native",
    regions: [
      { name: "zfb-header", selector: "body > header" },
      { name: "zfb-sidebar", selector: "#desktop-sidebar" },
    ],
  });
  const loading = nodes.filter((node) => node.name === "zfb-loading");
  const groups = loading.filter((node) => node.type === "view-transition-group");
  expect(groups, "Visible pending feedback must create a real extracted native group").toHaveLength(1);
  expect(groups[0]!.parent).toBe("view-transition");
  expect(groups[0]!.style["animation-name"]).toBe("none");
  // Chromium may omit display:none image nodes from CDP even though their
  // captured pixels exist. Reveal that exact old image as a counterfactual,
  // without advancing the held article animation or altering the live overlay.
  const clip = await visibleSnapshotClip(page, "main");
  const heldTime = () => page.evaluate(() => {
    const animation = window.__zdNativeTransitionProof!.animations.find((candidate) =>
      (candidate.effect as KeyframeEffect | null)?.pseudoElement === "::view-transition-new(root)");
    if (!animation || typeof animation.currentTime !== "number" || animation.playState !== "paused") {
      throw new Error("Counterfactual requires the same paused native content animation");
    }
    return animation.currentTime;
  });
  const screenshot = async (label: string) => {
    const path = testInfo.outputPath(`${label}.png`);
    const pixels = await page.screenshot({ path, clip, animations: "allow" });
    await testInfo.attach(label, { path, contentType: "image/png" });
    return pixels;
  };
  const commitFrame = () => page.evaluate(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  const time = await heldTime();
  const hidden = await screenshot("loading-suppressed");
  let exposedNodes: Awaited<ReturnType<typeof nativeSnapshots>> = [];
  try {
    await page.evaluate(() => {
      const style = document.createElement("style");
      style.id = "native-loading-counterfactual";
      // Disable the newly exposed image's UA fade so only suppression changes.
      // The source pixels remain the real old snapshot, not a live DOM overlay.
      style.textContent = "::view-transition-old(zfb-loading){display:block!important;animation:none!important;opacity:1!important}";
      document.head.append(style);
    });
    await commitFrame();
    exposedNodes = await nativeSnapshots(page);
    const old = exposedNodes.filter((node) => node.name === "zfb-loading" && node.type === "view-transition-old");
    expect(old, "Revealing suppression must expose an actual captured old loading image").toHaveLength(1);
    expect(old[0]!.style.display).toBe("block");
    expect(old[0]!.style.opacity).toBe("1");
    const exposed = await screenshot("loading-old-image-exposed");
    expect(exposed.equals(hidden), "The real captured scrim must visibly change article pixels when exposed").toBe(false);
    expect(await heldTime(), "Only loading-image suppression may change between frames").toBe(time);
    expect((await readNativeTransitionRecord(page)).finished).toBe("pending");
  } finally {
    await page.evaluate(() => document.getElementById("native-loading-counterfactual")?.remove());
    await commitFrame();
  }
  const restored = await screenshot("loading-suppression-restored");
  expect(restored.equals(hidden), "Restoring suppression must restore the exact same active article pixels").toBe(true);
  expect(await heldTime()).toBe(time);
  expect((await readNativeTransitionRecord(page)).finished).toBe("pending");
  await testInfo.attach("loading-counterfactual-native.json", {
    body: JSON.stringify({ heldTime: time, suppressedNodes: loading, exposedNodes }, null, 2),
    contentType: "application/json",
  });
  await finishNativeTransition(page);
  await expect(page).toHaveURL(/\/docs\/guides\/toc-test\/?$/);
  await expect(overlay).not.toHaveAttribute("data-visible");
  await expect(overlay).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("[data-zd-nav-pending]")).toHaveCount(0);
});
