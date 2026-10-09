import { test, expect } from "./fixtures";
import { spaClick } from "./nav-helpers";
import { waitForSidebarHydration } from "./sidebar-helpers";
import {
  appearanceMenu,
  appearanceOption,
  appearanceTrigger,
  openAppearanceMenu,
} from "./theme-helpers";
import { readDistFile } from "./smoke-dist-helper";

declare global {
  interface Window {
    __zudoRuntimeTransition?: {
      calls: number;
      status: "pending" | "fulfilled" | "rejected";
      error?: string;
    };
  }
}

const GUIDES_PAGE_1 = "/docs/guides/sub-a/page-1";
const GUIDES_PAGE_2 = "/docs/guides/sub-a/page-2";
const PRESET_PAGE = "/docs/guides/preset-generator-test";
const CODE_PAGE = "/docs/guides/code-blocks-test";
const MIGRATION_PARITY_PAGE = "/docs/guides/migration-parity-test";
const MIGRATION_PARITY_DIST_PAGE = "docs/guides/migration-parity-test/index.html";
const EXPECTED_NATIVE_PRE = "\nfirst line\nsecond line";
const EXPECTED_MIGRATION_CODE =
  "\nconst migrationParityFirst = 1;\nconst migrationParitySecond = 2;\n";

test("same-document navigation resolves its view transition and preserves mutated nested sidebar state", async ({
  page,
}) => {
  const documentRequests: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.resourceType() === "document") {
      documentRequests.push(request.url());
    }
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(GUIDES_PAGE_1, { waitUntil: "load" });
  await waitForSidebarHydration(page);

  const filter = page.locator('#desktop-sidebar input[placeholder^="Filter"]');
  await filter.fill("Sub A");
  await expect(filter).toHaveValue("Sub A");
  await expect(
    page.locator('#desktop-sidebar button[aria-label="Collapse Sub B"], #desktop-sidebar button[aria-label="Expand Sub B"]'),
  ).toBeHidden();

  const start = await page.evaluate(() => {
    const aside = document.querySelector<HTMLElement>("#desktop-sidebar");
    const input = document.querySelector<HTMLInputElement>(
      '#desktop-sidebar input[placeholder^="Filter"]',
    );
    if (!aside || !input) throw new Error("hydrated sidebar filter was not found");
    const documentWithTransition = document as Document & {
      startViewTransition?: (
        callback?: () => void | Promise<void>,
      ) => { finished: Promise<unknown> };
    };
    const original = documentWithTransition.startViewTransition;
    if (typeof original !== "function") {
      throw new Error("Chromium does not expose document.startViewTransition");
    }

    window.__zudoRuntimeTransition = { calls: 0, status: "pending" };
    const boundOriginal = original.bind(documentWithTransition);
    documentWithTransition.startViewTransition = (callback) => {
      const transition = boundOriginal(callback);
      const record = window.__zudoRuntimeTransition!;
      record.calls++;
      void transition.finished.then(
        () => { record.status = "fulfilled"; },
        (error: unknown) => {
          record.status = "rejected";
          record.error = error instanceof Error ? error.message : String(error);
        },
      );
      return transition;
    };

    const token = `sidebar-${Date.now()}-${Math.random()}`;
    (aside as HTMLElement & { __runtimeToken?: string }).__runtimeToken = token;
    (input as HTMLInputElement & { __runtimeToken?: string }).__runtimeToken = token;
    (window as Window & { __runtimeDocumentToken?: string }).__runtimeDocumentToken = token;
    return { token, timeOrigin: performance.timeOrigin };
  });

  expect(await spaClick(page, GUIDES_PAGE_2)).toBe(true);
  await expect(page).toHaveURL(/sub-a\/page-2/);
  await page.waitForFunction(
    () => window.__zudoRuntimeTransition?.status !== "pending",
    undefined,
    { timeout: 10_000 },
  );

  const after = await page.evaluate(() => {
    const aside = document.querySelector<HTMLElement>("#desktop-sidebar");
    const input = document.querySelector<HTMLInputElement>(
      '#desktop-sidebar input[placeholder^="Filter"]',
    );
    return {
      timeOrigin: performance.timeOrigin,
      documentToken: (window as Window & { __runtimeDocumentToken?: string }).__runtimeDocumentToken,
      asideToken: (aside as (HTMLElement & { __runtimeToken?: string }) | null)?.__runtimeToken,
      inputToken: (input as (HTMLInputElement & { __runtimeToken?: string }) | null)?.__runtimeToken,
      filterValue: input?.value,
      transition: window.__zudoRuntimeTransition,
    };
  });

  expect(documentRequests, "SPA navigation must not issue another document request").toHaveLength(1);
  expect(after.timeOrigin, "SPA navigation must keep the original Document alive").toBe(start.timeOrigin);
  expect(after.documentToken).toBe(start.token);
  expect(after.asideToken).toBe(start.token);
  expect(after.inputToken).toBe(start.token);
  expect(after.filterValue).toBe("Sub A");
  expect(after.transition).toMatchObject({ calls: 1, status: "fulfilled" });
  await expect(
    page.locator('#desktop-sidebar button[aria-label="Collapse Sub B"], #desktop-sidebar button[aria-label="Expand Sub B"]'),
  ).toBeHidden();
});

