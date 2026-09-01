import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { expectHtmlAttr } from "./html-assertions";
import { spaClick } from "./nav-helpers";
import { DIST_DIR, readDistFile } from "./smoke-dist-helper";

/**
 * Tests for the HtmlPreview component.
 *
 * SSG-shape checks are static dist reads (no browser): global CSS from
 * settings.htmlPreview must land in the iframe srcdoc, and the sandbox
 * attributes must follow the resolveSandbox contract. The per-component JS
 * check needs a real browser (script execution inside the iframe).
 */

const PAGE = "/docs/guides/html-preview-test";
const DIST_PAGE = "docs/guides/html-preview-test/index.html";
const RESOURCE_PREFIX = "islands-resource-zfb_md_wasm_highlight_";
const RESOURCE_GLUE_PREFIX =
  "islands-resource-zfb_md_wasm_highlight_glue.zfb-resource-";
const RESOURCE_WASM_PREFIX = "islands-resource-zfb_md_wasm_highlight_bg-";
const VISIBLE_STYLE_PATH = "/html-preview-3852-style.css";
const VISIBLE_SCRIPT_PATH = "/html-preview-3852-script.js";
const HTML_PREVIEW_ISLAND = '[data-zfb-island="HtmlPreviewWrapperInner"]';
const HTML_PREVIEW_SKIP_SSR =
  '[data-zfb-island-skip-ssr="HtmlPreviewWrapperInner"]';

function htmlSection(html: string, heading: string): string {
  // Headings are serialized into the MobileToc data-props before the article
  // as well as rendered in the document. Anchor at the article's actual h2
  // so a matching title in JSON cannot make the shape assertions inspect the
  // wrong region.
  const articleStart = html.search(/<article\b/i);
  if (articleStart < 0) return "";
  const headingText = html.indexOf(heading, articleStart);
  if (headingText < 0) return "";
  const start = html.lastIndexOf("<h2", headingText);
  if (start < articleStart) return "";
  const nextHeading = html.indexOf("<h2", headingText + heading.length);
  return html.slice(start, nextHeading < 0 ? html.length : nextHeading);
}

function previewAfterHeading(
  page: Page,
  heading: string,
  mode: "eager" | "visible" = "eager",
): Locator {
  const markerAttribute =
    mode === "visible"
      ? '@data-zfb-island-skip-ssr="HtmlPreviewWrapperInner"'
      : '@data-zfb-island="HtmlPreviewWrapperInner"';
  return page
    .locator("article h2")
    .filter({ hasText: new RegExp(`^${heading}$`) })
    .locator(`xpath=following-sibling::*[${markerAttribute}][1]`);
}

async function iframeHeight(preview: Locator): Promise<number> {
  return preview.locator("iframe").evaluate((iframe) =>
    Number.parseFloat(iframe.style.height),
  );
}

async function waitForPreviewHydration(preview: Locator): Promise<void> {
  const codeToggle = preview.locator("button[aria-expanded]");
  await expect
    .poll(
      async () => {
        await codeToggle.click();
        return codeToggle.getAttribute("aria-expanded");
      },
      { timeout: 10_000 },
    )
      .toBe("true");
}

type VisiblePreVisibility = {
  iframeCount: number;
  inlineTargetCount: number;
  markerCount: number;
  markerIndex: number;
  markerTop: number | null;
  mountedSignal: boolean;
  nestedIslandCount: number;
  pageScrollY: number;
  reservationCount: number;
  viewportHeight: number;
};

async function inspectVisibleMarker(page: Page): Promise<VisiblePreVisibility> {
  return page.evaluate(
    ({ markerSelector, title, inlineId }) => {
      const markers = Array.from(document.querySelectorAll(markerSelector));
      const markerIndex = markers.findIndex((element) =>
        element.getAttribute("data-props")?.includes(title),
      );
      const marker = markerIndex >= 0 ? markers[markerIndex] : null;
      return {
        markerCount: markers.length,
        markerIndex,
        markerTop: marker?.getBoundingClientRect().top ?? null,
        viewportHeight: window.innerHeight,
        pageScrollY: window.scrollY,
        mountedSignal: marker?.hasAttribute("data-zfb-island-mounted") ?? false,
        iframeCount: marker?.querySelectorAll("iframe").length ?? 0,
        reservationCount:
          marker?.querySelectorAll("[data-zd-html-preview-reservation]").length ??
          0,
        inlineTargetCount: marker?.querySelectorAll(`#${inlineId}`).length ?? 0,
        nestedIslandCount:
          marker?.querySelectorAll(
            "[data-zfb-island], [data-zfb-island-skip-ssr]",
          ).length ?? 0,
      };
    },
    {
      markerSelector: HTML_PREVIEW_SKIP_SSR,
      title: "Visible Lifecycle Test",
      inlineId: "visible-inline-target-3852",
    },
  );
}

