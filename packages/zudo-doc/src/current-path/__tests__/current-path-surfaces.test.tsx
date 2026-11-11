/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
// Cross-surface proof that ONE dataset key drives every current-route reader
// (zudolab/zudo-doc#3408). Each of the four surfaces is exercised through
// `document.documentElement.dataset[CURRENT_PATH_DATASET_KEY]` — never a
// hand-written "zdCurrentPath" literal — so renaming the constant either moves
// all four together or fails here. Two of the surfaces are string-embedded
// client scripts, which is exactly where a literal could rot unnoticed: they
// are executed, not string-matched.

import { afterEach, describe, expect, it } from "vitest";
import { Window } from "happy-dom";
import { renderIsland } from "../../__tests__/helpers/zudo-react.js";
import { CURRENT_PATH_DATASET_KEY, CURRENT_PATH_SCRIPT_PRELUDE, readCurrentPath } from "../index.js";
import { NAV_OVERFLOW_SCRIPT } from "../../header/nav-overflow-script.js";
import { LANGUAGE_SWITCHER_INIT_SCRIPT } from "../../i18n-version/language-switcher.js";
import { VERSION_SWITCHER_REWIRE_SCRIPT } from "../../i18n-version/version-switcher.js";
import { SidebarTree } from "../../sidebar-tree-island/index.js";
import type { SidebarNavNode } from "../../sidebar/types.js";
import { AFTER_NAVIGATE_EVENT } from "../../transitions/page-events.js";

function setLocation(pathname: string): void {
  (window as unknown as { happyDOM?: { setURL: (url: string) => void } }).happyDOM?.setURL(
    `http://localhost${pathname}`,
  );
}

function setOverride(pathname: string): void {
  document.documentElement.dataset[CURRENT_PATH_DATASET_KEY] = pathname;
}

let disposeSidebar: (() => void) | null = null;
async function mountSidebar(nodes: SidebarNavNode[]): Promise<HTMLDivElement> {
  const view = await renderIsland(SidebarTree, { nodes }, {
    identity: { component: "SidebarTree", build: "4464-current-path-test" },
  });
  disposeSidebar = view.dispose;
  return view.container as HTMLDivElement;
}

afterEach(() => {
  disposeSidebar?.();
  disposeSidebar = null;
  document.body.innerHTML = "";
  delete document.documentElement.dataset[CURRENT_PATH_DATASET_KEY];
});

describe("readCurrentPath", () => {
  it("prefers the explicit argument over the dataset override and location", () => {
    setLocation("/from-location");
    setOverride("/from-dataset");
    expect(readCurrentPath(CURRENT_PATH_DATASET_KEY, "/explicit")).toBe("/explicit");
  });

  it("prefers the dataset override over location.pathname", () => {
    setLocation("/from-location");
    setOverride("/from-dataset");
    expect(readCurrentPath(CURRENT_PATH_DATASET_KEY)).toBe("/from-dataset");
  });

  it("falls through empty strings at every step", () => {
    setLocation("/from-location");
    setOverride("");
    expect(readCurrentPath(CURRENT_PATH_DATASET_KEY, "")).toBe("/from-location");
  });

  it("falls back to location.pathname when no override is set", () => {
    setLocation("/from-location");
    expect(readCurrentPath(CURRENT_PATH_DATASET_KEY)).toBe("/from-location");
  });
});

describe("CURRENT_PATH_SCRIPT_PRELUDE", () => {
  it("carries the key as a literal so embedded scripts need no closure", () => {
    expect(CURRENT_PATH_SCRIPT_PRELUDE).toContain(JSON.stringify(CURRENT_PATH_DATASET_KEY));
    expect(new Function(`${CURRENT_PATH_SCRIPT_PRELUDE}return CURRENT_PATH_DATASET_KEY;`)()).toBe(
      CURRENT_PATH_DATASET_KEY,
    );
  });

});

