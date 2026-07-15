import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures";

const PAGE = "/docs/getting-started/";
const THEME_STORAGE_KEY = "zudo-doc-theme";
const ISLAND_SELECTOR = '[data-zfb-island="HtmlPreviewWrapperInner"]';
const DESKTOP_TOGGLE_SELECTOR =
  'header .ml-auto button[aria-label*="Switch to"]';
const PANEL_TRIGGER = "#design-token-trigger";

type PreviewGuard = {
  pre: HTMLPreElement;
  token: HTMLSpanElement;
  innerHTML: string;
  tokenClassName: string;
  mutationCount: number;
  observer: MutationObserver;
};

type PreviewGuardWindow = Window & {
  __zudoHtmlPreviewHighlightGuard?: PreviewGuard;
};

function isMdWasmResource(rawUrl: string): boolean {
  const pathname = new URL(rawUrl).pathname;
  return (
    (pathname.includes(
      "islands-resource-zfb_md_wasm_glue.zfb-resource-",
    ) && pathname.endsWith(".mjs")) ||
    (pathname.includes("islands-resource-zfb_md_wasm_bg-") &&
      pathname.endsWith(".wasm"))
  );
}

async function preseedLightTheme(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: THEME_STORAGE_KEY, value: "light" },
  );
}

async function waitForGuardColor(
  page: Page,
  mode: "light" | "dark",
  previousColor?: string,
): Promise<void> {
  await page.waitForFunction(
    ({ expectedMode, oldColor }) => {
      const state = (window as PreviewGuardWindow)
        .__zudoHtmlPreviewHighlightGuard;
      if (
        !state ||
        document.documentElement.dataset.theme !== expectedMode ||
        document.documentElement.style.colorScheme !== expectedMode
      ) {
        return false;
      }

      const probe = document.createElement("span");
      probe.style.color = "var(--zd-syntax-keyword)";
      document.body.append(probe);
      const semanticColor = getComputedStyle(probe).color;
      probe.remove();
      const tokenColor = getComputedStyle(state.token).color;
      return (
        tokenColor === semanticColor &&
        (oldColor === undefined || tokenColor !== oldColor)
      );
    },
    { expectedMode: mode, oldColor: previousColor },
  );
}

async function startPreviewGuard(pre: Locator) {
  return pre.evaluate((preElement) => {
    const preNode = preElement as HTMLPreElement;
    const token = preNode.querySelector<HTMLSpanElement>("span.hi-kw");
    if (!token) throw new Error("preview JavaScript keyword token is missing");

    let state: PreviewGuard;
    const observer = new MutationObserver((records) => {
      state.mutationCount += records.length;
    });
    state = {
      pre: preNode,
      token,
      innerHTML: preNode.innerHTML,
      tokenClassName: token.className,
      mutationCount: 0,
      observer,
    };
    observer.observe(preNode, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    (window as PreviewGuardWindow).__zudoHtmlPreviewHighlightGuard = state;

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
      tokenColor: getComputedStyle(token).color,
      semanticColor: resolveColor("--zd-syntax-keyword"),
      defaultLightColor: resolveColor("--palette-accent-2"),
      semanticDeclaration: getComputedStyle(document.documentElement)
        .getPropertyValue("--zd-syntax-keyword")
        .trim(),
      preInlineStyle: preNode.getAttribute("style"),
      tokenInlineStyle: token.getAttribute("style"),
    };
  });
}

async function readPreviewGuard(
  page: Page,
  options: { finish?: boolean; selectedPaletteVar?: string } = {},
) {
  return page.evaluate(({ finish, selectedPaletteVar }) => {
    const testWindow = window as PreviewGuardWindow;
    const state = testWindow.__zudoHtmlPreviewHighlightGuard;
    if (!state) throw new Error("preview highlight guard is not initialized");
    state.mutationCount += state.observer.takeRecords().length;

    const resolveColor = (cssVar: string) => {
      const probe = document.createElement("span");
      probe.style.color = `var(${cssVar})`;
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };

    const result = {
      theme: document.documentElement.dataset.theme,
      tokenColor: getComputedStyle(state.token).color,
      semanticColor: resolveColor("--zd-syntax-keyword"),
      defaultLightColor: resolveColor("--palette-accent-2"),
      namedVariationColor: resolveColor("--palette-state-info"),
      selectedPaletteColor: selectedPaletteVar
        ? resolveColor(selectedPaletteVar)
        : null,
      samePreNode: state.pre.isConnected,
      sameTokenNode:
        state.token.isConnected && state.pre.contains(state.token),
      sameInnerHTML: state.pre.innerHTML === state.innerHTML,
      sameTokenClass: state.token.className === state.tokenClassName,
      mutationCount: state.mutationCount,
    };

    if (finish) {
      state.observer.disconnect();
      delete testWindow.__zudoHtmlPreviewHighlightGuard;
    }
    return result;
  }, options);
}

