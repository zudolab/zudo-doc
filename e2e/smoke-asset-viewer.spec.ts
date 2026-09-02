import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Download, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  attrSource,
  booleanAttrSource,
  classAttrSource,
} from "./html-assertions";
import { spaClick, spaClickSelector } from "./nav-helpers";
import { DIST_DIR, readDistFile } from "./smoke-dist-helper";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMO_SOURCE = readFileSync(
  join(__dirname, "fixtures/smoke/public/assets/demo.js"),
  "utf8",
);
const EVIL_SOURCE = readFileSync(
  join(__dirname, "fixtures/smoke/public/assets/evil.js"),
  "utf8",
);
const DEMO_SIZE_LABEL = `${Buffer.byteLength(DEMO_SOURCE)} B`;

const ASSET_FILES = [
  "demo.js",
  "diagram.png",
  "clip.mp4",
  "bundle.zip",
  "spec.pdf",
  "notes.txt",
  "evil.js",
  "nested/inner.txt",
] as const;

const TEST_DOC = "/docs/guides/asset-viewer-test";

function assetPage(path: string): string {
  return readDistFile(`files/${path}/index.html`);
}

function codeMarkup(html: string): string {
  return (
    html.match(
      /<pre\b(?=[^>]*\bzd-asset-code\b)[^>]*>([\s\S]*?)<\/pre>/i,
    )?.[1] ?? ""
  );
}

function stripMarkup(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/gi, "'");
}

function anchorWithHref(html: string, href: string): string {
  return (
    html.match(
      new RegExp(
        `<a\\b(?=[^>]*${attrSource("href", href)})[^>]*>[\\s\\S]*?<\\/a>`,
      ),
    )?.[0] ?? ""
  );
}

function excerptMarkup(html: string): string {
  const lineStart = html.search(new RegExp(attrSource("data-line", "2")));
  if (lineStart < 0) return "";
  const sectionStart = html.lastIndexOf("<section", lineStart);
  const sectionEnd = html.indexOf("</section>", lineStart);
  return sectionStart >= 0 && sectionEnd >= 0
    ? html.slice(sectionStart, sectionEnd + "</section>".length)
    : "";
}

function figureContainingImageAlt(html: string, alt: string): string {
  return (
    html.match(
      new RegExp(
        `<figure\\b[^>]*>(?:(?!<figure\\b)[\\s\\S])*?<img\\b(?=[^>]*${attrSource("alt", alt)})[^>]*>(?:(?!<figure\\b)[\\s\\S])*?</figure>`,
        "i",
      ),
    )?.[0] ?? ""
  );
}

function classTagIndex(
  html: string,
  from: number,
  tagName: string,
  className: string,
): number {
  const match = html.slice(from).match(
    new RegExp(
      `<${tagName}\\b(?=[^>]*${classAttrSource(className)})[^>]*>`,
      "i",
    ),
  );
  return match?.index === undefined ? -1 : from + match.index;
}

async function inspectDownloadFallback(page: Page) {
  return page.locator("[data-zd-asset-page]").evaluate((root) => {
    const grid = root.querySelector<HTMLElement>(".zd-asset-media-grid");
    const main = grid?.querySelector<HTMLElement>(":scope > .min-w-0") ?? null;
    const rail = grid?.querySelector<HTMLElement>(":scope > .zd-asset-media-rail") ?? null;
    const gridChildren = grid ? Array.from(grid.children) : [];
    const railChildren = rail ? Array.from(rail.children) : [];
    const detailsBox = rail?.firstElementChild ?? null;
    const linkedSection = rail
      ? railChildren.find(
          (child) => child instanceof HTMLElement && child.tagName === "SECTION",
        ) ?? null
      : null;
    const actions = Array.from(root.querySelectorAll<HTMLElement>("[data-zd-asset-actions]"));
    const bottomActions = actions.at(-1) ?? null;
    const sourceLink = Array.from(root.querySelectorAll<HTMLAnchorElement>("a")).find(
      (anchor) => anchor.textContent?.includes("View source on GitHub"),
    ) ?? null;
    const follows = (before: Element | null, after: Element | null): boolean =>
      before !== null &&
      after !== null &&
      Boolean(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING);
    const rect = (element: Element | null) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
      };
    };

    return {
      display: grid ? getComputedStyle(grid).display : null,
      grid: rect(grid),
      main: rect(main),
      rail: rect(rail),
      railWidth: rail ? rail.getBoundingClientRect().width : null,
      mainBeforeRail:
        main !== null && rail !== null && gridChildren.indexOf(main) < gridChildren.indexOf(rail),
      boxedDetails:
        detailsBox !== null &&
        detailsBox.classList.contains("rounded") &&
        detailsBox.classList.contains("border") &&
        detailsBox.classList.contains("border-muted") &&
        detailsBox.classList.contains("p-hsp-lg") &&
        detailsBox.querySelector("h2")?.textContent?.trim() === "Details",
      linkedFromInRail:
        linkedSection !== null &&
        linkedSection.textContent?.includes("Linked from") === true,
      linkedAfterDetails:
        linkedSection !== null &&
        detailsBox !== null &&
        railChildren.indexOf(detailsBox) < railChildren.indexOf(linkedSection),
      downloadPanelPresent: root.querySelector('[data-zd-asset-action="copy-url"]') !== null,
      noPreviewText: root.textContent?.includes("No preview") === true,
      iframeCount: root.querySelectorAll("iframe").length,
      codeViewerCount: root.querySelectorAll(".zd-asset-code, .zd-asset-filebar").length,
      bottomActionsAfterGrid: follows(grid, bottomActions),
      sourceAfterGrid: follows(grid, sourceLink),
      sourceAfterBottomActions: follows(bottomActions, sourceLink),
      actionCount: actions.length,
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
    };
  });
}