type ResourceKind = "glue" | "wasm";

function resourceKind(rawUrl: string): ResourceKind | null {
  const pathname = new URL(rawUrl).pathname;
  if (pathname.includes(RESOURCE_GLUE_PREFIX) && pathname.endsWith(".mjs")) {
    return "glue";
  }
  if (pathname.includes(RESOURCE_WASM_PREFIX) && pathname.endsWith(".wasm")) {
    return "wasm";
  }
  return null;
}

test.describe("HtmlPreview: SSG shape", () => {
  let html: string;

  test.beforeAll(() => {
    html = readDistFile(DIST_PAGE);
  });

  test("global CSS from settings.htmlPreview is injected into iframe srcdoc", () => {
    // The smoke fixture sets settings.htmlPreview.css to exactly this rule.
    // It must appear inside the preview iframe srcdoc <style> (wiring:
    // settings.htmlPreview -> globalConfig -> buildSrcdoc; regression #2105).
    expect(html).toContain(".global-test { border: 3px solid rgb(255, 0, 0); }");
  });

  test("iframes carry the resolveSandbox contract sandbox attributes", () => {
    // No-script preview: allow-same-origin (kept for auto-height measurement).
    expectHtmlAttr(html, "sandbox", "allow-same-origin");
    // Script-bearing preview: allow-scripts allow-same-origin.
    expectHtmlAttr(html, "sandbox", "allow-scripts allow-same-origin");
  });

  test("production build emits one referenced md-wasm glue and WASM pair", () => {
    const assetsDir = join(DIST_DIR, "assets");
    const assets = readdirSync(assetsDir);
    const glue = assets.filter(
      (name) => name.startsWith(RESOURCE_GLUE_PREFIX) && name.endsWith(".mjs"),
    );
    const wasm = assets.filter(
      (name) => name.startsWith(RESOURCE_WASM_PREFIX) && name.endsWith(".wasm"),
    );
    const allMdWasmResources = assets.filter((name) =>
      name.startsWith(RESOURCE_PREFIX),
    );

    expect(glue).toHaveLength(1);
    expect(wasm).toHaveLength(1);
    expect([...allMdWasmResources].sort()).toEqual(
      [...glue, ...wasm].sort(),
    );

    const emittedJavaScript = assets
      .filter((name) => name.endsWith(".js"))
      .map((name) => readFileSync(join(assetsDir, name), "utf8"))
      .join("\n");
    for (const resource of [...glue, ...wasm]) {
      expect(emittedJavaScript).toContain(`./${resource}`);
    }
  });

  test("keeps eager iframe SSR while visible mode emits only an isolated reservation", () => {
    const eager = htmlSection(html, "Eager Lifecycle Test");
    expect(eager).not.toBe("");
    expectHtmlAttr(eager, "data-zfb-island", "HtmlPreviewWrapperInner");
    expect(eager).toContain("<iframe");
    expect(eager).toContain("srcdoc=");

    const visible = htmlSection(html, "Visible Lifecycle Test");
    expect(visible).not.toBe("");
    expectHtmlAttr(
      visible,
      "data-zfb-island-skip-ssr",
      "HtmlPreviewWrapperInner",
    );
    expectHtmlAttr(visible, "data-when", "visible");
    expect(visible).not.toContain('data-zfb-island="HtmlPreviewWrapperInner"');
    expect(visible).not.toContain("<iframe");
    expect(visible).not.toContain("srcdoc=");
    expect(visible).not.toContain("<button");
    expect(visible).not.toContain(
      `<link rel="stylesheet" href="${VISIBLE_STYLE_PATH}">`,
    );
    expect(visible).not.toContain(
      `<script src="${VISIBLE_SCRIPT_PATH}"></script>`,
    );
  });

  test("keeps the fixed-height safeguards in the emitted previews", () => {
    const fullHeight = htmlSection(html, "FullHeight Fixed Lifecycle Test");
    expect(fullHeight).toContain("html,body{height:100%}");

    const opaque = htmlSection(html, "Opaque Fixed Height Lifecycle Test");
    expect(opaque).toMatch(
      /\bsandbox(?:\s*=\s*(?:"\s*"|'\s*'))?(?=[\s>/])/,
    );
    expect(opaque).toMatch(/height:\s*300px/);
  });
});

