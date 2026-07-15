import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

const PAGE = "/docs/getting-started/";
const THEME_STORAGE_KEY = "zudo-doc-theme";
const PRE_SELECTOR = "main pre.hi-root";
const TOKEN_SELECTOR = `${PRE_SELECTOR} span.hi-kw`;
const DESKTOP_TOGGLE_SELECTOR = 'header .ml-auto button[aria-label*="Switch to"]';
const PANEL_TRIGGER = "#design-token-trigger";
const PANEL_SHELL = ".tokenpanel-shell";

type SyntaxRegressionState = {
  pre: HTMLPreElement;
  token: HTMLSpanElement;
  innerHTML: string;
  tokenClassName: string;
  mutationCount: number;
  observer: MutationObserver;
};

type SyntaxRegressionWindow = Window & {
  __zudoSyntaxHighlightRegression?: SyntaxRegressionState;
};

async function preseedLightTheme(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    { key: THEME_STORAGE_KEY, value: "light" },
  );
}

async function waitForThemeSyntaxBridge(
  page: Page,
  mode: "light" | "dark",
): Promise<void> {
  await page.waitForFunction(
    ({ tokenSelector, expectedMode }) => {
      const currentToken = document.querySelector(tokenSelector);
      if (
        !currentToken ||
        document.documentElement.dataset.theme !== expectedMode ||
        document.documentElement.style.colorScheme !== expectedMode
      ) {
        return false;
      }

      const semanticProbe = document.createElement("span");
      semanticProbe.style.position = "fixed";
      semanticProbe.style.visibility = "hidden";
      semanticProbe.style.color = "var(--zd-syntax-keyword)";
      document.body.append(semanticProbe);
      const semanticColor = getComputedStyle(semanticProbe).color;
      semanticProbe.remove();
      return getComputedStyle(currentToken).color === semanticColor;
    },
    { tokenSelector: TOKEN_SELECTOR, expectedMode: mode },
  );
}

async function startHighlightedDomGuard(page: Page) {
  return page.evaluate(
    ({ preSelector, tokenSelector }) => {
      const pre = document.querySelector<HTMLPreElement>(preSelector);
      const token = document.querySelector<HTMLSpanElement>(tokenSelector);
      if (!pre || !token) {
        throw new Error("native class-mode syntax fixture was not rendered");
      }

      const testWindow = window as SyntaxRegressionWindow;
      let state: SyntaxRegressionState;
      const observer = new MutationObserver((records) => {
        state.mutationCount += records.length;
      });
      state = {
        pre,
        token,
        innerHTML: pre.innerHTML,
        tokenClassName: token.className,
        mutationCount: 0,
        observer,
      };
      observer.observe(pre, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true,
      });
      testWindow.__zudoSyntaxHighlightRegression = state;

      const semanticProbe = document.createElement("span");
      semanticProbe.style.position = "fixed";
      semanticProbe.style.visibility = "hidden";
      semanticProbe.style.color = "var(--zd-syntax-keyword)";
      document.body.append(semanticProbe);
      const semanticColor = getComputedStyle(semanticProbe).color;
      semanticProbe.style.color = "var(--palette-accent-2)";
      const defaultLightColor = getComputedStyle(semanticProbe).color;
      semanticProbe.remove();

      return {
        theme: document.documentElement.dataset.theme,
        colorScheme: getComputedStyle(document.documentElement).colorScheme,
        tokenColor: getComputedStyle(token).color,
        semanticColor,
        defaultLightColor,
        preInlineStyle: pre.getAttribute("style"),
        tokenInlineStyle: token.getAttribute("style"),
      };
    },
    { preSelector: PRE_SELECTOR, tokenSelector: TOKEN_SELECTOR },
  );
}

async function readHighlightedDomGuard(page: Page, finish: boolean) {
  return page.evaluate(
    ({ preSelector, tokenSelector, shouldFinish }) => {
      const testWindow = window as SyntaxRegressionWindow;
      const state = testWindow.__zudoSyntaxHighlightRegression;
      const pre = document.querySelector<HTMLPreElement>(preSelector);
      const token = document.querySelector<HTMLSpanElement>(tokenSelector);
      if (!state || !pre || !token) {
        throw new Error("syntax-highlight DOM guard was not initialized");
      }

      state.mutationCount += state.observer.takeRecords().length;

      const semanticProbe = document.createElement("span");
      semanticProbe.style.position = "fixed";
      semanticProbe.style.visibility = "hidden";
      semanticProbe.style.color = "var(--zd-syntax-keyword)";
      document.body.append(semanticProbe);
      const semanticColor = getComputedStyle(semanticProbe).color;
      semanticProbe.style.color = "var(--palette-state-info)";
      const namedVariationColor = getComputedStyle(semanticProbe).color;
      semanticProbe.remove();

      const result = {
        theme: document.documentElement.dataset.theme,
        colorScheme: getComputedStyle(document.documentElement).colorScheme,
        tokenColor: getComputedStyle(token).color,
        semanticColor,
        namedVariationColor,
        samePreNode: pre === state.pre,
        sameTokenNode: token === state.token,
        sameInnerHTML: pre.innerHTML === state.innerHTML,
        sameTokenClass: token.className === state.tokenClassName,
        mutationCount: state.mutationCount,
      };

      if (shouldFinish) {
        state.observer.disconnect();
        delete testWindow.__zudoSyntaxHighlightRegression;
      }
      return result;
    },
    {
      preSelector: PRE_SELECTOR,
      tokenSelector: TOKEN_SELECTOR,
      shouldFinish: finish,
    },
  );
}

