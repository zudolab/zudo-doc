import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "./fixtures";
import { expectHtmlAttr } from "./html-assertions";
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
const RESOURCE_PREFIX = "islands-resource-zfb_md_wasm_";
const RESOURCE_GLUE_PREFIX =
  "islands-resource-zfb_md_wasm_glue.zfb-resource-";
const RESOURCE_WASM_PREFIX = "islands-resource-zfb_md_wasm_bg-";

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
});

test.describe("HtmlPreview: zfb md-wasm resources and semantic output", () => {
  test("stays lazy until Show code, then loads one valid resource pair for HTML/CSS/JS", async ({
    page,
    assertNoConsoleErrors,
  }) => {
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

    await page.goto(PAGE, { waitUntil: "networkidle" });

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
    expect(defaultDarkColors.theme).toBeUndefined();
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
      /^application\/javascript(?:;|$)/,
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
