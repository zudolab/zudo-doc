import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures";

const SHELL = ".tokenpanel-shell";
const TOKEN = "--spacing-image-overlay-inset";

async function openPanel(page: Page) {
  await page.goto("/docs/getting-started/", { waitUntil: "load" });
  await page.locator("#design-token-trigger").click();
  await expect(page.locator(SHELL)).toBeVisible();
}

// Locator.click uses browser pointer hit-testing. Never force these clicks: an
// overlapping compact-header target is exactly the regression under test.
async function chooseDock(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true }).filter({ visible: true });
  if (await button.count() === 0) {
    const actions = page.getByRole("button", { name: "Panel actions", exact: true });
    await actions.click();
    await expect(actions).toHaveAttribute("aria-expanded", "true");
  }
  await expect(button).toHaveCount(1);
  await button.click();
}

async function hostState(page: Page) {
  return page.evaluate(() => {
    const read = (style: CSSStyleDeclaration, property: string) => ({
      value: style.getPropertyValue(property),
      priority: style.getPropertyPriority(property),
    });
    return {
      right: read(document.body.style, "margin-right"),
      bottom: read(document.body.style, "margin-bottom"),
      rightInset: read(document.documentElement.style, "--zdtp-dock-inset-right"),
      bottomInset: read(document.documentElement.style, "--zdtp-dock-inset-bottom"),
    };
  });
}

type HostState = Awaited<ReturnType<typeof hostState>>;

async function expectDock(page: Page, edge: "right" | "bottom", original: HostState) {
  await expect(page.locator(SHELL)).toHaveClass(new RegExp(`\\bis-docked-${edge}\\b`));
  await expect.poll(async () => {
    const state = await hostState(page);
    const box = await page.locator(SHELL).boundingBox();
    if (!box) return false;
    const size = edge === "right" ? box.width : box.height;
    const margin = state[edge];
    const inset = state[edge === "right" ? "rightInset" : "bottomInset"];
    const other = edge === "right" ? "bottom" : "right";
    const otherInset = edge === "right" ? "bottomInset" : "rightInset";
    return size > 0 && Math.abs(parseFloat(margin.value) - size) <= 1 &&
      margin.priority === "" && inset.value === margin.value && inset.priority === "" &&
      JSON.stringify(state[other]) === JSON.stringify(original[other]) &&
      JSON.stringify(state[otherInset]) === JSON.stringify(original[otherInset]);
  }).toBe(true);
}

async function rowGeometry(row: Locator) {
  return row.evaluate((element) => {
    const label = element.querySelector<HTMLElement>(".tokenpanel-row-label");
    const column = element.closest(".tokenpanel-tab-section");
    if (!label || !column) throw new Error("Missing spacing row geometry");
    const bounds = element.getBoundingClientRect();
    const columnBounds = column.getBoundingClientRect();
    const style = getComputedStyle(label);
    const probe = document.createElement("span");
    Object.assign(probe.style, {
      position: "fixed",
      visibility: "hidden",
      whiteSpace: "pre",
      font: style.font,
      letterSpacing: style.letterSpacing,
    });
    probe.textContent = `${label.textContent!.slice(0, 8)}…`;
    document.body.append(probe);
    const prefixWidth = probe.getBoundingClientRect().width;
    probe.remove();
    const contentWidth = label.getBoundingClientRect().width -
      parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) -
      parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
    return {
      height: bounds.height,
      prefixVisible: contentWidth + 0.1 >= prefixWidth &&
        style.visibility === "visible" && style.opacity !== "0",
      contained: bounds.left >= columnBounds.left && bounds.right <= columnBounds.right &&
        element.scrollWidth <= element.clientWidth,
      labelOverflow: style.overflowX,
    };
  });
}

