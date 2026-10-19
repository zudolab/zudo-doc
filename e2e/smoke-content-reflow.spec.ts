import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test, expect, type Page } from "@playwright/test";

/**
 * #4585: ordinary content must inherit emergency wrapping from the shipped
 * stylesheet, without each host copying a .zd-content override.
 *
 * This is an isolated browser consumer of the built public CSS export, not a
 * substitute for full-site/header or installed-consumer acceptance. Neutral
 * fixture tokens keep it independent of the showcase's optional chrome. No
 * fixture rule supplies wrapping, min-width: 0, or overflow clipping.
 * Untagged: runs in the existing blocking smoke project.
 */
const require = createRequire(import.meta.url);
const contentCss = readFileSync(require.resolve("@takazudo/zudo-doc/content.css"), "utf8");
const WORD = "DocumentationConfigurationReferenceWithoutAnyDelimiters".repeat(3);
const PATH = "packages/documentation/configuration/reference/".repeat(6);
const CODE = `const value = "${WORD.repeat(4)}";`;

async function renderContent(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.setContent(`<!doctype html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      --color-fg: black;
      --color-muted: gray;
      --text-body: 16px;
      --text-small: 14px;
      --leading-relaxed: 1.75;
      --font-sans: sans-serif;
      --font-mono: monospace;
      --spacing-vsp-md: 16px;
      --spacing-vsp-sm: 8px;
      --spacing-hsp-lg: 16px;
    }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 16px; }
    .fixture-flex { display: flex; }
  </style>
</head>
<body>
  <p data-outside-content>Outside the content scope.</p>
  <main class="zd-content">
    <h2 data-reflow-text>${WORD}</h2>
    <p data-reflow-text>${PATH}</p>
    <p><a href="#reference" data-reflow-text>${WORD}</a></p>
    <nav class="fixture-flex" aria-label="Reference">
      <a href="#reference" data-reflow-text>${WORD}</a>
    </nav>
    <p lang="ja" data-reflow-text>設定資料 ${WORD} の説明です。</p>
    <pre><code>${CODE}</code></pre>
  </main>
</body>
</html>`);
  await page.addStyleTag({ content: contentCss });
  await expect(page.locator(".zd-content")).toHaveCSS("overflow-wrap", "anywhere");
}