test.describe("HtmlPreview: zfb md-wasm resources and semantic output", () => {
  test("stays lazy until Show code, then loads one valid resource pair for HTML/CSS/JS", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    // The smoke fixture enables colorMode for browser-embed coverage. Pin the
    // system preference so the semantic-color checks exercise Default Dark.
    await page.emulateMedia({ colorScheme: "dark" });

    const resourceRequests: Array<{ kind: ResourceKind; url: string }> = [];
    const resourceResponses: Array<{
      kind: ResourceKind;
      url: string;
      status: number;
      contentType: string;
    }> = [];

    page.on("request", (request) => {
      const kind = resourceKind(request.url());
      if (kind) resourceRequests.push({ kind, url: request.url() });
    });
    page.on("response", (response) => {
      const kind = resourceKind(response.url());
      if (!kind) return;
      resourceResponses.push({
        kind,
        url: response.url(),
        status: response.status(),
        contentType: response.headers()["content-type"] ?? "",
      });
    });

    await page.goto(PAGE, { waitUntil: "domcontentloaded" });

    const island = page
      .locator('[data-zfb-island="HtmlPreviewWrapperInner"]')
      .filter({ hasText: "JS Test" });
    await expect(island).toHaveCount(1);
    await island.scrollIntoViewIfNeeded();

    // Prove the island has hydrated while its source panel is still closed.
    // The viewport button is inert in SSR markup, so aria-pressed can only flip
    // after Preact owns the click. Hydration alone must not fetch md-wasm.
    const mobileViewport = island.getByRole("button", { name: "Mobile" });
    await expect
      .poll(
        async () => {
          await mobileViewport.click();
          return mobileViewport.getAttribute("aria-pressed");
        },
        { timeout: 10_000 },
      )
      .toBe("true");
    expect(
      resourceRequests,
      "glue/WASM must stay unloaded while the hydrated source panel is closed",
    ).toEqual([]);

    await island.getByRole("button", { name: "Show code" }).click();

    const highlighted = island.locator(".zd-html-preview-code");
    await expect(highlighted).toHaveCount(3, { timeout: 10_000 });
    await expect(highlighted.locator("pre.hi-root")).toHaveCount(3);

    const expected = [
      {
        index: 0,
        role: "hi-tag",
        source: '<div id="js-target" data-message="a & b">before</div>',
      },
      {
        index: 1,
        role: "hi-prop",
        source: "#js-target { color: rgb(1, 2, 3); }",
      },
      {
        index: 2,
        role: "hi-kw",
        source: "const target = document.getElementById('js-target');",
      },
    ] as const;
    for (const { index, role, source } of expected) {
      const output = highlighted.nth(index);
      await expect(output.locator(`.${role}`).first()).toBeVisible();
      await expect(output).toContainText(source);
      const markup = await output.innerHTML();
      expect(markup).not.toMatch(/style=|--shiki-|shiki-/i);
    }

    // The trusted upstream markup must still display author source as text;
    // it must not inject that source as live HTML inside the code panel.
    await expect(highlighted.nth(0).locator("#js-target")).toHaveCount(0);

    const defaultDarkColors = await highlighted
      .nth(2)
      .locator("span.hi-kw")
      .first()
      .evaluate((token) => {
        const resolveColor = (cssVar: string) => {
          const probe = document.createElement("span");
          probe.style.color = `var(${cssVar})`;
          document.body.append(probe);
          const color = getComputedStyle(probe).color;
          probe.remove();
          return color;
        };

        return {
          theme: document.documentElement.dataset.theme,
          token: getComputedStyle(token).color,
          semantic: resolveColor("--zd-syntax-keyword"),
          defaultDarkAccent: resolveColor("--palette-accent-1"),
        };
      });
    expect(defaultDarkColors.theme).toBe("dark");
    expect(defaultDarkColors.token).toBe(defaultDarkColors.semantic);
    expect(defaultDarkColors.token).toBe(
      defaultDarkColors.defaultDarkAccent,
    );

    const glueRequests = resourceRequests.filter(({ kind }) => kind === "glue");
    const wasmRequests = resourceRequests.filter(({ kind }) => kind === "wasm");
    const glueResponses = resourceResponses.filter(({ kind }) => kind === "glue");
    const wasmResponses = resourceResponses.filter(({ kind }) => kind === "wasm");
    expect(glueRequests).toHaveLength(1);
    expect(wasmRequests).toHaveLength(1);
    expect(glueResponses).toHaveLength(1);
    expect(wasmResponses).toHaveLength(1);
    expect(glueResponses[0]?.status).toBe(200);
    expect(wasmResponses[0]?.status).toBe(200);
    expect(glueResponses[0]?.contentType).toMatch(
      /^(?:application|text)\/javascript(?:;|$)/,
    );
    expect(wasmResponses[0]?.contentType).toMatch(/^application\/wasm(?:;|$)/);
    expect(
      new URL(glueResponses[0]?.url ?? "http://invalid").searchParams.get(
        "zfbMdWasmGen",
      ),
    ).toBe("0");

    assertNoConsoleErrors();
  });
});