// ---------------------------------------------------------------------------
// Level 3: static HTML and publication assertions
// ---------------------------------------------------------------------------

test.describe("Asset viewer: static pages and authoring", () => {
  test("builds a viewer page for every fixture asset", () => {
    for (const path of ASSET_FILES) {
      const html = assetPage(path);
      expect(html, `viewer page missing for ${path}`).toContain("data-zd-asset-page");
      expect(html).toContain("data-zd-wide");
      expect(html).not.toMatch(/<aside\b/i);
      expect(html).not.toMatch(
        new RegExp(
          `data-zd-toc|${attrSource("aria-label", "Table of contents")}`,
          "i",
        ),
      );
    }
  });

  test("builds the asset index with every fixture asset in its tree", () => {
    const html = readDistFile("files/index.html");
    expect(html).toContain("data-zd-asset-index-page");
    for (const path of ASSET_FILES) {
      expect(
        anchorWithHref(html, `/files/${path}/`),
        `asset index link missing for ${path}`,
      ).toBeTruthy();
    }
    expect(html).toMatch(
      /<details\b[^>]*>[\s\S]*?<summary\b[^>]*>[\s\S]*?<span\b[^>]*>nested\/<\/span>[\s\S]*?<\/summary>[\s\S]*?<\/details>/i,
    );
  });

  test("renders full-file line ids without copying gutter numbers into code", () => {
    const html = assetPage("demo.js");
    const markup = codeMarkup(html);
    expect(html).not.toMatch(/>asset\.[^<]+</);
    for (const label of [
      "Assets",
      "Asset",
      "Download",
      "Open raw",
      "Copy",
      "Wrap",
    ]) {
      expect(html).toContain(`>${label}<`);
    }
    expect(markup).toMatch(new RegExp(attrSource("id", "L1")));
    expect(
      markup.match(/\bid\s*=\s*(?:"L\d+"|'L\d+'|L\d+)(?=[\s>/])/g),
    ).toHaveLength(6);
    expect(stripMarkup(markup)).toBe(DEMO_SOURCE);
    // The visible gutter is a CSS counter (`.line::before`), so its numbers
    // must never become text inside the copied/highlighted `<code>` element.
    expect(markup).not.toMatch(/>\s*[1-6]\s*</);
    expect(html).toContain("zd-asset-filebar");
  });

  test("decorates an authored asset link with viewer href, icon, and size", () => {
    const html = readDistFile("docs/guides/asset-viewer-test/index.html");
    const link = anchorWithHref(html, "/files/demo.js/");
    expect(link).toBeTruthy();
    expect(link).toContain("h-icon-sm");
    expect(link).toContain(DEMO_SIZE_LABEL);
  });

  test("adds download/raw attributes to the viewer and Asset card", () => {
    const viewer = assetPage("demo.js");
    expect(viewer).toMatch(
      new RegExp(
        `<a\\b(?=[^>]*${attrSource("href", "/assets/demo.js")})(?=[^>]*${booleanAttrSource("download")})[^>]*>`,
      ),
    );
    expect(viewer).toMatch(
      new RegExp(
        `<a\\b(?=[^>]*${attrSource("href", "/assets/demo.js")})(?=[^>]*${booleanAttrSource("data-zfb-reload")})[^>]*>`,
      ),
    );

    const doc = readDistFile("docs/guides/asset-viewer-test/index.html");
    expect(doc).toMatch(
      new RegExp(
        `<a\\b(?=[^>]*${attrSource("href", "/assets/bundle.zip")})(?=[^>]*${booleanAttrSource("download")})[^>]*>`,
      ),
    );
  });

  test("renders AssetCode's requested excerpt with data-line but no ids", () => {
    const html = readDistFile("docs/guides/asset-viewer-test/index.html");
    const excerpt = excerptMarkup(html);
    expect(excerpt).toBeTruthy();
    for (const line of [2, 3, 4, 5]) {
      expect(excerpt).toMatch(new RegExp(attrSource("data-line", String(line))));
    }
    expect(excerpt).not.toMatch(/\bid\s*=/i);
  });

  test("renders a manifest image caption with its viewer link", () => {
    const html = readDistFile("docs/guides/asset-viewer-test/index.html");
    const caption = html.match(/<figcaption\b[\s\S]*?<\/figcaption>/i)?.[0] ?? "";
    expect(caption).toContain("Diagram");
    expect(anchorWithHref(caption, "/files/diagram.png/")).toContain(
      "Open asset page",
    );
    expect(html).toContain("3200 × 1800");
  });

  test("insets manifest figures without padding ordinary fixture images", () => {
    const manifestHtml = readDistFile("docs/guides/asset-viewer-test/index.html");
    const manifestFigure = figureContainingImageAlt(manifestHtml, "Diagram");
    expect(manifestFigure).toBeTruthy();
    expect(manifestFigure).toMatch(new RegExp(classAttrSource("p-hsp-lg")));

    const ordinaryHtml = readDistFile("docs/guides/image-enlarge-test/index.html");
    const ordinaryFigure = figureContainingImageAlt(ordinaryHtml, "oversized image");
    expect(ordinaryFigure).toBeTruthy();
    expect(ordinaryFigure).toMatch(new RegExp(classAttrSource("zd-enlargeable")));
    expect(ordinaryFigure).not.toMatch(new RegExp(classAttrSource("p-hsp-lg")));
  });

  test("keeps the ZIP fallback media grid safe and ordered", () => {
    const html = assetPage("bundle.zip");
    const gridStart = classTagIndex(html, 0, "div", "zd-asset-media-grid");
    const mainStart = classTagIndex(html, gridStart, "div", "min-w-0");
    const railStart = classTagIndex(html, gridStart, "div", "zd-asset-media-rail");
    const boxedDetailsStart = html.slice(railStart).search(
      new RegExp(
        `<div\\b(?=[^>]*${classAttrSource("rounded")})(?=[^>]*${classAttrSource("border")})(?=[^>]*${classAttrSource("border-muted")})(?=[^>]*${classAttrSource("p-hsp-lg")})[^>]*>`,
        "i",
      ),
    );
    const boxedDetailsAbsolute =
      boxedDetailsStart < 0 ? -1 : railStart + boxedDetailsStart;
    const detailsHeadingStart = html.indexOf(">Details</h2>", railStart);
    const linkedHeadingStart = html.indexOf(">Linked from</h2>", railStart);
    const firstActionsStart = html.indexOf("data-zd-asset-actions");
    const bottomActionsStart = html.indexOf(
      "data-zd-asset-actions",
      firstActionsStart + 1,
    );
    const sourceStart = html.indexOf("View source on GitHub");
    const mediaGrid = html.slice(gridStart, bottomActionsStart);

    expect(gridStart).toBeGreaterThan(-1);
    expect(mainStart).toBeGreaterThan(gridStart);
    expect(railStart).toBeGreaterThan(mainStart);
    expect(html.slice(gridStart, railStart)).toMatch(
      new RegExp(
        `^<div\\b(?=[^>]*${classAttrSource("zd-asset-media-grid")})[^>]*>\\s*<div\\b(?=[^>]*${classAttrSource("min-w-0")})[^>]*>[\\s\\S]*$`,
        "i",
      ),
    );
    expect(boxedDetailsStart).toBeGreaterThan(-1);
    expect(detailsHeadingStart).toBeGreaterThan(boxedDetailsAbsolute);
    expect(linkedHeadingStart).toBeGreaterThan(detailsHeadingStart);
    expect(firstActionsStart).toBeGreaterThan(-1);
    expect(firstActionsStart).toBeLessThan(gridStart);
    expect(bottomActionsStart).toBeGreaterThan(railStart);
    expect(linkedHeadingStart).toBeLessThan(bottomActionsStart);
    expect(sourceStart).toBeGreaterThan(bottomActionsStart);
    expect(mediaGrid).toContain("No preview");
    expect(mediaGrid).not.toContain("<iframe");
    expect(mediaGrid).not.toContain("zd-asset-code");
    expect(mediaGrid).not.toContain("zd-asset-filebar");
  });

  test("asset image pages carry their own ImageEnlarge island marker", () => {
    const html = assetPage("diagram.png");
    expect(
      html.match(
        new RegExp(attrSource("data-zfb-island-skip-ssr", "ImageEnlarge"), "g"),
      ),
    ).toHaveLength(1);
  });

  test("keeps generated asset viewer routes out of search, llms, and sitemap indexes", () => {
    for (const path of ["search-index.json", "llms.txt", "llms-full.txt"]) {
      expect(readDistFile(path), `${path} must exclude viewer URLs`).not.toContain("/files/");
    }
    const sitemapPath = join(DIST_DIR, "sitemap.xml");
    if (existsSync(sitemapPath)) {
      expect(readDistFile("sitemap.xml"), "sitemap.xml must exclude viewer URLs").not.toContain("/files/");
    }
  });

  test("escapes hostile source as inert code", () => {
    const html = assetPage("evil.js");
    expect(stripMarkup(codeMarkup(html))).toBe(EVIL_SOURCE);
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});

// ---------------------------------------------------------------------------
// Level 4: browser behavior
// ---------------------------------------------------------------------------

test.describe("Asset viewer: browser interactions", () => {
  test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });

  test("asset index controls arm and toggle every folder", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto("/files/", { waitUntil: "domcontentloaded" });

    const expand = page.locator('[data-zd-asset-index-action="expand"]');
    const collapse = page.locator('[data-zd-asset-index-action="collapse"]');
    await expect(expand).toBeEnabled();
    await expect(collapse).toBeEnabled();

    const folders = page.locator("[data-zd-asset-tree] details");
    await expect(folders).not.toHaveCount(0);
    const allFoldersOpen = () =>
      folders.evaluateAll((details) =>
        details.every((detail) => (detail as HTMLDetailsElement).open),
      );
    const allFoldersClosed = () =>
      folders.evaluateAll((details) =>
        details.every((detail) => !(detail as HTMLDetailsElement).open),
      );

    await collapse.click();
    await expect.poll(allFoldersClosed).toBe(true);
    await expand.click();
    await expect.poll(allFoldersOpen).toBe(true);
    assertNoConsoleErrors();
  });

  test("SPA round trip from the asset index through a viewer and back via Assets", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto("/files/", { waitUntil: "domcontentloaded" });
    expect(await spaClick(page, "/files/demo.js/")).toBe(true);
    await expect(page).toHaveURL(/\/files\/demo\.js\/$/);
    await expect(page.locator("[data-zd-asset-page]")).toBeVisible();

    const assetsCrumb = page.getByRole("link", { name: "Assets", exact: true });
    await expect(assetsCrumb).toBeVisible();
    expect(
      await spaClickSelector(
        page,
        'nav[aria-label="Breadcrumb"] a[href="/files/"]',
      ),
    ).toBe(true);
    await expect(page).toHaveURL(/\/files\/$/);
    await expect(page.locator("[data-zd-asset-index-page]")).toBeVisible();
    assertNoConsoleErrors();
  });

  test("asset images force ImageEnlarge at DPR 2 and Escape closes the dialog", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto("/files/diagram.png/", { waitUntil: "domcontentloaded" });

    const image = page.locator("figure.zd-asset-stage img");
    await image.waitFor({ state: "visible" });
    const button = page.locator("figure.zd-asset-stage .zd-enlarge-btn");
    await expect(button).toBeVisible({ timeout: 5000 });

    await image.click();
    const dialog = page.locator("dialog.zd-enlarge-dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 5000 });
    assertNoConsoleErrors();
  });

  test("asset presentation keeps manifest inset, fallback rail order, and responsive geometry", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    for (const width of [1280, 800]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(TEST_DOC, { waitUntil: "domcontentloaded" });

      const manifestFigure = page.locator("figure").filter({
        has: page.locator('img[alt="Diagram"]'),
      });
      await expect(manifestFigure).toHaveCount(1);
      const manifestPadding = await manifestFigure.evaluate((figure) => {
        const style = getComputedStyle(figure);
        return {
          classes: figure.className,
          values: [
            style.paddingTop,
            style.paddingRight,
            style.paddingBottom,
            style.paddingLeft,
          ].map((value) => Number.parseFloat(value)),
        };
      });
      expect(manifestPadding.classes.split(/\s+/)).toContain("p-hsp-lg");
      for (const value of manifestPadding.values) {
        expect(value).toBeCloseTo(16, 1);
      }

      await page.goto("/docs/guides/image-enlarge-test", {
        waitUntil: "domcontentloaded",
      });
      const ordinaryFigure = page.locator("figure").filter({
        has: page.locator('img[alt="oversized image"]'),
      });
      await expect(ordinaryFigure).toHaveCount(1);
      const ordinaryPadding = await ordinaryFigure.evaluate((figure) => {
        const style = getComputedStyle(figure);
        return {
          classes: figure.className,
          values: [
            style.paddingTop,
            style.paddingRight,
            style.paddingBottom,
            style.paddingLeft,
          ].map((value) => Number.parseFloat(value)),
        };
      });
      expect(ordinaryPadding.classes.split(/\s+/)).not.toContain("p-hsp-lg");
      for (const value of ordinaryPadding.values) {
        expect(value).toBeCloseTo(0, 1);
      }

      await page.goto("/files/bundle.zip/", { waitUntil: "domcontentloaded" });
      const layout = await inspectDownloadFallback(page);
      expect(layout.display).toBe("grid");
      expect(layout.mainBeforeRail).toBe(true);
      expect(layout.grid).not.toBeNull();
      expect(layout.main).not.toBeNull();
      expect(layout.rail).not.toBeNull();
      if (!layout.grid || !layout.main || !layout.rail) {
        throw new Error("ZIP fallback media grid did not render its main and rail");
      }
      expect(layout.rail.right).toBeLessThanOrEqual(layout.grid.right + 1);
      expect(layout.documentScrollWidth).toBeLessThanOrEqual(
        layout.documentClientWidth + 1,
      );
      expect(layout.bodyScrollWidth).toBeLessThanOrEqual(
        layout.documentClientWidth + 1,
      );

      if (width >= 1024) {
        expect(layout.boxedDetails).toBe(true);
        expect(layout.linkedFromInRail).toBe(true);
        expect(layout.linkedAfterDetails).toBe(true);
        expect(layout.downloadPanelPresent).toBe(true);
        expect(layout.noPreviewText).toBe(true);
        expect(layout.iframeCount).toBe(0);
        expect(layout.codeViewerCount).toBe(0);
        expect(layout.actionCount).toBe(2);
        expect(layout.bottomActionsAfterGrid).toBe(true);
        expect(layout.sourceAfterGrid).toBe(true);
        expect(layout.sourceAfterBottomActions).toBe(true);
        expect(layout.railWidth).not.toBeNull();
        expect(layout.railWidth!).toBeGreaterThan(300);
        expect(layout.railWidth!).toBeLessThan(340);
        expect(layout.rail.left).toBeGreaterThan(layout.main.right);
        expect(Math.abs(layout.main.top - layout.rail.top)).toBeLessThanOrEqual(1);
      } else {
        expect(layout.rail.top).toBeGreaterThanOrEqual(layout.main.bottom - 1);
        expect(Math.abs(layout.main.left - layout.rail.left)).toBeLessThanOrEqual(1);
      }
    }
    assertNoConsoleErrors();
  });

  test("SPA doc-to-asset and asset-to-asset navigation rearm Copy and Wrap", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto(TEST_DOC, { waitUntil: "domcontentloaded" });
    expect(await spaClick(page, "/files/demo.js/")).toBe(true);
    await expect(page).toHaveURL(/\/files\/demo\.js\/$/);

    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    const pre = page.locator("pre.zd-asset-code");
    await expect(pre).toBeVisible();
    const firstLineTokenRows = await page.locator("#L1 > span").evaluateAll(
      (tokens) =>
        new Set(
          tokens.map((token) => Math.round(token.getBoundingClientRect().top)),
        ).size,
    );
    expect(firstLineTokenRows).toBe(1);
    const linePositions = await page.locator(".zd-asset-code .line").evaluateAll(
      (lines) => lines.map((line) => {
        const rect = line.getBoundingClientRect();
        return { left: Math.round(rect.left), top: Math.round(rect.top) };
      }),
    );
    expect(new Set(linePositions.map(({ left }) => left)).size).toBe(1);
    for (let index = 1; index < linePositions.length; index += 1) {
      expect(linePositions[index]?.top).toBeGreaterThan(
        linePositions[index - 1]?.top ?? 0,
      );
    }
    await page.locator("#L3").click({ position: { x: 1, y: 2 } });
    await expect(page).toHaveURL(/#L3$/);
    const stickyTop = await page.locator(".zd-asset-filebar").evaluate(
      (element) => Number.parseFloat(getComputedStyle(element).top),
    );
    const headerHeight = await page.locator("header[data-header]").evaluate(
      (element) => element.getBoundingClientRect().height,
    );
    expect(stickyTop).toBeCloseTo(headerHeight, 0);
    const actions = page.locator("[data-zd-asset-actions]").first();
    const copy = actions.locator('[data-zd-asset-action="copy"]');
    const wrap = actions.locator('[data-zd-asset-action="wrap"]');
    await expect(copy).toBeEnabled({ timeout: 5000 });
    await expect(wrap).toBeEnabled({ timeout: 5000 });

    await copy.click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(DEMO_SOURCE);
    expect(await page.evaluate(() => navigator.clipboard.readText())).not.toMatch(
      /^\s*\d+\s*$/m,
    );

    await expect(pre).not.toHaveClass(/\bword-wrap\b/);
    await wrap.click();
    await expect(pre).toHaveClass(/\bword-wrap\b/);

    // The fixture doc intentionally has one entry point per feature surface;
    // add a temporary second viewer anchor here to exercise the real
    // asset→asset SPA swap and its rearming path without changing that corpus.
    await page.evaluate(() => {
      const anchor = document.createElement("a");
      anchor.href = "/files/evil.js/";
      anchor.textContent = "next asset";
      anchor.id = "asset-viewer-navigation-probe";
      document.body.append(anchor);
    });
    expect(await spaClick(page, "/files/evil.js/")).toBe(true);
    await expect(page).toHaveURL(/\/files\/evil\.js\/$/);

    const nextPre = page.locator("pre.zd-asset-code");
    await expect(nextPre).toBeVisible();
    const nextActions = page.locator("[data-zd-asset-actions]").first();
    await expect(
      nextActions.locator('[data-zd-asset-action="copy"]'),
    ).toBeEnabled({ timeout: 5000 });
    await expect(
      nextActions.locator('[data-zd-asset-action="wrap"]'),
    ).toBeEnabled({ timeout: 5000 });
    await expect(nextPre).toHaveClass(/\bword-wrap\b/);
    assertNoConsoleErrors();
  });

  test("raw Download bypasses the router and fetches the asset once", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto("/files/demo.js/", { waitUntil: "domcontentloaded" });

    const expectedAbsoluteUrl = new URL("/assets/demo.js", page.url()).href;
    const downloadUrls: string[] = [];
    const onDownload = (download: Download) => {
      const url = download.url();
      if (new URL(url).pathname === "/assets/demo.js") {
        downloadUrls.push(url);
      }
    };
    page.on("download", onDownload);
    try {
      // Chromium's browser-managed download is delivered through Playwright's
      // download event stream, not the page/context request streams or a fresh
      // browser-level CDP session. This event carries the actual transfer URL.
      await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__assetViewerBeforePreparationCount = 0;
        document.addEventListener("zfb:before-preparation", () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__assetViewerBeforePreparationCount += 1;
        });
      });

      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("link", { name: "Download" }).first().click();
      const download = await downloadPromise;

      expect(downloadUrls).toEqual([expectedAbsoluteUrl]);
      const beforePreparationCount = await page.evaluate(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => (window as any).__assetViewerBeforePreparationCount,
      );
      expect(beforePreparationCount).toBe(0);
      expect(download.suggestedFilename()).toBe("demo.js");
      assertNoConsoleErrors();
    } finally {
      page.off("download", onDownload);
    }
  });

  test("hostile source stays inert in the browser", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    let dialogCount = 0;
    page.on("dialog", async (dialog) => {
      dialogCount += 1;
      await dialog.dismiss();
    });

    await page.goto("/files/evil.js/", { waitUntil: "domcontentloaded" });
    const code = page.locator("pre.zd-asset-code");
    await expect(code).toContainText(EVIL_SOURCE.trim());
    await expect(code.locator("script")).toHaveCount(0);
    expect(dialogCount).toBe(0);
    assertNoConsoleErrors();
  });
});