describe("frozen switcher scripts", () => {
  // Each scenario gets its own window. Deleting a guard flag on a shared
  // window leaves the previous document listeners in place, and the version
  // script's rewire is idempotent, so a later assertion can pass with two
  // listeners. That is not isolation.
  const windows: Window[] = [];

  function open(pathname: string): Window {
    const win = new Window({ url: `http://localhost${pathname}` });
    windows.push(win);
    return win;
  }

  afterEach(async () => {
    await Promise.all(windows.splice(0).map((win) => win.happyDOM.abort()));
  });

  function languageHtml(base: string, trailingSlash: boolean, locale: string): string {
    return `<div data-language-switcher data-base="${base}" data-default-locale="en" data-trailing-slash="${trailingSlash}" data-current-locale="${locale}"><button type="button" data-language-toggle aria-expanded="false">Lang</button><ul data-language-menu class="hidden"><a lang="en" href="/stale">EN</a><a lang="ja" href="/stale">JA</a></ul></div>`;
  }

  function versionHtml(base: string, trailingSlash: boolean, locale: string): string {
    return `<article data-doc-unavailable-versions=""></article><div data-version-rewire data-base="${base}" data-default-locale="en" data-trailing-slash="${trailingSlash}" data-current-locale="${locale}" data-unavailable-label="Not available"><a data-version-latest href="/stale">Latest</a><a data-version-slug="1-0" href="/stale">1.0</a></div>`;
  }

  function href(win: Window, selector: string): string | null {
    return win.document.querySelector(selector)?.getAttribute("href") ?? null;
  }

  function active(win: Window, selector: string): string | null {
    return win.document.querySelector(selector)?.getAttribute("aria-current") ?? null;
  }

  function clickToggle(win: Window): string | null {
    const toggle = win.document.querySelector("[data-language-toggle]") as { click: () => void } | null;
    toggle?.click();
    return win.document.querySelector("[data-language-toggle]")?.getAttribute("aria-expanded") ?? null;
  }

  function countNavigationListeners(win: Window): { readonly count: number } {
    const seen = { count: 0 };
    const documentAdd = win.document.addEventListener.bind(win.document) as (
      type: string,
      listener: unknown,
      options?: unknown,
    ) => void;
    win.document.addEventListener = ((type: string, listener: unknown, options?: unknown) => {
      if (type === AFTER_NAVIGATE_EVENT) seen.count += 1;
      documentAdd(type, listener, options);
    }) as unknown as typeof win.document.addEventListener;
    return seen;
  }

  it("prefers the dataset route over location and falls back when the dataset is missing or empty", () => {
    const languageOverride = open("/ja/docs/from-location");
    languageOverride.document.body.innerHTML = languageHtml("", false, "ja");
    languageOverride.document.documentElement.dataset.zdCurrentPath = "/ja/docs/from-dataset";
    languageOverride.eval(LANGUAGE_SWITCHER_INIT_SCRIPT);
    expect(href(languageOverride, 'a[lang="en"]')).toBe("/docs/from-dataset");
    expect(href(languageOverride, 'a[lang="ja"]')).toBe("/ja/docs/from-dataset");

    for (const dataset of ["missing", "empty"] as const) {
      const win = open("/ja/docs/from-location");
      win.document.body.innerHTML = languageHtml("", false, "ja");
      if (dataset === "empty") win.document.documentElement.setAttribute("data-zd-current-path", "");
      win.eval(LANGUAGE_SWITCHER_INIT_SCRIPT);
      expect(href(win, 'a[lang="en"]')).toBe("/docs/from-location");
      expect(href(win, 'a[lang="ja"]')).toBe("/ja/docs/from-location");
    }

    const versionOverride = open("/docs/from-location");
    versionOverride.document.body.innerHTML = versionHtml("", false, "en");
    versionOverride.document.documentElement.dataset.zdCurrentPath = "/v/1-0/docs/from-dataset";
    versionOverride.eval(VERSION_SWITCHER_REWIRE_SCRIPT);
    expect(href(versionOverride, "[data-version-latest]")).toBe("/docs/from-dataset");
    expect(href(versionOverride, '[data-version-slug="1-0"]')).toBe("/v/1-0/docs/from-dataset");
    expect(active(versionOverride, "[data-version-latest]")).toBeNull();
    expect(active(versionOverride, '[data-version-slug="1-0"]')).toBe("page");

    for (const dataset of ["missing", "empty"] as const) {
      const win = open("/docs/from-location");
      win.document.body.innerHTML = versionHtml("", false, "en");
      if (dataset === "empty") win.document.documentElement.setAttribute("data-zd-current-path", "");
      win.eval(VERSION_SWITCHER_REWIRE_SCRIPT);
      expect(href(win, "[data-version-latest]")).toBe("/docs/from-location");
      expect(href(win, '[data-version-slug="1-0"]')).toBe("/v/1-0/docs/from-location");
      expect(active(win, "[data-version-latest]")).toBe("page");
      expect(active(win, '[data-version-slug="1-0"]')).toBeNull();
    }
  });

  it("rewires hrefs and active state after the canonical navigation event", () => {
    const language = open("/ja/docs/first");
    language.document.body.innerHTML = languageHtml("", false, "ja");
    language.eval(LANGUAGE_SWITCHER_INIT_SCRIPT);
    language.happyDOM.setURL("http://localhost/ja/docs/second");
    language.document.dispatchEvent(new language.Event(AFTER_NAVIGATE_EVENT));
    expect(href(language, 'a[lang="en"]')).toBe("/docs/second");
    expect(href(language, 'a[lang="ja"]')).toBe("/ja/docs/second");

    const version = open("/docs/introduction");
    version.document.body.innerHTML = versionHtml("", false, "en");
    version.eval(VERSION_SWITCHER_REWIRE_SCRIPT);
    expect(active(version, "[data-version-latest]")).toBe("page");
    version.happyDOM.setURL("http://localhost/v/1-0/docs/guides");
    version.document.dispatchEvent(new version.Event(AFTER_NAVIGATE_EVENT));
    expect(href(version, "[data-version-latest]")).toBe("/docs/guides");
    expect(href(version, '[data-version-slug="1-0"]')).toBe("/v/1-0/docs/guides");
    expect(active(version, "[data-version-latest]")).toBeNull();
    expect(active(version, '[data-version-slug="1-0"]')).toBe("page");
  });

  it("keeps root, nonempty-base, locale, and trailing-slash routes on the frozen scripts", () => {
    const language = open("/manual/ja/docs/next/");
    language.document.body.innerHTML = languageHtml("/manual", true, "ja");
    language.eval(LANGUAGE_SWITCHER_INIT_SCRIPT);
    expect(href(language, 'a[lang="en"]')).toBe("/manual/docs/next/");
    expect(href(language, 'a[lang="ja"]')).toBe("/manual/ja/docs/next/");

    const version = open("/manual/ja/docs/next/");
    version.document.body.innerHTML = versionHtml("/manual", true, "ja");
    version.eval(VERSION_SWITCHER_REWIRE_SCRIPT);
    expect(href(version, "[data-version-latest]")).toBe("/manual/ja/docs/next/");
    expect(href(version, '[data-version-slug="1-0"]')).toBe("/manual/v/1-0/ja/docs/next/");
    expect(active(version, "[data-version-latest]")).toBe("page");
  });

  it("does not register a second listener when initialization is repeated", () => {
    const language = open("/ja/docs/first");
    language.document.body.innerHTML = languageHtml("", false, "ja");
    language.eval(LANGUAGE_SWITCHER_INIT_SCRIPT);
    language.eval(LANGUAGE_SWITCHER_INIT_SCRIPT);
    expect(clickToggle(language)).toBe("true");

    const version = open("/docs/introduction");
    const swapListeners = countNavigationListeners(version);
    version.document.body.innerHTML = versionHtml("", false, "en");
    version.eval(VERSION_SWITCHER_REWIRE_SCRIPT);
    version.eval(VERSION_SWITCHER_REWIRE_SCRIPT);
    expect(swapListeners.count).toBe(1);
  });

  it("still has the previous listener after the guard flag alone is cleared", () => {
    const language = open("/ja/docs/first");
    language.document.body.innerHTML = languageHtml("", false, "ja");
    language.eval(LANGUAGE_SWITCHER_INIT_SCRIPT);
    language.eval("delete window.__zdLanguageSwitcherInit");
    language.eval(LANGUAGE_SWITCHER_INIT_SCRIPT);
    expect(clickToggle(language)).toBe("false");

    const version = open("/docs/introduction");
    const swapListeners = countNavigationListeners(version);
    version.document.body.innerHTML = versionHtml("", false, "en");
    version.eval(VERSION_SWITCHER_REWIRE_SCRIPT);
    version.eval("delete window.__zdVersionSwitcherRewire");
    version.eval(VERSION_SWITCHER_REWIRE_SCRIPT);
    expect(swapListeners.count).toBe(2);
  });
});