test.describe("Syntax highlighting semantic token bridge", () => {
  test("default schemes, a named variation, and a live edit preserve highlighted DOM", async ({
    page,
  }) => {
    await preseedLightTheme(page);
    await page.goto(PAGE, { waitUntil: "load" });

    const pre = page.locator(PRE_SELECTOR).first();
    const token = page.locator(TOKEN_SELECTOR).first();
    await expect(pre).toHaveAttribute("data-enhanced", "true");
    await expect(token).toBeVisible();
    await expect(
      page.locator(DESKTOP_TOGGLE_SELECTOR),
    ).toHaveAttribute("aria-label", "Switch to dark mode");

    const before = await startHighlightedDomGuard(page);
    expect(before.theme).toBe("light");
    expect(before.colorScheme).toBe("light");
    expect(before.tokenColor).toBe(before.semanticColor);
    expect(before.tokenColor).toBe(before.defaultLightColor);
    expect(before.preInlineStyle).toBeNull();
    expect(before.tokenInlineStyle).toBeNull();

    await page.locator(DESKTOP_TOGGLE_SELECTOR).click();
    await waitForThemeSyntaxBridge(page, "dark");

    const namedVariation = await readHighlightedDomGuard(page, false);
    expect(namedVariation.theme).toBe("dark");
    expect(namedVariation.colorScheme).toBe("dark");
    expect(namedVariation.tokenColor).toBe(namedVariation.semanticColor);
    expect(namedVariation.tokenColor).toBe(namedVariation.namedVariationColor);
    expect(namedVariation.tokenColor).not.toBe(before.tokenColor);
    expect(namedVariation.samePreNode).toBe(true);
    expect(namedVariation.sameTokenNode).toBe(true);
    expect(namedVariation.sameInnerHTML).toBe(true);
    expect(namedVariation.sameTokenClass).toBe(true);
    expect(namedVariation.mutationCount).toBe(0);

    await page.locator(PANEL_TRIGGER).click();
    await expect(page.locator(PANEL_SHELL)).toBeVisible();
    await page.getByRole("tab", { name: "Color", exact: true }).click();

    const keywordRow = page.getByTestId(
      "tokenpanel-semantic-ref-syntaxKeyword",
    );
    const keywordSelect = keywordRow.getByLabel(
      "--zd-syntax-keyword tier reference",
      { exact: true },
    );
    await expect(keywordSelect).toBeVisible();

    const currentValue = await keywordSelect.inputValue();
    const nextAccentValue = await keywordSelect
      .locator('optgroup[label="Accent"] option')
      .evaluateAll((options, selectedValue) => {
        const candidate = options.find(
          (option) =>
            (option as HTMLOptionElement).value !== selectedValue,
        ) as HTMLOptionElement | undefined;
        return candidate?.value ?? null;
      }, currentValue);
    if (nextAccentValue === null) {
      throw new Error("syntaxKeyword has no alternate Accent ramp option");
    }

    expect(nextAccentValue).not.toBe(currentValue);
    await keywordSelect.selectOption(nextAccentValue);
    await expect(keywordSelect.locator("option:checked")).toContainText(
      "--palette-accent-",
    );

    await page.waitForFunction(
      ({ tokenSelector, previousColor }) => {
        const currentToken = document.querySelector(tokenSelector);
        return (
          currentToken !== null &&
          getComputedStyle(currentToken).color !== previousColor
        );
      },
      {
        tokenSelector: TOKEN_SELECTOR,
        previousColor: namedVariation.tokenColor,
      },
    );

    const edited = await readHighlightedDomGuard(page, false);
    expect(edited.tokenColor).not.toBe(namedVariation.tokenColor);
    expect(edited.tokenColor).toBe(edited.semanticColor);
    expect(edited.samePreNode).toBe(true);
    expect(edited.sameTokenNode).toBe(true);
    expect(edited.sameInnerHTML).toBe(true);
    expect(edited.sameTokenClass).toBe(true);
    expect(edited.mutationCount).toBe(0);

    await page.locator(DESKTOP_TOGGLE_SELECTOR).click();
    await waitForThemeSyntaxBridge(page, "light");

    const lightAfterEdit = await readHighlightedDomGuard(page, true);
    expect(lightAfterEdit.theme).toBe("light");
    expect(lightAfterEdit.colorScheme).toBe("light");
    expect(lightAfterEdit.tokenColor).toBe(lightAfterEdit.semanticColor);
    expect(lightAfterEdit.samePreNode).toBe(true);
    expect(lightAfterEdit.sameTokenNode).toBe(true);
    expect(lightAfterEdit.sameInnerHTML).toBe(true);
    expect(lightAfterEdit.sameTokenClass).toBe(true);
    expect(lightAfterEdit.mutationCount).toBe(0);
  });
});
