import { expect, test } from "./fixtures";

// Inject a browser History rejection on the existing router race fixture.
// This verifies recovery on Linux Chromium; it does not simulate WebKit's quota.
for (const method of ["pushState", "replaceState"] as const) {
  test(`rejected ${method} keeps the old DOM until one document recovery`, async ({ page, assertNoConsoleErrors }) => {
    await page.goto("/docs/router-race-a", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Number.isFinite(history.state?.index));
    const destination = page.getByRole("link", { name: "Navigate to race page B" });
    if (method === "replaceState") await destination.evaluate(link => link.setAttribute("data-zfb-history", "replace"));
    await page.evaluate(historyMethod => {
      const initialIndex = history.state.index;
      const original = history[historyMethod].bind(history);
      history[historyMethod] = ((...args: Parameters<History["pushState"]>) => {
        if (args[2] != null) {
          sessionStorage.setItem("history-rejection", JSON.stringify({
            path: location.pathname,
            heading: document.querySelector("h1")?.textContent,
            index: history.state.index,
            initialIndex,
          }));
          throw new DOMException("Injected rejected History URL write", "SecurityError");
        }
        original(...args);
      }) as History[typeof historyMethod];
      document.addEventListener("zfb:after-swap", () => sessionStorage.setItem("rejected-swap", "yes"));
    }, method);
    const documents: string[] = [];
    page.on("request", request => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
    });
    await destination.click();
    await expect(page).toHaveURL(/\/docs\/router-race-b\/?$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Router Race Page B");
    const evidence = await page.evaluate(() => ({
      rejected: JSON.parse(sessionStorage.getItem("history-rejection") ?? "null"),
      swapped: sessionStorage.getItem("rejected-swap"),
    }));
    expect(evidence.rejected.path).toMatch(/^\/docs\/router-race-a\/?$/);
    expect(evidence.rejected.heading).toBe("Router Race Page A");
    expect(evidence.rejected.index).toBe(evidence.rejected.initialIndex);
    expect(evidence.swapped).toBeNull();
    expect(documents).toHaveLength(1);
    expect(new URL(documents[0]!).pathname).toMatch(/^\/docs\/router-race-b\/?$/);
    assertNoConsoleErrors();
  });
}