async function documentSize(page: Page) {
  return page.evaluate(() => ({
    viewport: window.innerWidth,
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
}

for (const width of [195, 320, 390, 640, 1280]) {
  test(`ordinary content reflows at ${width}px without clipping or wrapping preformatted code (#4585)`, async ({ page }) => {
    await renderContent(page, width);

    const size = await documentSize(page);
    expect(size.viewport, "the requested CSS viewport must be effective").toBe(width);
    expect(size.scroll, "the document must not scroll horizontally").toBeLessThanOrEqual(size.client + 1);
    for (const selector of ["html", "body", ".zd-content"]) {
      await expect(page.locator(selector), "overflow must not be hidden or clipped").toHaveCSS("overflow-x", "visible");
    }
    await expect(page.locator("[data-outside-content]")).toHaveCSS("overflow-wrap", "normal");

    // An inline text run can protrude even when its parent's border box fits.
    // Measure the actual line fragments, not just element bounding boxes.
    const fragments = await page.locator("[data-reflow-text]").evaluateAll((elements) => {
      const main = document.querySelector(".zd-content");
      if (!main) throw new Error("Missing content root");
      const bounds = main.getBoundingClientRect();
      return elements.map((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const rects = [...range.getClientRects()];
        return {
          text: element.textContent,
          count: rects.length,
          overflow: Math.max(0, ...rects.map((rect) => Math.max(bounds.left - rect.left, rect.right - bounds.right))),
        };
      });
    });
    expect(fragments).toHaveLength(5);
    for (const fragment of fragments) {
      expect(fragment.count, "text must remain rendered").toBeGreaterThan(0);
      expect(fragment.overflow, fragment.text ?? "missing text").toBeLessThanOrEqual(1);
    }
    expect(fragments.map((fragment) => fragment.text)).toEqual([
      WORD, PATH, WORD, WORD, `設定資料 ${WORD} の説明です。`,
    ]);
    await expect(page.locator("main wbr")).toHaveCount(0);

    const pre = page.locator("main pre");
    await expect(pre).toHaveCSS("white-space", "pre");
    await expect(pre).toHaveCSS("overflow-x", "auto");
    await expect(pre.locator("code")).toHaveText(CODE);
    const codeScroll = await pre.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
      return {
        client: element.clientWidth,
        scroll: element.scrollWidth,
        left: element.scrollLeft,
      };
    });
    expect(codeScroll.scroll).toBeGreaterThan(codeScroll.client);
    expect(codeScroll.left, "the entire unwrapped code line stays reachable").toBeGreaterThan(0);
    expect((await documentSize(page)).scroll).toBeLessThanOrEqual(size.client + 1);
  });
}

test("content reflow fixture detects removal of the inherited wrapping default (#4585)", async ({ page }) => {
  await renderContent(page, 195);
  const content = page.locator(".zd-content");
  // Fault injection: reproduce the previous default, proving the fixture
  // would fail rather than accidentally passing through unrelated styles.
  await content.evaluate((element) => { element.style.overflowWrap = "normal"; });
  expect((await documentSize(page)).scroll).toBeGreaterThan(195);
  await content.evaluate((element) => { element.style.removeProperty("overflow-wrap"); });
  await expect(content).toHaveCSS("overflow-wrap", "anywhere");
  const restored = await documentSize(page);
  expect(restored.scroll).toBeLessThanOrEqual(restored.client + 1);
});

// #4594: inline code inside table cells must keep `break-word`, not inherit the
// inline-code `anywhere` that collapses min-content and squeezes columns.
async function renderTable(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 844 });
  const description = "A fairly long description sentence that makes the column want to be wide";
  await page.setContent(`<!doctype html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 16px; }
    .fixture-scroll { overflow-x: auto; }
    .fixture-table { width: 100%; border-collapse: collapse; }
  </style>
</head>
<body>
  <main class="zd-content">
    <div class="fixture-scroll">
      <table class="fixture-table">
        <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>slug</code></td><td><code>string</code></td><td>${description}</td></tr>
          <tr><td><code>variants</code></td><td><code>Record&lt;string, Variant&gt;</code></td><td>${description}</td></tr>
        </tbody>
      </table>
    </div>
  </main>
</body>
</html>`);
  await page.addStyleTag({ content: contentCss });
}

test("inline code in table cells keeps words intact (#4594)", async ({ page }) => {
  await renderTable(page, 390);
  await expect(page.locator("td code").first()).toHaveCSS("overflow-wrap", "break-word");

  const words = await page.locator("td code").evaluateAll((elements) =>
    elements.flatMap((element) => {
      const text = element.firstChild;
      if (!text || text.nodeType !== Node.TEXT_NODE) throw new Error("Missing code text");
      const content = text.textContent ?? "";
      const result: { word: string; lines: number }[] = [];
      for (const match of content.matchAll(/[A-Za-z]+/g)) {
        const range = document.createRange();
        range.setStart(text, match.index);
        range.setEnd(text, match.index + match[0].length);
        const tops = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
        result.push({ word: match[0], lines: tops.size });
      }
      return result;
    }),
  );
  expect(words.map((entry) => entry.word)).toEqual(["slug", "string", "variants", "Record", "string", "Variant"]);
  for (const entry of words) {
    expect(entry.lines, `${entry.word} must not break mid-word`).toBe(1);
  }

  const doc = await documentSize(page);
  expect(doc.scroll, "the document itself must not scroll horizontally").toBeLessThanOrEqual(doc.client + 1);
});