test("appearance menu uses a focused manual popover positioned within a narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 560 });
  await page.goto("/", { waitUntil: "load" });

  const trigger = appearanceTrigger(page);
  await expect(trigger).toBeVisible();
  await openAppearanceMenu(page, trigger);
  const menu = appearanceMenu(page);
  await expect(appearanceOption(page, "system")).toBeFocused();

  const placement = await menu.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      popover: element.getAttribute("popover"),
      open: element.matches(":popover-open"),
      visibility: getComputedStyle(element).visibility,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });

  expect(placement.popover).toBe("manual");
  expect(placement.open).toBe(true);
  expect(placement.visibility).toBe("visible");
  expect(placement.left).toBeGreaterThanOrEqual(8);
  expect(placement.right).toBeLessThanOrEqual(placement.viewportWidth - 8);
  expect(placement.top).toBeGreaterThanOrEqual(8);
  expect(placement.bottom).toBeLessThanOrEqual(placement.viewportHeight - 8);

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("preset generator array checkboxes, reorder, and reset produce the selected JSON order", async ({
  page,
}) => {
  await page.goto(PRESET_PAGE, { waitUntil: "load" });
  await expect(page.getByLabel("Project name")).toBeVisible();

  const headerSection = page
    .locator(".zd-preset-gen section")
    .filter({ has: page.getByRole("heading", { name: "Header right items" }) });
  const rows = headerSection.locator(":scope > ul > li");
  const search = headerSection.getByRole("checkbox", { name: "Include Search" });

  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Theme Toggle");
  await expect(rows.nth(1)).toContainText("Search");
  await expect(search).toBeChecked();

  await headerSection.getByRole("button", { name: "Move Search up" }).click();
  await expect(rows.nth(0)).toContainText("Search");
  await expect(rows.nth(1)).toContainText("Theme Toggle");

  await search.uncheck();
  await expect(search).not.toBeChecked();
  await headerSection.getByRole("button", { name: "Reset to default" }).click();
  await expect(search).toBeChecked();
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Theme Toggle");
  await expect(rows.nth(1)).toContainText("Search");

  await page.getByRole("button", { name: "Generate Preset" }).click();
  const dialog = page.locator("dialog").filter({ hasText: "Generated Preset" });
  await expect(dialog).toBeVisible();
  const config = JSON.parse(await dialog.locator("pre code").innerText()) as {
    headerRightItems: Array<{ type: string; component?: string; trigger?: string }>;
  };
  expect(config.headerRightItems).toEqual([
    { type: "component", component: "theme-toggle" },
    { type: "component", component: "search" },
  ]);
});

test("AI chat ignores Enter during IME composition, then submits normally", async ({ page }) => {
  let submissions = 0;
  await page.route("**/api/ai-chat", async (route) => {
    submissions++;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ response: "IME submission completed" }),
    });
  });

  await page.goto("/docs/getting-started", { waitUntil: "load" });
  await page.locator("#ai-chat-trigger").click();
  const dialog = page.locator("dialog").filter({ hasText: "AI Assistant" });
  await expect(dialog).toBeVisible();
  const input = dialog.getByLabel("Type your message");
  await input.fill("Japanese composition");

  await input.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
      isComposing: true,
    }));
  });

  expect(submissions, "composing Enter must not submit the chat request").toBe(0);
  await expect(input).toHaveValue("Japanese composition");
  await expect(dialog.getByRole("log").getByText("Japanese composition")).toHaveCount(0);

  await input.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
  });
  await input.press("Enter");
  await expect(dialog.getByText("IME submission completed")).toBeVisible();
  expect(submissions).toBe(1);
});