function expectStablePreviewDom(state: Awaited<ReturnType<typeof readPreviewGuard>>) {
  expect(state.samePreNode).toBe(true);
  expect(state.sameTokenNode).toBe(true);
  expect(state.sameInnerHTML).toBe(true);
  expect(state.sameTokenClass).toBe(true);
  expect(state.mutationCount).toBe(0);
}

test.describe("HtmlPreview semantic syntax tokens", () => {
  test("light, named dark, and a live edit recolor existing WASM markup", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    const resourceRequests: string[] = [];
    page.on("request", (request) => {
      if (isMdWasmResource(request.url())) resourceRequests.push(request.url());
    });

    await preseedLightTheme(page);
    await page.goto(PAGE, { waitUntil: "networkidle" });

    const island = page.locator(ISLAND_SELECTOR).filter({
      hasText: "Syntax Token Preview",
    });
    await island.scrollIntoViewIfNeeded();
    const sourceToggle = island.getByRole("button", { name: "Show code" });
    await expect
      .poll(
        async () => {
          await sourceToggle.click();
          return sourceToggle.getAttribute("aria-expanded");
        },
        { timeout: 10_000 },
      )
      .toBe("true");

    const previewOutputs = island.locator(".zd-html-preview-code");
    await expect(previewOutputs).toHaveCount(2, { timeout: 10_000 });
    const javascriptPre = previewOutputs.nth(1).locator("pre.hi-root");
    await expect(javascriptPre.locator("span.hi-kw").first()).toBeVisible();

    const before = await startPreviewGuard(javascriptPre);
    expect(before.theme).toBe("light");
    expect(before.semanticDeclaration).not.toBe("");
    expect(before.tokenColor).toBe(before.semanticColor);
    expect(before.tokenColor).toBe(before.defaultLightColor);
    expect(before.preInlineStyle).toBeNull();
    expect(before.tokenInlineStyle).toBeNull();
    expect(resourceRequests).toHaveLength(2);
    const resourceRequestCount = resourceRequests.length;

    await page.locator(DESKTOP_TOGGLE_SELECTOR).click();
    await waitForGuardColor(page, "dark", before.tokenColor);

    const namedVariation = await readPreviewGuard(page);
    expect(namedVariation.theme).toBe("dark");
    expect(namedVariation.tokenColor).toBe(namedVariation.semanticColor);
    expect(namedVariation.tokenColor).toBe(
      namedVariation.namedVariationColor,
    );
    expectStablePreviewDom(namedVariation);
    expect(resourceRequests).toHaveLength(resourceRequestCount);

    await page.locator(PANEL_TRIGGER).click();
    const keywordSelect = page
      .getByTestId("tokenpanel-semantic-ref-syntaxKeyword")
      .getByLabel("--zd-syntax-keyword tier reference", { exact: true });
    await expect(keywordSelect).toBeVisible();

    const afterPanelOpen = await readPreviewGuard(page);
    expect(afterPanelOpen.tokenColor).toBe(namedVariation.tokenColor);
    expect(afterPanelOpen.tokenColor).toBe(afterPanelOpen.semanticColor);
    expectStablePreviewDom(afterPanelOpen);

    const currentValue = await keywordSelect.inputValue();
    const nextAccentValue = await keywordSelect
      .locator('optgroup[label="Accent"] option')
      .evaluateAll((options, selectedValue) => {
        const option = options.find(
          (candidate) =>
            (candidate as HTMLOptionElement).value !== selectedValue,
        ) as HTMLOptionElement | undefined;
        return option?.value ?? null;
      }, currentValue);
    if (!nextAccentValue) {
      throw new Error("syntaxKeyword has no alternate Accent ramp option");
    }
    await keywordSelect.selectOption(nextAccentValue);

    const checkedOption = keywordSelect.locator("option:checked");
    const selectedPaletteVar = await checkedOption.evaluate((option) => {
      const match = option.textContent?.match(/--palette-accent-\d+/);
      if (!match) throw new Error("selected Accent option has no palette var");
      return match[0];
    });
    await waitForGuardColor(page, "dark", afterPanelOpen.tokenColor);

    const edited = await readPreviewGuard(page, { selectedPaletteVar });
    expect(edited.tokenColor).not.toBe(afterPanelOpen.tokenColor);
    expect(edited.tokenColor).toBe(edited.semanticColor);
    expect(edited.tokenColor).toBe(edited.selectedPaletteColor);
    expectStablePreviewDom(edited);
    expect(resourceRequests).toHaveLength(resourceRequestCount);

    await page.locator(DESKTOP_TOGGLE_SELECTOR).click();
    await waitForGuardColor(page, "light", edited.tokenColor);
    const lightAfterEdit = await readPreviewGuard(page, { finish: true });
    expect(lightAfterEdit.tokenColor).toBe(lightAfterEdit.semanticColor);
    expect(lightAfterEdit.tokenColor).toBe(lightAfterEdit.defaultLightColor);
    expectStablePreviewDom(lightAfterEdit);
    expect(resourceRequests).toHaveLength(resourceRequestCount);

    assertNoConsoleErrors();
  });
});