test.describe("Design token panel compact UI regressions", () => {
  test("long changed Spacing labels retain eight characters without growing or escaping their column", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPanel(page);
    await page.getByRole("tab", { name: /^Spacing\b/ }).click();
    await chooseDock(page, "Dock panel right (Alt+2)");
    await page.setViewportSize({ width: 440, height: 900 });
    const row = page.getByTestId("tier-item-image-overlay-inset");
    await row.scrollIntoViewIfNeeded();
    await expect(row).toBeVisible();
    const shellBox = await page.locator(SHELL).boundingBox();
    expect(shellBox!.width).toBeLessThanOrEqual(440);
    const before = await rowGeometry(row);
    const input = row.getByLabel(`${TOKEN} value`, { exact: true });
    const originalInput = await input.inputValue();
    const originalCss = await page.evaluate((token) => getComputedStyle(document.documentElement).getPropertyValue(token).trim(), TOKEN);
    await input.fill("1.23456789");
    await expect(row).toHaveClass(/\bis-changed\b/);
    await expect(row.getByTestId("tokenpanel-changed-tail")).toHaveAttribute("title", `default ${originalCss} → 1.23456789rem`);
    await expect.poll(() => page.evaluate((token) => getComputedStyle(document.documentElement).getPropertyValue(token).trim(), TOKEN)).toBe("1.23456789rem");
    const after = await rowGeometry(row);
    expect(after.prefixVisible).toBe(true);
    expect(after.labelOverflow).toBe("hidden");
    expect(after.contained).toBe(true);
    expect(after.height).toBeLessThanOrEqual(before.height);
    await row.getByRole("button", { name: `Revert ${TOKEN}`, exact: true }).click();
    await expect(row).not.toHaveClass(/\bis-changed\b/);
    await expect(row.getByTestId("tokenpanel-changed-tail")).toHaveCount(0);
    await expect(input).toHaveValue(originalInput);
    await expect.poll(() => page.evaluate((token) => getComputedStyle(document.documentElement).getPropertyValue(token).trim(), TOKEN)).toBe(originalCss);
  });

  for (const width of [440, 320]) {
    test(`right dock escape controls release and reclaim host styles at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await openPanel(page);
      // Nonempty values and mixed priorities prove restoration, not merely
      // removal of the panel's properties. Seed before the first dock claim.
      await page.evaluate(() => {
        document.body.style.setProperty("margin-right", "13px", "important");
        document.body.style.setProperty("margin-bottom", "17px");
        document.documentElement.style.setProperty("--zdtp-dock-inset-right", "3px", "important");
        document.documentElement.style.setProperty("--zdtp-dock-inset-bottom", "5px");
      });
      const original = await hostState(page);
      await chooseDock(page, "Dock panel right (Alt+2)");
      await page.setViewportSize({ width, height: 900 });
      await expectDock(page, "right", original);
      await chooseDock(page, "Float panel (Alt+1)");
      await expect(page.locator(SHELL)).not.toHaveClass(/is-docked-/);
      await expect.poll(() => hostState(page)).toEqual(original);
      await chooseDock(page, "Dock panel right (Alt+2)");
      await expectDock(page, "right", original);
      await chooseDock(page, "Dock panel bottom (Alt+3)");
      await expectDock(page, "bottom", original);
      await chooseDock(page, "Dock panel right (Alt+2)");
      await expectDock(page, "right", original);
      await chooseDock(page, "Mini panel (Alt+4)");
      await expect(page.getByTestId("tokenpanel-mini-pill")).toBeVisible();
      await expect(page.locator(SHELL)).toBeHidden();
      await expect.poll(() => hostState(page)).toEqual(original);
      await page.getByRole("button", { name: "Expand panel", exact: true }).click();
      await expect(page.getByTestId("tokenpanel-mini-pill")).toBeHidden();
      await expectDock(page, "right", original);
      await page.getByRole("button", { name: "Close panel", exact: true }).click();
      await expect(page.locator(SHELL)).toBeHidden();
      await expect.poll(() => hostState(page)).toEqual(original);
    });
  }

  test("actions menu stays open while its rendered trigger is visible and closes when hidden", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPanel(page);
    await chooseDock(page, "Dock panel bottom (Alt+3)");
    await page.setViewportSize({ width: 440, height: 900 });
    const trigger = page.locator(".tokenpanel-actions-menu-btn");
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    // Keep the rendered compact trigger visible across a resize. The
    // docked shell width, not a separately retained floating width, governs it.
    await page.setViewportSize({ width: 460, height: 900 });
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".tokenpanel-dock-modes.is-compact")).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(trigger).toBeHidden();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".tokenpanel-dock-modes.is-compact")).toBeHidden();
    await page.setViewportSize({ width: 440, height: 900 });
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});
