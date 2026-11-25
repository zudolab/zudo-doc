import { test as browserTest, type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { spaClick } from "./nav-helpers";

const codePage = "/docs/guides/code-blocks-test";
const hiddenPage = "/docs/guides/frontmatter-preview-test";
const japanesePage = "/ja/docs/router-fragment-a";
const action = (page: Page) => page.locator("[data-zd-copy-markdown]");
const copyButton = (page: Page) => action(page).locator("button").first();
const artifactLink = (page: Page) => page.locator('link[rel="alternate"][type="text/markdown"]');
const codeTitle = "# Code Blocks Test";
const codeDescription = "A page for testing code blocks, tabs, details, and mermaid diagrams.";
const readClipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText());

async function artifact(page: Page) {
  const href = await artifactLink(page).getAttribute("href");
  expect(href).toMatch(/^\/agent\/v1\/pages\/p-[a-f0-9]+\.md$/);
  const response = await page.request.get(new URL(href!, page.url()).href);
  expect(response.ok()).toBe(true);
  return { href: href!, body: await response.text() };
}

test("copies the complete article into the real clipboard using keyboard activation", async ({ page, assertNoConsoleErrors }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(codePage);
  const { body } = await artifact(page);
  expect(body).toContain("```");
  expect(body).toContain("[External code reference](https://example.com/docs/reference/)");
  const button = copyButton(page);
  await expect(button).toHaveText("Copy Markdown", { useInnerText: true });
  const originalWidth = (await button.boundingBox())?.width;
  await button.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(button).toBeFocused();
  await expect(button).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(action(page).getByRole("status")).toHaveText("Copied");
  await expect(button).toBeFocused();
  expect((await button.boundingBox())?.width).toBe(originalWidth);
  expect(await readClipboard(page)).toBe([codeTitle, `Source: ${new URL(codePage, page.url()).href}`, codeDescription, body].join("\n\n"));
  await expect(button).toHaveAccessibleName("Copy Markdown");
  await page.goto("/docs/guides/math-test");
  const { body: mathBody } = await artifact(page);
  expect(mathBody).toContain("[Dynamic content unavailable in text export: MathBlock]");
  await copyButton(page).click();
  await expect(action(page).getByRole("status")).toHaveText("Copied");
  expect(await readClipboard(page)).toMatch(/\[Dynamic content unavailable in text export: MathBlock\]/);
  await assertNoConsoleErrors();
});

browserTest("announces a failed fetch and retries without opening an empty dialog", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(codePage);
  const { href } = await artifact(page);
  const gate = Promise.withResolvers<void>();
  let requests = 0;
  await page.route(`**${href}`, async (route) => {
    requests++;
    if (requests === 1) {
      await gate.promise;
      await route.fulfill({ status: 503 });
    } else {
      await route.continue();
    }
  });
  const button = copyButton(page);
  const firstRequest = page.waitForRequest(`**${href}`);
  await button.click();
  await firstRequest;
  await expect(action(page).getByRole("status")).toHaveText("Copying…");
  await button.press("Enter");
  gate.resolve();
  await expect(action(page).getByRole("status")).toHaveText("Could not load the Markdown. Try again.");
  expect(requests).toBe(1);
  await expect(action(page).getByRole("dialog")).toBeHidden();
  await button.click();
  await expect(action(page).getByRole("status")).toHaveText("Copied");
  expect(requests).toBe(2);
});

