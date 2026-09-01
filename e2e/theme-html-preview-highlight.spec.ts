import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures";

const PAGE = "/docs/getting-started/";
const THEME_STORAGE_KEY = "zudo-doc-theme";
const ISLAND_SELECTOR = '[data-zfb-island="HtmlPreviewWrapperInner"]';
const DESKTOP_TOGGLE_SELECTOR =
  'header .ml-auto button[aria-label*="Switch to"]';
const PANEL_TRIGGER = "#design-token-trigger";
const PANEL_SHELL = ".tokenpanel-shell";

const NAVIGATION_TIMEOUT_MS = 15_000;
const MOUNT_TIMEOUT_MS = 15_000;
const NETWORK_ASSERTION_TIMEOUT_MS = 10_000;
const GUARD_COLOR_TIMEOUT_MS = 10_000;
const INTERACTION_TIMEOUT_MS = 3_000;
const LOAD_STAGE_TIMEOUT_MS = 18_000;
const SOURCE_STAGE_TIMEOUT_MS = 18_000;
const WASM_STAGE_TIMEOUT_MS = 12_000;
const THEME_STAGE_TIMEOUT_MS = 12_000;
const PANEL_STAGE_TIMEOUT_MS = 15_000;
const EDIT_STAGE_TIMEOUT_MS = 12_000;
const SEQUENTIAL_STAGE_BUDGET_MS =
  LOAD_STAGE_TIMEOUT_MS +
  SOURCE_STAGE_TIMEOUT_MS +
  WASM_STAGE_TIMEOUT_MS +
  THEME_STAGE_TIMEOUT_MS +
  PANEL_STAGE_TIMEOUT_MS +
  EDIT_STAGE_TIMEOUT_MS +
  THEME_STAGE_TIMEOUT_MS;
const TEST_TIMEOUT_MS = Math.ceil(SEQUENTIAL_STAGE_BUDGET_MS / 0.75);

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
      "islands-resource-zfb_md_wasm_highlight_glue.zfb-resource-",
    ) && pathname.endsWith(".mjs")) ||
    (pathname.includes("islands-resource-zfb_md_wasm_highlight_bg-") &&
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
  stage: string,
  mode: "light" | "dark",
  previousColor?: string,
): Promise<void> {
  try {
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
      { timeout: GUARD_COLOR_TIMEOUT_MS },
    );
  } catch (cause) {
    throw new Error(
      `Guard-color stage "${stage}" did not reach ${mode} within ${GUARD_COLOR_TIMEOUT_MS}ms`,
      { cause },
    );
  }
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

test.use({ trace: "retain-on-failure" });