test.describe("HtmlPreview: per-component JS", () => {
  test("per-component JS executes inside iframe", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const iframes = page.locator("iframe");
    // The JS test is the second HtmlPreview on the page
    const jsIframe = iframes.nth(1);
    await jsIframe.waitFor({ state: "attached", timeout: 10_000 });

    const frame = page.frameLocator("iframe").nth(1);
    const target = frame.locator("#js-target");
    await expect(target).toHaveText("after", { timeout: 10_000 });
  });
});

test.describe("HtmlPreview: post-hydration structure", () => {
  /**
   * Deterministic regression coverage for the hydration double-wrap bug
   * class (commits 4a0788af, 96d54603; zudolab/zudo-doc#1925): the
   * `HtmlPreview` island's bare hydration target must own its OWN
   * `data-zfb-island="HtmlPreviewWrapperInner"` marker and must NOT
   * re-wrap itself in another `<Island>` on the client — otherwise Preact
   * reuses the SSR'd children one level off and re-parents the preview +
   * code sections inside the flex title bar (title bar/buttons squished
   * left, iframe floating right). The raw SSR DOM is always correct even
   * when this regresses (see
   * .claude/skills/test-flow-html-preview-hydration/SKILL.md), so this test
   * must observe genuine post-hydration state, not just the initial markup.
   *
   * Each island's "Show code" toggle button (`aria-expanded`) has no click
   * handler until the island actually hydrates — the SSR markup renders it
   * inert. Polling a click against it until `aria-expanded` flips is a
   * deterministic, event-based proxy for "this island has hydrated" (no
   * bare sleep): before hydration the click is a no-op, so the poll simply
   * retries until the `when="visible"` IntersectionObserver (triggered by
   * scrolling the island into view) fires and Preact attaches its handler.
   */
  test("every island renders a vertical stack (title bar, then preview, then code) after hydration", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const islands = page.locator(
      '[data-zfb-island="HtmlPreviewWrapperInner"]',
    );
    const islandCount = await islands.count();
    // Count dynamically — do not hardcode the fixture's current island
    // count, so this test keeps working as the fixture page grows.
    expect(islandCount).toBeGreaterThan(0);

    for (let i = 0; i < islandCount; i++) {
      const island = islands.nth(i);
      await island.scrollIntoViewIfNeeded();

      const codeToggle = island.locator("button[aria-expanded]");
      await expect
        .poll(
          async () => {
            await codeToggle.click();
            return codeToggle.getAttribute("aria-expanded");
          },
          { timeout: 10_000 },
        )
        .toBe("true");

      const structure = await island.evaluate((islandEl) => {
        const container = islandEl.querySelector(":scope > div");
        if (!container) return null;
        const children = Array.from(container.children) as HTMLElement[];
        const child0 = children[0] as HTMLElement | undefined;
        const child1 = children[1] as HTMLElement | undefined;
        const child0Rect = child0?.getBoundingClientRect();
        const child1Rect = child1?.getBoundingClientRect();
        return {
          childCount: children.length,
          child0Display: child0 ? getComputedStyle(child0).display : null,
          child0Height: child0Rect?.height ?? null,
          child1Display: child1 ? getComputedStyle(child1).display : null,
          child1Y: child1Rect?.y ?? null,
          titleBarBottom: child0Rect
            ? child0Rect.y + child0Rect.height
            : null,
        };
      });

      expect(structure, `island ${i} outer container`).not.toBeNull();
      const s = structure!;
      // The three siblings (title bar, preview area, code section) are not
      // collapsed or re-parented.
      expect(s.childCount, `island ${i} childCount`).toBe(3);
      // The title bar is just a bar — in the bug it absorbs the whole
      // component and grows to 200px+.
      expect(s.child0Display, `island ${i} title bar display`).toBe("flex");
      expect(s.child0Height, `island ${i} title bar height`).not.toBeNull();
      expect(s.child0Height as number).toBeLessThanOrEqual(80);
      // The preview area sits BELOW the title bar (vertical stack), not
      // beside it (the broken side-by-side layout).
      expect(s.child1Display, `island ${i} preview area display`).toBe(
        "block",
      );
      expect(s.child1Y, `island ${i} preview area y`).not.toBeNull();
      expect(s.titleBarBottom, `island ${i} title bar bottom`).not.toBeNull();
      expect(s.child1Y as number).toBeGreaterThanOrEqual(
        (s.titleBarBottom as number) - 2,
      );
    }
  });
});

