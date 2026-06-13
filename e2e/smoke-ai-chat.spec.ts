import { test, expect } from "@playwright/test";

const DOCS_PAGE = "/docs/getting-started";

/** Locator for the AI chat dialog (distinguished from search and doc-history dialogs). */
function chatDialog(page: import("@playwright/test").Page) {
  return page.locator("dialog").filter({ hasText: "AI Assistant" });
}

test.describe("AI chat dialog", () => {
  test("clicking sparkle icon opens the dialog", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    const trigger = page.locator("#ai-chat-trigger");
    await expect(trigger).toBeVisible();

    await trigger.click();

    const dialog = chatDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("h2")).toHaveText("AI Assistant");
  });

  test("Escape closes the dialog", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    await page.locator("#ai-chat-trigger").click();
    const dialog = chatDialog(page);
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(dialog).not.toBeVisible();
  });

  test("successful response renders markdown", async ({ page }) => {
    // Mock the API to return a markdown response
    await page.route("**/api/ai-chat", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          response:
            "Here is the answer:\n\n- **Bold item** in a list\n- Second item with `code`\n\n1. First ordered\n2. Second ordered",
        }),
      }),
    );

    await page.goto(DOCS_PAGE, { waitUntil: "load" });
    await page.locator("#ai-chat-trigger").click();

    const dialog = chatDialog(page);
    await expect(dialog).toBeVisible();

    // Type and send a message
    const input = dialog.getByPlaceholder("Type your message...");
    await input.fill("How do I get started?");
    await input.press("Enter");

    // User message should appear
    await expect(dialog.getByText("How do I get started?")).toBeVisible();

    // Wait for assistant response with rendered markdown
    const response = dialog.locator(".ai-chat-md");
    await expect(response).toBeVisible({ timeout: 5000 });

    // Verify markdown was rendered (not raw text)
    await expect(response.locator("strong")).toHaveText("Bold item");
    await expect(response.locator("code")).toHaveText("code");
    await expect(response.locator("ul li")).toHaveCount(2);
    await expect(response.locator("ol li")).toHaveCount(2);
  });

  test("API error shows error message", async ({ page }) => {
    // Mock the API to return an error
    await page.route("**/api/ai-chat", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Service unavailable" }),
      }),
    );

    await page.goto(DOCS_PAGE, { waitUntil: "load" });
    await page.locator("#ai-chat-trigger").click();

    const dialog = chatDialog(page);
    await expect(dialog).toBeVisible();

    const input = dialog.getByPlaceholder("Type your message...");
    await input.fill("test");
    await input.press("Enter");

    // Error message should appear
    await expect(dialog.getByText("Service unavailable")).toBeVisible({
      timeout: 5000,
    });
  });

  test("closing dialog resets state", async ({ page }) => {
    await page.route("**/api/ai-chat", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ response: "Hello!" }),
      }),
    );

    await page.goto(DOCS_PAGE, { waitUntil: "load" });
    await page.locator("#ai-chat-trigger").click();

    const dialog = chatDialog(page);
    const input = dialog.getByPlaceholder("Type your message...");

    // Send a message
    await input.fill("hi");
    await input.press("Enter");
    await expect(dialog.locator(".ai-chat-md")).toBeVisible({ timeout: 5000 });

    // Close and reopen
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();

    await page.locator("#ai-chat-trigger").click();
    await expect(dialog).toBeVisible();

    // Messages should be cleared
    await expect(dialog.locator(".ai-chat-md")).not.toBeVisible();
    await expect(input).toHaveValue("");
  });
});

// Regression guard for #1624 T3: reopening the chat dialog after an SPA
// navigation must not throw InvalidStateError (dialog.showModal on a dialog
// detached/re-attached by the swap).
test("opening chat after SPA navigation does not throw InvalidStateError", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/docs/getting-started", { waitUntil: "load" });
  const trigger = page.locator("#ai-chat-trigger");
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.locator("dialog").filter({ hasText: "AI Assistant" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();

  await page.locator('header a[href="/docs/guides"]').first().click();
  await page.waitForURL(/\/docs\/guides/, { timeout: 15000 });

  const triggerAfterNav = page.locator("#ai-chat-trigger");
  await expect(triggerAfterNav).toBeVisible({ timeout: 5000 });
  await triggerAfterNav.click();
  const dialogAfterNav = page.locator("dialog").filter({ hasText: "AI Assistant" });
  await expect(dialogAfterNav).toBeVisible({ timeout: 5000 });

  const invalidStateErrors = errors.filter((e) => e.includes("InvalidStateError"));
  expect(invalidStateErrors).toHaveLength(0);
  const isOpen = await dialogAfterNav.evaluate((el) => (el as HTMLDialogElement).open);
  expect(isOpen).toBe(true);
});
