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

// Mirrors ASSET_DETAILS_STORAGE_KEY / ASSET_DETAILS_HIDDEN_ATTR in
// packages/zudo-doc/src/asset-page/script.ts (#3941/#3942).
const ASSET_DETAILS_STORAGE_KEY = "zudo-doc-asset-details-visible";
const ASSET_DETAILS_HIDDEN_ATTR = "data-asset-details-hidden";

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

  // -------------------------------------------------------------------------
  // #3942: details-rail confirm coverage — code pages must match every other
  // kind's side-by-side, bordered rail (#3940), and the collapse toggle must
  // actually reclaim width / keep the code block scrollable (#3941).
  // -------------------------------------------------------------------------

  test("code asset pages route the details rail beside the code with a visible border, like every other kind", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto("/files/demo.js/", { waitUntil: "load" });

    const pre = page.locator("pre.zd-asset-code");
    const rail = page.locator("[data-zd-asset-details]");
    const card = rail.locator(":scope > div").first();
    const toggle = page.locator("[data-zd-asset-details-toggle]");

    await expect(pre).toBeVisible();
    await expect(rail).toBeVisible();
    await expect(toggle).toBeVisible();

    const codeBox = await pre.evaluate((el) => el.getBoundingClientRect());
    const railBox = await rail.evaluate((el) => el.getBoundingClientRect());
    // Beside, not below (the exact broken state in the issue's screenshots):
    // the rail's top sits above the code block's bottom edge, and its left
    // edge sits to the right of the code block's right edge.
    expect(railBox.top).toBeLessThan(codeBox.bottom);
    expect(railBox.left).toBeGreaterThan(codeBox.right);

    const borderWidth = await card.evaluate((el) =>
      Number.parseFloat(getComputedStyle(el).borderTopWidth),
    );
    expect(borderWidth).toBeGreaterThan(0);

    assertNoConsoleErrors();
  });

  test("every previewable asset kind keeps a bordered, side-by-side details rail — no stacked/borderless regression", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    for (const path of [
      "demo.js",
      "notes.txt",
      "diagram.png",
      "clip.mp4",
      "spec.pdf",
      "bundle.zip",
    ]) {
      await page.goto(`/files/${path}/`, { waitUntil: "load" });

      const grid = page.locator(".zd-asset-media-grid");
      const stage = grid.locator(":scope > .min-w-0");
      const rail = page.locator("[data-zd-asset-details]");
      const card = rail.locator(":scope > div").first();

      await expect(rail, `${path}: rail must render`).toBeVisible();
      const stageBox = await stage.evaluate((el) => el.getBoundingClientRect());
      const railBox = await rail.evaluate((el) => el.getBoundingClientRect());
      expect(
        railBox.top,
        `${path}: rail must not stack below the stage`,
      ).toBeLessThan(stageBox.bottom);
      expect(
        railBox.left,
        `${path}: rail must sit to the right of the stage`,
      ).toBeGreaterThan(stageBox.right);

      const borderWidth = await card.evaluate((el) =>
        Number.parseFloat(getComputedStyle(el).borderTopWidth),
      );
      expect(
        borderWidth,
        `${path}: details card must keep a visible border`,
      ).toBeGreaterThan(0);

      await expect(
        page.locator("[data-zd-asset-details-toggle]"),
        `${path}: collapse toggle must render`,
      ).toBeVisible();
    }
    assertNoConsoleErrors();
  });

  test("collapsing the details rail reclaims code-column width and zeroes the track + gap", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto("/files/demo.js/", { waitUntil: "load" });

    const grid = page.locator(".zd-asset-media-grid");
    const codeCol = grid.locator(":scope > .min-w-0");
    const rail = page.locator("[data-zd-asset-details]");
    const toggle = page.locator("[data-zd-asset-details-toggle]");

    await expect(toggle).toBeEnabled({ timeout: 5000 });
    const expandedCodeWidth = await codeCol.evaluate((el) => el.getBoundingClientRect().width);
    const expandedGap = await grid.evaluate((el) =>
      Number.parseFloat(getComputedStyle(el).columnGap),
    );
    expect(expandedGap).toBeGreaterThan(0);

    await toggle.click();
    await page.waitForFunction(
      (attr) => document.documentElement.hasAttribute(attr),
      ASSET_DETAILS_HIDDEN_ATTR,
      { timeout: 5000 },
    );
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), ASSET_DETAILS_STORAGE_KEY))
      .toBe("false");

    // Collapsing must RECLAIM width, so both the grid's gap and its own
    // (rail) track have to settle at zero — not just fade the rail's opacity.
    await expect
      .poll(() => grid.evaluate((el) => Number.parseFloat(getComputedStyle(el).columnGap)))
      .toBe(0);
    await expect
      .poll(() =>
        grid.evaluate((el) => {
          const tracks = getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/);
          return Number.parseFloat(tracks[tracks.length - 1] ?? "NaN");
        }),
      )
      .toBe(0);

    const collapsedCodeWidth = await codeCol.evaluate((el) => el.getBoundingClientRect().width);
    expect(collapsedCodeWidth).toBeGreaterThan(expandedCodeWidth);
    await expect(rail).toHaveCSS("visibility", "hidden");

    // Expand again so the two toggle states are both exercised in one test.
    await toggle.click();
    await page.waitForFunction(
      (attr) => !document.documentElement.hasAttribute(attr),
      ASSET_DETAILS_HIDDEN_ATTR,
      { timeout: 5000 },
    );
    await expect
      .poll(() => grid.evaluate((el) => Number.parseFloat(getComputedStyle(el).columnGap)))
      .toBeGreaterThan(0);

    assertNoConsoleErrors();
  });

  test("a collapsed rail still lets the code block scroll horizontally without the document gaining overflow", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto("/files/demo.js/", { waitUntil: "load" });

    const toggle = page.locator("[data-zd-asset-details-toggle]");
    await expect(toggle).toBeEnabled({ timeout: 5000 });
    await toggle.click();
    await page.waitForFunction(
      (attr) => document.documentElement.hasAttribute(attr),
      ASSET_DETAILS_HIDDEN_ATTR,
      { timeout: 5000 },
    );

    const pre = page.locator("pre.zd-asset-code");
    const metrics = await pre.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);

    await pre.evaluate((el) => {
      el.scrollLeft = 24;
    });
    const scrollLeftAfter = await pre.evaluate((el) => el.scrollLeft);
    expect(scrollLeftAfter).toBeGreaterThan(0);

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

    assertNoConsoleErrors();
  });

  test("the sticky filebar holds its viewport position across real vertical scrolling", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    // A short viewport forces overflow on this otherwise-short fixture page
    // so the filebar actually has room to scroll past its sticky offset.
    await page.setViewportSize({ width: 1280, height: 420 });
    await page.goto("/files/demo.js/", { waitUntil: "load" });

    const filebar = page.locator(".zd-asset-filebar");
    await expect(filebar).toBeVisible();
    const headerHeight = await page.locator("header[data-header]").evaluate(
      (el) => el.getBoundingClientRect().height,
    );

    // A static computed `top` read (as the existing responsive-geometry test
    // already does) would pass even if sticky positioning were broken, since
    // it never scrolls. Scroll for real, then read the ACTUAL viewport
    // position. 420px is well inside the fixture page's pinned range (probed
    // empirically: the filebar sits at its sticky offset for scrollY roughly
    // 400-580 on this short fixture page; much further and the short code
    // section's own bottom pushes the filebar back out of its pinned spot —
    // that end-of-container unstick is real sticky behaviour, not a bug, so
    // this test deliberately stays inside the safely-pinned band).
    await page.evaluate(() => window.scrollTo(0, 420));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    const pinnedTop = await filebar.evaluate((el) => el.getBoundingClientRect().top);
    expect(pinnedTop).toBeCloseTo(headerHeight, 0);

    // Scroll further still — a truly sticky element holds the SAME viewport
    // position; a broken one (`position: static`/`relative`) would keep
    // moving up and off-screen instead.
    await page.evaluate(() => window.scrollTo(0, 510));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(420);
    const stillPinnedTop = await filebar.evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.abs(stillPinnedTop - pinnedTop)).toBeLessThanOrEqual(1);

    assertNoConsoleErrors();
  });
});

test.describe("Asset viewer: details rail responsive contract (#3942)", () => {
  test.describe("Mobile stacking", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("the details rail stacks below the code block and the collapse toggle is not rendered", async ({
      page,
      assertNoConsoleErrors,
    }) => {
      await page.goto("/files/demo.js/", { waitUntil: "load" });

      const pre = page.locator("pre.zd-asset-code");
      const rail = page.locator("[data-zd-asset-details]");
      await expect(pre).toBeVisible();
      await expect(rail).toBeVisible();

      const codeBox = await pre.evaluate((el) => el.getBoundingClientRect());
      const railBox = await rail.evaluate((el) => el.getBoundingClientRect());
      expect(railBox.top).toBeGreaterThanOrEqual(codeBox.bottom - 1);

      // Forbidden: the toggle must not appear on a viewport where the rail
      // is not side-by-side.
      await expect(page.locator("[data-zd-asset-details-toggle]")).not.toBeVisible();

      assertNoConsoleErrors();
    });
  });
});
