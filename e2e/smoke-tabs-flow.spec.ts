import { test, expect, type Locator } from "@playwright/test";

const PAGE = "/docs/guides/tabs-flow-test";

async function rhythm(panel: Locator) {
  return panel.evaluate((element) => {
    const tokens = Object.fromEntries(
      ["xs", "sm", "md", "lg", "xl", "2xl"].map((name) => {
        const probe = document.createElement("div");
        probe.style.height = `var(--spacing-vsp-${name})`;
        element.append(probe);
        const value = probe.getBoundingClientRect().height;
        probe.remove();
        return [name, value];
      }),
    );
    const blocks = Array.from(element.children).map((child, index, children) => {
      const box = child.getBoundingClientRect();
      return {
        tag: child.tagName,
        margin: parseFloat(getComputedStyle(child).marginTop),
        gap: index ? box.top - children[index - 1]!.getBoundingClientRect().bottom : 0,
        padding: parseFloat(getComputedStyle(child).paddingTop),
      };
    });
    const nav = element.closest("[data-tabs]")?.querySelector("[data-tabs-nav]");
    const navGap = nav ? element.getBoundingClientRect().top - nav.getBoundingClientRect().bottom : null;
    return { tokens, blocks, navGap };
  });
}

function close(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThan(0.75);
}

for (const width of [1440, 390]) {
  for (const javaScriptEnabled of [false, true]) {
    test(`panel flow at ${width}px, JavaScript ${javaScriptEnabled}`, async ({ browser }, testInfo) => {
      const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, javaScriptEnabled, viewport: { width, height: 900 } });
      const page = await context.newPage();
      try {
        await page.goto(PAGE);
        const panel = page.locator('[data-tab-value="basic"]');
        await expect(panel).toBeVisible();
        if (javaScriptEnabled) {
          await expect(panel.locator(":scope > .code-block-wrapper")).toHaveCount(2);
        } else {
          await expect(panel.locator(":scope > pre")).toHaveCount(2);
          await expect(panel.locator(".code-block-wrapper")).toHaveCount(0);
        }
        const evidence = await rhythm(panel);
        await testInfo.attach("panel-geometry", { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
        await testInfo.attach("panel-view", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
        const { tokens, blocks } = evidence;
        expect(blocks).toHaveLength(18);
        close(blocks[0]!.margin, 0);
        close(evidence.navGap!, 0);
        close(blocks[0]!.padding, tokens.sm!);
        close(blocks[10]!.padding, tokens.xs!);
        const defaultCode = page.locator('[data-tab-value="default-code-only"]');
        await expect(defaultCode).toBeVisible();
        await expect(defaultCode.locator(javaScriptEnabled ? ":scope > .code-block-wrapper" : ":scope > pre")).toHaveCount(1);
        const defaultCodeRhythm = await rhythm(defaultCode);
        expect(defaultCodeRhythm.blocks).toHaveLength(1);
        close(defaultCodeRhythm.blocks[0]!.margin, 0);
        close(defaultCodeRhythm.navGap!, 0);
        // h2 → code → Tip → Note → paragraph → code, then ordinary prose.
        for (const index of [2, 3, 4, 5, 6, 7]) {
          close(blocks[index]!.margin, tokens.md!);
          close(blocks[index]!.gap, tokens.md!);
        }
        close(blocks[1]!.margin, tokens.xs!);
        close(blocks[1]!.gap, tokens.xs!);
        for (const [index, token] of [[8, "2xl"], [10, "xl"], [11, "xs"], [13, "md"], [15, "md"], [17, "md"]] as const) {
          close(blocks[index]!.margin, tokens[token]!);
          close(blocks[index]!.gap, tokens[token]!);
        }
        for (const index of [9, 12, 14, 16]) close(blocks[index]!.gap, tokens.xs!);
        const control = await page.locator(".zd-content > p").filter({ hasText: "Another ordinary paragraph." }).evaluate((el) => ({
          margin: parseFloat(getComputedStyle(el).marginTop),
          gap: el.getBoundingClientRect().top - el.previousElementSibling!.getBoundingClientRect().bottom,
        }));
        close(control.margin, tokens.md!);
        close(control.gap, blocks[7]!.gap);
        const tip = panel.locator(".admonition-body").first();
        const body = await rhythm(tip);
        close(body.blocks[1]!.gap, tokens.sm!);
        close(body.blocks[0]!.margin, 0);
        const titleGap = (element: Element) => {
          const title = element.querySelector(".admonition-title")!;
          const body = element.querySelector(".admonition-body")!;
          return body.getBoundingClientRect().top - title.getBoundingClientRect().bottom;
        };
        close(await panel.locator("[data-admonition]").first().evaluate(titleGap), await page.locator(".zd-content > [data-admonition]").first().evaluate(titleGap));
        const controlNote = page.locator('.zd-content > [data-admonition]').nth(1);
        close(await controlNote.evaluate(el => parseFloat(getComputedStyle(el).marginTop)), blocks[3]!.margin);
        // Internal pre and controls must not receive a second flow margin.
        for (const margin of await panel.locator(".code-block-wrapper > pre, .code-buttons, .code-btn").evaluateAll(els => els.map(el => parseFloat(getComputedStyle(el).marginTop)))) close(margin, 0);
        const override = panel.locator(":scope > p").last();
        await override.evaluate(el => el.classList.add("mt-vsp-xl"));
        const overridden = await rhythm(panel);
        close(overridden.blocks[17]!.margin, tokens.xl!);
        close(overridden.blocks[17]!.gap, tokens.xl!);
        const hidden = page.locator('[data-tab-value="node-free"]');
        const only = page.locator('[data-tab-value="code-only"]');
        await expect(hidden).toBeHidden();
        await expect(only).toBeHidden();
        if (javaScriptEnabled) {
          await page.locator('[data-tab-btn="node-free"]').click();
          await expect(hidden).toBeVisible();
          await expect(panel).toBeHidden();
          const other = await rhythm(hidden);
          for (const [index, token] of [[1, "md"], [2, "2xl"], [3, "xs"], [4, "md"], [5, "md"], [6, "lg"], [7, "xs"]] as const) close(other.blocks[index]!.gap, tokens[token]!);
          await page.locator('[data-tab-btn="code-only"]').click();
          await expect(only).toBeVisible();
          await expect(hidden).toBeHidden();
          const codeOnly = await rhythm(only);
          expect(codeOnly.blocks).toHaveLength(1);
          close(codeOnly.blocks[0]!.margin, 0);
        }
      } finally {
        await context.close();
      }
    });
  }
}