test("selects the full Japanese payload in the fallback and supports native clipboard retry", async ({ page, assertNoConsoleErrors }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    const actual = navigator.clipboard;
    const wrapped = {
      write: () => Promise.reject(new DOMException("Permission denied", "NotAllowedError")),
      writeText: (text: string) => actual.writeText(text),
      readText: () => actual.readText(),
    };
    Object.defineProperty(navigator, "clipboard", { value: wrapped });
  });
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(japanesePage);
  const { body } = await artifact(page);
  expect(body).toMatch(/\]\((?:https?:\/\/|\/ja\/docs\/)/);
  const payload = [ "# フラグメント履歴 A", `Source: ${new URL(japanesePage, page.url()).href}`, body ].join("\n\n");
  const button = copyButton(page);
  await expect(button).toHaveAccessibleName("Markdown をコピー");
  expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await button.click();
  const dialog = page.getByRole("dialog", { name: "Markdown を手動でコピー" });
  const field = dialog.getByRole("textbox", { name: "記事の Markdown" });
  const close = dialog.getByRole("button", { name: "閉じる" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  await expect(field).toBeFocused();
  await expect(field).toHaveValue(payload);
  const selected = () => field.evaluate((el: HTMLTextAreaElement) => el.value.slice(el.selectionStart, el.selectionEnd));
  expect(await selected()).toBe(payload);
  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(field).toBeFocused();
  await field.press("ArrowLeft");
  expect(await selected()).toBe("");
  await dialog.getByRole("button", { name: "すべて選択" }).click();
  expect(await selected()).toBe(payload);
  const retry = dialog.getByRole("button", { name: "コピー", exact: true });
  await retry.click();
  await expect(dialog.getByRole("status")).toHaveText("コピーしました");
  await expect(retry).toBeFocused();
  expect(await readClipboard(page)).toBe(payload);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();
  await assertNoConsoleErrors();
});

test("handles unavailable clipboard and closing the fallback during retry", async ({ page }) => {
  await page.addInitScript(() => {
    const pending = new Promise<void>((resolve) => {
      document.addEventListener("test-clipboard-finish", () => resolve(), { once: true });
    });
    document.addEventListener("test-clipboard-enable", () => {
      Object.defineProperty(navigator, "clipboard", { value: { writeText: () => pending } });
    }, { once: true });
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
  });
  await page.goto(codePage);
  const button = copyButton(page);
  await button.click();
  const dialog = page.getByRole("dialog", { name: "Copy Markdown manually" });
  await expect(dialog.getByRole("textbox")).not.toHaveValue("");
  await page.evaluate(() => document.dispatchEvent(new Event("test-clipboard-enable")));
  await dialog.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("Copying…");
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();
  await page.evaluate(() => document.dispatchEvent(new Event("test-clipboard-finish")));
  await expect(button).toHaveAccessibleName("Copy Markdown");
  await expect(dialog).toBeHidden();
});

test("aborts a pending article request on SPA navigation", async ({ page }) => {
  await page.addInitScript(() => {
    const fetchNative = window.fetch;
    window.fetch = (input, init) => {
      if (String(input).includes("/agent/v1/pages/")) {
        init?.signal?.addEventListener("abort", () => { document.documentElement.dataset.artifactAborted = "true"; });
      }
      return fetchNative(input, init);
    };
  });
  await page.goto(japanesePage);
  const { href, body } = await artifact(page);
  const gate = Promise.withResolvers<void>();
  await page.route(`**${href}`, async (route) => {
    await gate.promise;
    await route.fulfill({ contentType: "text/markdown", body });
  });
  const firstRequest = page.waitForRequest(`**${href}`);
  await copyButton(page).click();
  await firstRequest;
  try {
    expect(await spaClick(page, "/ja/docs/router-fragment-b")).toBe(true);
    await expect(page.locator("html")).toHaveAttribute("data-artifact-aborted", "true");
    await expect(copyButton(page)).toHaveAccessibleName("Markdown をコピー");
    await expect(action(page).getByRole("dialog")).toBeHidden();
  } finally {
    gate.resolve();
  }
});

test("fits long titles and keeps hidden actions out of the layout and frontmatter preview", async ({ page }) => {
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ colorScheme: width === 320 ? "dark" : "light" });
    await page.goto("/docs/guides/long-unbreakable-title-test");
    await expect(page.locator("html")).toHaveAttribute("data-theme", width === 320 ? "dark" : "light");
    await expect(copyButton(page)).toBeVisible();
    const button = (await copyButton(page).boundingBox())!;
    const title = (await page.locator("main h1").boundingBox())!;
    expect(button.height).toBeGreaterThanOrEqual(width < 640 ? 44 : 40);
    expect(button.x).toBeCloseTo(title.x, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
  await page.goto(hiddenPage);
  await expect(artifactLink(page)).toHaveCount(1);
  await expect(action(page)).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "copy_markdown" })).toHaveCount(0);
});

test("keeps the action out of the tab order without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    await page.goto(codePage);
    await expect(action(page)).toHaveAttribute("hidden", "");
    await expect(copyButton(page)).toBeHidden();
  } finally {
    await context.close();
  }
});