test.describe("HtmlPreview semantic syntax tokens", () => {
  test("light, named dark, and a live edit recolor existing WASM markup", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    // Sequential stage worst cases: load/navigation 18s + source mount/open 18s
    // + WASM/network proof 12s + named-dark recolor 12s + panel readiness 15s
    // + live edit 12s + light recolor 12s = 99s. Each enclosing test.step bound
    // includes its actions and nested assertion/wait bounds, so nested limits do
    // not add again. 99s is 75% of the derived 132s test budget. Playwright also
    // grants teardown an equal 132s budget; with CI's one retry, the 528s ceiling
    // remains well inside the 15-minute E2E job budget.
    test.setTimeout(TEST_TIMEOUT_MS);

    const resourceRequests: string[] = [];
    page.on("request", (request) => {
      if (isMdWasmResource(request.url())) resourceRequests.push(request.url());
    });

    const island = await test.step(
      "load the light-theme preview page",
      async () => {
        await preseedLightTheme(page);
        await page.goto(PAGE, {
          waitUntil: "domcontentloaded",
          timeout: NAVIGATION_TIMEOUT_MS,
        });

        const previewIsland = page.locator(ISLAND_SELECTOR).filter({
          hasText: "Syntax Token Preview",
        });
        await expect(previewIsland).toHaveCount(1, {
          timeout: NETWORK_ASSERTION_TIMEOUT_MS,
        });
        return previewIsland;
      },
      { timeout: LOAD_STAGE_TIMEOUT_MS },
    );

    await test.step(
      "wait for the preview mount signal and open source once",
      async () => {
        await island.scrollIntoViewIfNeeded({
          timeout: INTERACTION_TIMEOUT_MS,
        });
        // zfb stamps this after mount returns. That is sufficient here because
        // PreviewBase attaches the source-toggle handler during render.
        await expect(island).toHaveAttribute("data-zfb-island-mounted", "", {
          timeout: MOUNT_TIMEOUT_MS,
        });
        const sourceToggle = island.locator("button[aria-expanded]");
        await sourceToggle.click({ timeout: INTERACTION_TIMEOUT_MS });
        await expect(sourceToggle).toHaveAttribute("aria-expanded", "true", {
          timeout: NETWORK_ASSERTION_TIMEOUT_MS,
        });
      },
      { timeout: SOURCE_STAGE_TIMEOUT_MS },
    );

    const { before, resourceRequestCount } = await test.step(
      "prove WASM highlighting and start the DOM-stability guard",
      async () => {
        const previewOutputs = island.locator(".zd-html-preview-code");
        await expect(previewOutputs).toHaveCount(2, {
          timeout: NETWORK_ASSERTION_TIMEOUT_MS,
        });
        const highlightedPre = previewOutputs.nth(1).locator("pre.hi-root");
        await expect(
          highlightedPre.locator("span.hi-kw").first(),
        ).toBeVisible({ timeout: NETWORK_ASSERTION_TIMEOUT_MS });

        const initial = await startPreviewGuard(highlightedPre);
        expect(initial.theme).toBe("light");
        expect(initial.semanticDeclaration).not.toBe("");
        expect(initial.tokenColor).toBe(initial.semanticColor);
        expect(initial.tokenColor).toBe(initial.defaultLightColor);
        expect(initial.preInlineStyle).toBeNull();
        expect(initial.tokenInlineStyle).toBeNull();
        expect(resourceRequests).toHaveLength(2);
        return {
          before: initial,
          resourceRequestCount: resourceRequests.length,
        };
      },
      { timeout: WASM_STAGE_TIMEOUT_MS },
    );

    const namedVariation = await test.step(
      "apply the named dark theme",
      async () => {
        const desktopToggle = page.locator(DESKTOP_TOGGLE_SELECTOR);
        // zudolab/zudo-doc#3828: the toggle swallows clicks while pending; a
        // swallowed first click plus the old unbounded color guard explains the
        // recorded one-off timeout.
        await expect(desktopToggle).not.toHaveAttribute("data-zd-pending", "", {
          timeout: NETWORK_ASSERTION_TIMEOUT_MS,
        });
        await desktopToggle.click({ timeout: INTERACTION_TIMEOUT_MS });
        await waitForGuardColor(
          page,
          "named dark theme",
          "dark",
          before.tokenColor,
        );

        const state = await readPreviewGuard(page);
        expect(state.theme).toBe("dark");
        expect(state.tokenColor).toBe(state.semanticColor);
        expect(state.tokenColor).toBe(state.namedVariationColor);
        expectStablePreviewDom(state);
        expect(resourceRequests).toHaveLength(resourceRequestCount);
        return state;
      },
      { timeout: THEME_STAGE_TIMEOUT_MS },
    );

    const { keywordSelect, afterPanelOpen } = await test.step(
      "open the token panel and wait for the syntax control",
      async () => {
        await page
          .locator(PANEL_TRIGGER)
          .click({ timeout: INTERACTION_TIMEOUT_MS });
        await expect(page.locator(PANEL_SHELL)).toBeVisible({
          timeout: NETWORK_ASSERTION_TIMEOUT_MS,
        });
        await page
          .getByRole("tab", { name: "Color", exact: true })
          .click({ timeout: INTERACTION_TIMEOUT_MS });
        const select = page
          .getByTestId("tokenpanel-semantic-ref-syntaxKeyword")
          .getByLabel("--zd-syntax-keyword tier reference", { exact: true });
        await expect(select).toBeVisible({
          timeout: NETWORK_ASSERTION_TIMEOUT_MS,
        });

        const state = await readPreviewGuard(page);
        expect(state.tokenColor).toBe(namedVariation.tokenColor);
        expect(state.tokenColor).toBe(state.semanticColor);
        expectStablePreviewDom(state);
        return { keywordSelect: select, afterPanelOpen: state };
      },
      { timeout: PANEL_STAGE_TIMEOUT_MS },
    );

    const edited = await test.step(
      "apply a live syntax-token edit",
      async () => {
        const currentValue = await keywordSelect.inputValue({
          timeout: INTERACTION_TIMEOUT_MS,
        });
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
        await keywordSelect.selectOption(nextAccentValue, {
          timeout: INTERACTION_TIMEOUT_MS,
        });

        const checkedOption = keywordSelect.locator("option:checked");
        const selectedPaletteVar = await checkedOption.evaluate((option) => {
          const match = option.textContent?.match(/--palette-accent-\d+/);
          if (!match) {
            throw new Error("selected Accent option has no palette var");
          }
          return match[0];
        });
        await waitForGuardColor(
          page,
          "live syntax-token edit",
          "dark",
          afterPanelOpen.tokenColor,
        );

        const state = await readPreviewGuard(page, { selectedPaletteVar });
        expect(state.tokenColor).not.toBe(afterPanelOpen.tokenColor);
        expect(state.tokenColor).toBe(state.semanticColor);
        expect(state.tokenColor).toBe(state.selectedPaletteColor);
        expectStablePreviewDom(state);
        expect(resourceRequests).toHaveLength(resourceRequestCount);
        return state;
      },
      { timeout: EDIT_STAGE_TIMEOUT_MS },
    );

    await test.step(
      "return the edited preview to light theme",
      async () => {
        const desktopToggle = page.locator(DESKTOP_TOGGLE_SELECTOR);
        // zudolab/zudo-doc#3828: every theme click must wait until hydration
        // pending clears because pending clicks are intentionally swallowed.
        await expect(desktopToggle).not.toHaveAttribute("data-zd-pending", "", {
          timeout: NETWORK_ASSERTION_TIMEOUT_MS,
        });
        await desktopToggle.click({ timeout: INTERACTION_TIMEOUT_MS });
        await waitForGuardColor(
          page,
          "light theme after live edit",
          "light",
          edited.tokenColor,
        );
        const lightAfterEdit = await readPreviewGuard(page, { finish: true });
        expect(lightAfterEdit.tokenColor).toBe(lightAfterEdit.semanticColor);
        expect(lightAfterEdit.tokenColor).toBe(
          lightAfterEdit.defaultLightColor,
        );
        expectStablePreviewDom(lightAfterEdit);
        expect(resourceRequests).toHaveLength(resourceRequestCount);
      },
      { timeout: THEME_STAGE_TIMEOUT_MS },
    );

    assertNoConsoleErrors();
  });
});
