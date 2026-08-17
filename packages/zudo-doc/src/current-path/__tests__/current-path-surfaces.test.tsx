/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Cross-surface proof that ONE dataset key drives every current-route reader
// (zudolab/zudo-doc#3408). Each of the four surfaces is exercised through
// `document.documentElement.dataset[CURRENT_PATH_DATASET_KEY]` — never a
// hand-written "zdCurrentPath" literal — so renaming the constant either moves
// all four together or fails here. Two of the surfaces are string-embedded
// client scripts, which is exactly where a literal could rot unnoticed: they
// are executed, not string-matched.

import { afterEach, describe, expect, it } from "vitest";
import { render } from "preact";
import { act } from "preact/test-utils";
import { CURRENT_PATH_DATASET_KEY, CURRENT_PATH_SCRIPT_PRELUDE, readCurrentPath } from "../index.js";
import { NAV_OVERFLOW_SCRIPT } from "../../header/nav-overflow-script.js";
import { LANGUAGE_SWITCHER_INIT_SCRIPT } from "../../i18n-version/language-switcher.js";
import { VERSION_SWITCHER_REWIRE_SCRIPT } from "../../i18n-version/version-switcher.js";
import { SidebarTree } from "../../sidebar-tree-island/index.js";
import type { SidebarNavNode } from "../../sidebar/types.js";

function setLocation(pathname: string): void {
  (window as unknown as { happyDOM?: { setURL: (url: string) => void } }).happyDOM?.setURL(
    `http://localhost${pathname}`,
  );
}

function setOverride(pathname: string): void {
  document.documentElement.dataset[CURRENT_PATH_DATASET_KEY] = pathname;
}

let mounted: HTMLDivElement | null = null;

function mountSidebar(nodes: SidebarNavNode[]): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    render(<SidebarTree nodes={nodes} />, container);
  });
  mounted = container;
  return container;
}

afterEach(() => {
  if (mounted) {
    act(() => {
      render(null, mounted!);
    });
    mounted = null;
  }
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

  it("is spliced into all three string-embedded client scripts", () => {
    for (const script of [
      NAV_OVERFLOW_SCRIPT,
      LANGUAGE_SWITCHER_INIT_SCRIPT,
      VERSION_SWITCHER_REWIRE_SCRIPT,
    ]) {
      expect(script).toContain(CURRENT_PATH_SCRIPT_PRELUDE);
    }
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

  it("derives the active slug from the dataset override", () => {
    setLocation("/docs/advanced");
    setOverride("/docs/introduction");

    const container = mountSidebar(nodes);

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