describe("SidebarTree island reads the shared dataset key", () => {
  const nodes: SidebarNavNode[] = [
    {
      slug: "introduction",
      label: "Introduction",
      position: 0,
      href: "/docs/introduction",
      hasPage: true,
      children: [],
    },
    {
      slug: "advanced",
      label: "Advanced",
      position: 1,
      href: "/docs/advanced",
      hasPage: true,
      children: [],
    },
  ];

  it("derives the active slug from the dataset override", async () => {
    setLocation("/docs/advanced");
    setOverride("/docs/introduction");

    const container = await mountSidebar(nodes);

    expect(container.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe(
      "/docs/introduction",
    );
  });
});

describe("NAV_OVERFLOW_SCRIPT reads the shared dataset key", () => {
  it("highlights the nav item matching the dataset override", () => {
    setLocation("/blog/post-1");
    setOverride("/docs/introduction");
    const nav = document.createElement("nav");
    nav.setAttribute("data-header-nav", "");
    nav.innerHTML = `
      <a data-nav-item href="/docs/">Docs</a>
      <a data-nav-item href="/blog/">Blog</a>
    `;
    document.body.appendChild(nav);

    new Function(NAV_OVERFLOW_SCRIPT)();

    expect(nav.querySelector('a[href="/docs/"]')?.getAttribute("aria-current")).toBe("page");
    expect(nav.querySelector('a[href="/blog/"]')?.getAttribute("aria-current")).toBeNull();
  });
});

describe("LANGUAGE_SWITCHER_INIT_SCRIPT reads the shared dataset key", () => {
  it("rewrites locale hrefs from the dataset override", () => {
    setLocation("/ja/docs/unrelated");
    setOverride("/ja/docs/introduction");
    const container = document.createElement("div");
    container.setAttribute("data-language-switcher", "");
    container.setAttribute("data-base", "");
    container.setAttribute("data-default-locale", "en");
    container.setAttribute("data-trailing-slash", "false");
    container.setAttribute("data-current-locale", "ja");
    container.innerHTML = `<a lang="en" href="#">EN</a><a lang="ja" href="#">JA</a>`;
    document.body.appendChild(container);

    new Function(LANGUAGE_SWITCHER_INIT_SCRIPT)();

    expect(container.querySelector('a[lang="en"]')?.getAttribute("href")).toBe(
      "/docs/introduction",
    );
    expect(container.querySelector('a[lang="ja"]')?.getAttribute("href")).toBe(
      "/ja/docs/introduction",
    );
  });
});

describe("VERSION_SWITCHER_REWIRE_SCRIPT reads the shared dataset key", () => {
  it("resolves the active version from the dataset override", () => {
    setLocation("/docs/introduction");
    setOverride("/v/1-0/docs/introduction");
    const container = document.createElement("div");
    container.setAttribute("data-version-rewire", "");
    container.setAttribute("data-base", "");
    container.setAttribute("data-default-locale", "en");
    container.setAttribute("data-trailing-slash", "false");
    container.setAttribute("data-current-locale", "en");
    container.innerHTML = `
      <a data-version-latest href="#">Latest</a>
      <a data-version-slug="1-0" href="#">1.0</a>
    `;
    document.body.appendChild(container);

    new Function(VERSION_SWITCHER_REWIRE_SCRIPT)();

    expect(container.querySelector('[data-version-slug="1-0"]')?.getAttribute("aria-current")).toBe(
      "page",
    );
    expect(container.querySelector("[data-version-latest]")?.getAttribute("aria-current")).toBeNull();
  });
});