test.describe("HtmlPreview: 44px control hit targets", () => {
  for (const viewport of [
    { name: "desktop", width: 1280 },
    { name: "narrow", width: 360 },
  ]) {
    test(`${viewport.name} controls are visible, reachable, and non-overlapping`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: 900 });
      await page.goto(PAGE, { waitUntil: "load" });

      // Use the public MDX <HtmlPreview> instance titled "JS Test" rather
      // than reaching into implementation-specific component markup.
      const island = page
        .locator('[data-zfb-island="HtmlPreviewWrapperInner"]')
        .filter({ hasText: "JS Test" });
      await expect(island).toHaveCount(1);
      await island.scrollIntoViewIfNeeded();

      const viewportButtons = island.locator(
        '[aria-label="Viewport size"] button',
      );
      const disclosureToggle = island.locator("button[aria-expanded]");
      const controls = island.locator(
        '[aria-label="Viewport size"] button, button[aria-expanded]',
      );
      await expect(viewportButtons).toHaveCount(3);
      await expect(disclosureToggle).toHaveCount(1);
      await expect(controls).toHaveCount(4);

      const rects = [] as Array<{
        bottom: number;
        height: number;
        left: number;
        right: number;
        top: number;
        width: number;
      }>;
      for (let i = 0; i < 4; i++) {
        const control = controls.nth(i);
        await expect(control).toBeVisible();
        rects.push(
          await control.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return {
              bottom: rect.bottom,
              height: rect.height,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              width: rect.width,
            };
          }),
        );
      }

      for (const [index, rect] of rects.entries()) {
        expect(rect.width, `control ${index} width`).toBeGreaterThanOrEqual(
          44,
        );
        expect(rect.height, `control ${index} height`).toBeGreaterThanOrEqual(
          44,
        );
      }

      // Wrapping the viewport controls is valid on narrow screens, but no
      // pair of controls may overlap, and none may be clipped horizontally.
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i]!;
        if (viewport.name === "narrow") {
          expect(rect.left, `control ${i} left edge`).toBeGreaterThanOrEqual(
            0,
          );
          expect(rect.right, `control ${i} right edge`).toBeLessThanOrEqual(
            viewport.width,
          );
        }
        for (let j = i + 1; j < rects.length; j++) {
          const other = rects[j]!;
          const overlaps =
            rect.left < other.right &&
            other.left < rect.right &&
            rect.top < other.bottom &&
            other.top < rect.bottom;
          expect(overlaps, `controls ${i} and ${j} overlap`).toBe(false);
        }
      }

      if (viewport.name === "narrow") {
        const pageWidths = await page.evaluate(() => ({
          bodyScrollWidth: document.body.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        }));
        expect(pageWidths.bodyScrollWidth).toBeLessThanOrEqual(
          pageWidths.clientWidth + 1,
        );
        expect(pageWidths.documentScrollWidth).toBeLessThanOrEqual(
          pageWidths.clientWidth + 1,
        );
        expect(pageWidths.clientWidth).toBeLessThanOrEqual(
          pageWidths.viewportWidth,
        );
      }
    });
  }
});

