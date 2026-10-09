import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).persistenceControl = { activations: 0, cleanups: 0, helperReady: false };
  });
});

for (const scenario of ["unchanged", "changed", "preserve", "structural"] as const) {
  test(`real navigation: ${scenario}`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(`${message.text()} at ${JSON.stringify(message.location())}`); });
    const failedResponses: { url: string; status: number }[] = [];
    page.on("response", response => { if (response.status() >= 400) failedResponses.push({ url: response.url(), status: response.status() }); });
    let documentRequests = 0;
    page.on("request", request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentRequests++; });
    const start = scenario === "preserve" ? "preserve-a" : "same-a";
    await page.goto(`/${start}/`);
    await expect.poll(() => page.evaluate(() => (window as any).persistenceControl)).toEqual({ activations: 1, cleanups: 0, helperReady: true });
    const baselineRequests = documentRequests;
    const origin = await page.evaluate(() => performance.timeOrigin);
    const doc = await page.evaluateHandle(() => document);
    const ancestor = await page.locator("#persisted").elementHandle();
    const counter = await page.locator("#counter").elementHandle();
    const button = await page.locator("#increment").elementHandle();
    await page.locator("#increment").click();
    await page.locator("#increment").click();
    await expect(page.locator("#count")).toHaveText("2");
    const targets = scenario === "unchanged" ? ["same-b", "same-a"] : [scenario === "preserve" ? "preserve-b" : scenario];
    const captures = [];
    for (const target of targets) {
      await page.evaluate(() => {
        (window as any).persistenceSwap = new Promise(resolve => document.addEventListener("zfb:after-swap", () => resolve(true), { once: true }));
      });
      await page.locator(`nav a[href="/${target}/"]`).click();
      await page.evaluate(() => (window as any).persistenceSwap);
      await expect(page.locator("#route")).toHaveText(target);
      const retained = scenario === "unchanged" || scenario === "preserve";
      await expect.poll(() => page.evaluate(() => (window as any).persistenceControl)).toEqual({ activations: retained ? 1 : 2, cleanups: retained ? 0 : 1, helperReady: true });
      await expect(page.locator("#count")).toHaveText(retained ? "2" : "0");
      await expect(page.locator("#label")).toHaveText(scenario === "changed" ? "changed" : "original");
      expect(await doc.evaluate(node => node === document)).toBe(true);
      expect(await ancestor!.evaluate(node => node === document.querySelector("#persisted"))).toBe(scenario !== "structural");
      expect(await counter!.evaluate(node => node === document.querySelector("#counter"))).toBe(retained);
      expect(await button!.evaluate(node => node === document.querySelector("#increment"))).toBe(retained);
      expect(await page.evaluate(() => performance.timeOrigin)).toBe(origin);
      expect(documentRequests).toBe(baselineRequests);
      if (scenario === "structural") await expect(page.locator("#added-structure")).toBeVisible();
      captures.push({ target, lifecycle: await page.evaluate(() => (window as any).persistenceControl), documentRequests, origin });
    }
    // A retained event listener must still drive the original local signal.
    await page.locator("#increment").click();
    await expect(page.locator("#count")).toHaveText(scenario === "unchanged" || scenario === "preserve" ? "3" : "1");
    await testInfo.attach("lifecycle-and-navigation", { body: JSON.stringify({ captures, errors, failedResponses }, null, 2), contentType: "application/json" });
    expect(errors).toEqual([]);
    expect(failedResponses).toEqual([]);
  });
}
