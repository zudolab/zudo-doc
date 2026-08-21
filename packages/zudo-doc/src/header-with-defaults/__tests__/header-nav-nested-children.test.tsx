/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { Window } from "happy-dom";
import { createHeaderWithDefaults } from "../index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";
import type { ChromeContext } from "../../factory-context/index.js";

function realNavHref(
  path: string,
  lang: string | undefined,
  currentVersion: string | undefined,
  versioned = true,
): string {
  const isNonDefaultLocale = lang != null && lang !== "en";
  const versionPrefix = versioned && currentVersion ? `/v/${currentVersion}` : "";
  return isNonDefaultLocale ? `${versionPrefix}/${lang}${path}` : `${versionPrefix}${path}`;
}

describe("HeaderWithDefaults — nested dropdown children", () => {
  function render_(lang: string, currentPath: string, currentVersion?: string): string {
    const ctx = makeFakeChromeContext({
      settings: {
        headerNav: [
          {
            label: "Changelog",
            path: "/docs/changelog",
            categoryMatch: "changelog",
            children: [
              { label: "Package A", path: "/docs/changelog/pkg-a" },
              { label: "Package B", path: "/docs/changelog/pkg-b" },
            ],
          },
        ],
        locales: { ja: {} },
        versions: [{ slug: "1.0" }],
      },
      overrides: {
        locales: ["en", "ja"],
        navHref: realNavHref,
      } as Partial<ChromeContext>,
    });
    const HeaderWithDefaults = createHeaderWithDefaults(ctx);
    return render(<HeaderWithDefaults lang={lang} currentPath={currentPath} currentVersion={currentVersion} />);
  }

  it.each([
    ["latest default-locale", "en", "/docs/changelog/pkg-a/1.0.0", undefined],
    ["versioned default-locale", "en", "/v/1.0/docs/changelog/pkg-a/1.0.0", "1.0"],
    ["versioned secondary-locale", "ja", "/v/1.0/ja/docs/changelog/pkg-a/1.0.0", "1.0"],
  ])("marks one child and the parent active for %s", (_name, lang, currentPath, currentVersion) => {
    const html = render_(lang, currentPath, currentVersion);
    const window = new Window();
    const root = window.document.createElement("div");
    root.innerHTML = html;

    const parent = root.querySelector("[data-nav-item-dropdown] > a");
    expect(parent?.getAttribute("aria-current")).toBe("page");
    expect(root.querySelectorAll('a[data-active=""]').length).toBe(1);
    expect(root.querySelector('a[href*="pkg-a"]')?.getAttribute("data-active")).toBe("");
    expect(root.querySelector('a[href*="pkg-b"]')?.hasAttribute("data-active")).toBe(false);
  });
});