test("DocHistory keeps the open revision panel current across two distinct comparisons", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(MIGRATION_PARITY_PAGE, { waitUntil: "load" });

  const trigger = page.locator('[aria-label="View document history"]');
  await trigger.waitFor({ state: "visible", timeout: 15_000 });
  await trigger.click();

  const panel = page.locator('dialog[aria-label="Document revision history"]');
  await expect(panel).toHaveAttribute("open", "");
  const revisionA = panel.locator(
    '[aria-label^="Select revision"][aria-label$="as A"]',
  );
  await expect(revisionA).toHaveCount(3, { timeout: 15_000 });

  const hashes = await revisionA.evaluateAll((buttons) => buttons.map((button) => {
    const match = button.getAttribute("aria-label")?.match(
      /^Select revision ([0-9a-f]+) as A$/,
    );
    if (!match?.[1]) throw new Error("revision button omitted its hash");
    return match[1];
  }));
  expect(new Set(hashes).size).toBe(3);

  const compare = panel.getByRole("button", { name: "Compare", exact: true });
  await compare.click();
  await expect(panel.getByRole("heading", { name: "Diff", exact: true })).toBeVisible();
  await expect(panel).toHaveAttribute("open", "");
  const diffCells = panel.locator("td.diff-line-content");

  // The initial pair is the newest two revisions: revision two is shared
  // context on both sides and revision three is newly added.
  const revisionTwoCells = diffCells.filter({ hasText: "History revision two." });
  const revisionThreeCells = diffCells.filter({ hasText: "History revision three." });
  await expect(revisionTwoCells).toHaveCount(2);
  const firstRevisionTwoClasses = await revisionTwoCells.evaluateAll((cells) =>
    cells.map((cell) => cell.className),
  );
  expect(firstRevisionTwoClasses.every((className) => !className.includes("diff-line-added"))).toBe(true);
  await expect(revisionThreeCells).toHaveCount(1);
  await expect(revisionThreeCells).toHaveClass(/diff-line-added/);

  // Select the oldest revision as A while the same dialog and diff Show remain
  // open. This creates a different pair (oldest,newest), whose table must now
  // show both added history markers rather than the previous pair's one.
  await revisionA.nth(2).click();
  expect(hashes[2]).not.toBe(hashes[1]);
  await compare.click();
  await expect(panel.getByRole("heading", { name: "Diff", exact: true })).toBeVisible();
  await expect(panel).toHaveAttribute("open", "");
  await expect(revisionTwoCells).toHaveCount(1);
  await expect(revisionTwoCells).toHaveClass(/diff-line-added/);
  await expect(revisionThreeCells).toHaveCount(1);
  await expect(revisionThreeCells).toHaveClass(/diff-line-added/);
});

test("built article preserves list start and pre LF, then copies the authored code exactly", async ({
  page,
}) => {
  const builtHtml = readDistFile(MIGRATION_PARITY_DIST_PAGE);
  expect(builtHtml).toMatch(
    /<ol\b(?=[^>]*\sstart\s*=\s*(?:"3"|'3'|3)(?=[\s>]))[^>]*>/,
  );
  const renderedPre = builtHtml.match(
    /<pre\b[^>]*data-migration-parity-lf[^>]*>([\s\S]*?)<\/pre>/,
  );
  expect(renderedPre?.[1]).toBe("\n\nfirst line\nsecond line");

  await page.goto(MIGRATION_PARITY_PAGE, { waitUntil: "load" });
  const list = page.locator("main ol[start=\"3\"]");
  await expect(list).toHaveCount(1);
  await expect(list.locator("li")).toHaveText(["Third step", "Fourth step"]);

  const nativePre = page.locator("main pre[data-migration-parity-lf]");
  await expect(nativePre).toHaveCount(1);
  expect(await nativePre.textContent()).toBe(EXPECTED_NATIVE_PRE);

  const codeBlock = page
    .locator("main .code-block-container", { hasText: "migration-parity-leading-lf.js" })
    .locator("pre.hi-root");
  const code = codeBlock.locator("code");
  await expect(code).toBeAttached();
  expect(await code.textContent()).toBe(EXPECTED_MIGRATION_CODE);

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const copyButton = codeBlock
    .locator("xpath=..")
    .getByRole("button", { name: "Copy code" });
  await copyButton.scrollIntoViewIfNeeded();
  await copyButton.hover();
  await expect(copyButton).toBeVisible();
  await copyButton.click();
  await expect(copyButton).toHaveClass(/copied/);

  const copiedCode = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedCode).toBe(EXPECTED_MIGRATION_CODE);
});