test.describe("HtmlPreview: lifecycle integration", () => {
  test("eager mode keeps its SSR iframe and executes its inline script", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "domcontentloaded" });

    const eager = previewAfterHeading(page, "Eager Lifecycle Test");
    await expect(eager).toHaveCount(1);
    await expect(eager.locator("iframe")).toHaveCount(1);
    await expect(
      eager.frameLocator("iframe").locator("#eager-lifecycle-3852"),
    ).toHaveText("eager-ran");
  });

  test("visible mode defers iframe work and local resources until explicit visibility", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    const resourceRequests: string[] = [];
    const resourceResponses: Array<{ path: string; status: number }> = [];
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    // These listeners intentionally precede navigation: requests or errors
    // caused by SSR iframe parsing would otherwise be invisible to this test.
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (path === VISIBLE_STYLE_PATH || path === VISIBLE_SCRIPT_PATH) {
        resourceRequests.push(path);
      }
    });
    page.on("response", (response) => {
      const path = new URL(response.url()).pathname;
      if (path === VISIBLE_STYLE_PATH || path === VISIBLE_SCRIPT_PATH) {
        resourceResponses.push({ path, status: response.status() });
      }
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto(PAGE, { waitUntil: "domcontentloaded" });

    // Do not use a locator before the explicit scroll. Locator visibility and
    // interaction helpers may scroll the page and accidentally satisfy the
    // visible gate. Inspect the marker and its inert subtree directly instead.
    // zfb attaches the render-mode marker asynchronously after navigation.
    // Wait for that lightweight mount through page.evaluate only: no locator
    // action may auto-scroll the marker before this no-work check settles.
    await expect
      .poll(
        async () => {
          const snapshot = await inspectVisibleMarker(page);
          return (
            snapshot.markerIndex >= 0 &&
            snapshot.mountedSignal &&
            snapshot.reservationCount === 1 &&
            snapshot.iframeCount === 0 &&
            snapshot.inlineTargetCount === 0 &&
            snapshot.nestedIslandCount === 0
          );
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    const preVisibility = await inspectVisibleMarker(page);

    expect(preVisibility.markerCount).toBeGreaterThan(0);
    expect(preVisibility.markerIndex).toBeGreaterThanOrEqual(0);
    expect(preVisibility.pageScrollY).toBe(0);
    expect(preVisibility.mountedSignal).toBe(true);
    expect(preVisibility.markerTop).not.toBeNull();
    expect(preVisibility.markerTop as number).toBeGreaterThan(
      preVisibility.viewportHeight,
    );
    // zfb may already have marked the skip-SSR container as mounted. That
    // marker is not the heavy preview: the reservation must still contain no
    // iframe, source document, nested island, or inline side-effect target.
    expect(preVisibility.iframeCount).toBe(0);
    expect(preVisibility.reservationCount).toBe(1);
    expect(preVisibility.inlineTargetCount).toBe(0);
    expect(preVisibility.nestedIslandCount).toBe(0);
    expect(resourceRequests).toEqual([]);
    expect(resourceResponses).toEqual([]);

    await page.evaluate(
      ({ markerSelector, markerIndex }) => {
        const marker = document.querySelectorAll(markerSelector)[markerIndex];
        marker?.scrollIntoView({ block: "center" });
      },
      {
        markerSelector: HTML_PREVIEW_SKIP_SSR,
        markerIndex: preVisibility.markerIndex,
      },
    );

    const visible = page
      .locator(HTML_PREVIEW_SKIP_SSR)
      .nth(preVisibility.markerIndex);
    const visibleIframe = visible.locator("iframe");
    // Poll the actual iframe, not data-zfb-island-mounted: zfb mounts the
    // skip-SSR target immediately while HtmlPreviewWrapperInner still waits
    // for its private one-shot IntersectionObserver.
    await expect.poll(() => visibleIframe.count(), { timeout: 10_000 }).toBe(1);
    await expect(visible).toHaveAttribute("data-zfb-island-mounted", "");

    const visibleFrame = visible.frameLocator("iframe");
    await expect(
      visibleFrame.locator("#visible-inline-target-3852"),
    ).toHaveText("inline-ran");
    await expect(
      visibleFrame.locator("#visible-external-target-3852"),
    ).toHaveText("external-ran");
    await expect(
      visibleFrame.locator("#visible-style-target-3852"),
    ).toHaveCSS("border-left-width", "6px");

    await expect
      .poll(
        () => resourceResponses.length,
        { timeout: 10_000 },
      )
      .toBe(2);
    expect([...resourceRequests].sort()).toEqual(
      [VISIBLE_SCRIPT_PATH, VISIBLE_STYLE_PATH].sort(),
    );
    expect(resourceResponses.map(({ path }) => path).sort()).toEqual(
      [VISIBLE_SCRIPT_PATH, VISIBLE_STYLE_PATH].sort(),
    );
    for (const response of resourceResponses) {
      expect(response.status, `${response.path} response`).toBe(200);
    }

    const nestedIslandCount = await visible.evaluate((marker) =>
      marker.querySelectorAll(
        "[data-zfb-island], [data-zfb-island-skip-ssr]",
      ).length,
    );
    expect(nestedIslandCount).toBe(0);
    assertNoConsoleErrors();
    expect(pageErrors).toEqual([]);
    expect(
      consoleErrors.filter((message) => !message.toLowerCase().includes("favicon")),
    ).toEqual([]);
  });

  test("same-origin auto-height follows user-triggered growth and shrink", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "domcontentloaded" });

    const dynamic = previewAfterHeading(page, "Dynamic Lifecycle Test");
    await expect(dynamic).toHaveCount(1);
    await dynamic.scrollIntoViewIfNeeded();
    await waitForPreviewHydration(dynamic);

    await expect
      .poll(() => iframeHeight(dynamic), { timeout: 10_000 })
      .toBeGreaterThan(280);
    const initialHeight = await iframeHeight(dynamic);
    const dynamicFrame = dynamic.frameLocator("iframe");

    await dynamicFrame.locator("#dynamic-grow-3852").click();
    await expect(
      dynamicFrame.locator("#dynamic-content-3852"),
    ).toHaveAttribute("data-state", "grown");
    await expect
      .poll(() => iframeHeight(dynamic), { timeout: 10_000 })
      .toBeGreaterThan(initialHeight + 250);
    const grownHeight = await iframeHeight(dynamic);

    await dynamicFrame.locator("#dynamic-shrink-3852").click();
    await expect(
      dynamicFrame.locator("#dynamic-content-3852"),
    ).toHaveAttribute("data-state", "shrunk");
    await expect
      .poll(() => iframeHeight(dynamic), { timeout: 10_000 })
      .toBeLessThan(grownHeight - 200);
    await expect
      .poll(() => iframeHeight(dynamic), { timeout: 10_000 })
      .toBeGreaterThan(initialHeight);
  });

  test("auto-height reflows through Mobile, Tablet, and Full presets", async ({
    page,
  }) => {
    // The Full preset is intentionally wider than the content band at the
    // default Playwright viewport. Use a wide page so its media query remains
    // distinct from the 768px Tablet preset.
    await page.setViewportSize({ width: 2400, height: 1000 });
    await page.goto(PAGE, { waitUntil: "domcontentloaded" });

    const reflow = previewAfterHeading(page, "Reflow Lifecycle Test");
    await expect(reflow).toHaveCount(1);
    await reflow.scrollIntoViewIfNeeded();
    await waitForPreviewHydration(reflow);
    await expect
      .poll(() => iframeHeight(reflow), { timeout: 10_000 })
      .toBeGreaterThan(280);
    const fullHeight = await iframeHeight(reflow);

    const mobile = reflow.getByRole("button", { name: "Mobile", exact: true });
    await mobile.click();
    await expect(mobile).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => iframeHeight(reflow), { timeout: 10_000 })
      .toBeGreaterThan(fullHeight + 250);
    const mobileHeight = await iframeHeight(reflow);

    const tablet = reflow.getByRole("button", { name: "Tablet", exact: true });
    await tablet.click();
    await expect(tablet).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => iframeHeight(reflow), { timeout: 10_000 })
      .toBeGreaterThan(fullHeight + 100);
    await expect
      .poll(() => iframeHeight(reflow), { timeout: 10_000 })
      .toBeLessThan(mobileHeight - 100);
    const tabletHeight = await iframeHeight(reflow);

    const full = reflow.getByRole("button", { name: "Full", exact: true });
    await full.click();
    await expect(full).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => iframeHeight(reflow), { timeout: 10_000 })
      .toBeLessThan(tabletHeight - 100);
    await expect
      .poll(() => iframeHeight(reflow), { timeout: 10_000 })
      .toBeGreaterThan(280);
  });

  test("fixed height stays exact despite oversized content and viewport changes", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "domcontentloaded" });

    const fixed = previewAfterHeading(page, "Fixed Height Lifecycle Test");
    await expect(fixed).toHaveCount(1);
    await fixed.scrollIntoViewIfNeeded();
    await waitForPreviewHydration(fixed);
    await expect
      .poll(() => iframeHeight(fixed), { timeout: 10_000 })
      .toBe(280);
    await expect
      .poll(
        () =>
          fixed.locator("iframe").evaluate(
            (iframe) =>
              (iframe as HTMLIFrameElement).contentDocument?.body
                .scrollHeight ?? 0,
          ),
        { timeout: 10_000 },
      )
      .toBeGreaterThan(280);

    for (const label of ["Mobile", "Tablet", "Full"]) {
      const button = fixed.getByRole("button", { name: label, exact: true });
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect.poll(() => iframeHeight(fixed)).toBe(280);
    }
  });

  test("valid fullHeight with fixed height stays exact", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "domcontentloaded" });

    const fullHeight = previewAfterHeading(
      page,
      "FullHeight Fixed Lifecycle Test",
    );
    await expect(fullHeight).toHaveCount(1);
    await fullHeight.scrollIntoViewIfNeeded();
    await waitForPreviewHydration(fullHeight);
    const iframe = fullHeight.locator("iframe");
    await expect.poll(() => iframeHeight(fullHeight)).toBe(320);
    await expect(iframe).toHaveAttribute(
      "srcdoc",
      /html,body\{height:100%\}/,
    );

    for (const label of ["Mobile", "Tablet", "Full"]) {
      const button = fullHeight.getByRole("button", {
        name: label,
        exact: true,
      });
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect.poll(() => iframeHeight(fullHeight)).toBe(320);
    }
  });

  test("opaque-origin fixed height remains readable only through its frame and stable", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "domcontentloaded" });

    const opaque = previewAfterHeading(
      page,
      "Opaque Fixed Height Lifecycle Test",
    );
    await expect(opaque).toHaveCount(1);
    await opaque.scrollIntoViewIfNeeded();
    await waitForPreviewHydration(opaque);
    const iframe = opaque.locator("iframe");
    await expect(iframe).toHaveAttribute("sandbox", /^\s*$/);
    await expect.poll(() => iframeHeight(opaque)).toBe(300);

    const parentCanReadBody = await iframe.evaluate((frame) => {
      try {
        return (frame as HTMLIFrameElement).contentDocument?.body != null;
      } catch {
        return false;
      }
    });
    expect(parentCanReadBody).toBe(false);

    for (const label of ["Mobile", "Tablet", "Full"]) {
      const button = opaque.getByRole("button", { name: label, exact: true });
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect.poll(() => iframeHeight(opaque)).toBe(300);
    }
  });

  test("reload and SPA unmount leave no stale lifecycle callbacks or errors", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    // Install before the first navigation so errors from either the original
    // document or its replacement are captured.
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto(PAGE, { waitUntil: "domcontentloaded" });
    const dynamic = previewAfterHeading(page, "Dynamic Lifecycle Test");
    await dynamic.scrollIntoViewIfNeeded();
    await waitForPreviewHydration(dynamic);
    await dynamic.frameLocator("iframe").locator("#dynamic-grow-3852").click();
    await expect
      .poll(() => iframeHeight(dynamic), { timeout: 10_000 })
      .toBeGreaterThan(500);

    // A full reload tears down the old iframe/controller and creates a fresh
    // eager tree. The second pass proves the new tree still hydrates normally.
    await page.reload({ waitUntil: "domcontentloaded" });
    const reloadedDynamic = previewAfterHeading(
      page,
      "Dynamic Lifecycle Test",
    );
    await expect(reloadedDynamic).toHaveCount(1);
    await reloadedDynamic.scrollIntoViewIfNeeded();
    await waitForPreviewHydration(reloadedDynamic);
    await expect
      .poll(() => iframeHeight(reloadedDynamic), { timeout: 10_000 })
      .toBeGreaterThan(280);

    expect(await spaClick(page, "/docs/guides/page-1")).toBe(true);
    await expect(page).toHaveURL(/\/docs\/guides\/page-1\/?$/);
    await expect(
      page.locator(`${HTML_PREVIEW_ISLAND}, ${HTML_PREVIEW_SKIP_SSR}`),
    ).toHaveCount(0);

    assertNoConsoleErrors();
    expect(pageErrors).toEqual([]);
    expect(
      consoleErrors.filter((message) => !message.toLowerCase().includes("favicon")),
    ).toEqual([]);
  });
});
