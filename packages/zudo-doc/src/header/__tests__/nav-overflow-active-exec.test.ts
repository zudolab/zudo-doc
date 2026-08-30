/** @vitest-environment happy-dom */
// Executes the generated NAV_OVERFLOW_SCRIPT in a real DOM (zudolab/zudo-doc#3398),
// rather than only asserting its string contents (nav-class-tokens.test.ts
// covers that). Proves the consolidated matching core — embedded from
// nav-active.ts via `computeActiveNavPath.toString()` / `pathMatchesNavPath.toString()`,
// replacing the script's former hand-duplicated longest-match walk — still
// produces the correct aria-current / active-class output end-to-end, and
// that the explicit current-route override
// (`document.documentElement.dataset.zdCurrentPath`) takes priority over
// `location.pathname`.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NAV_OVERFLOW_SCRIPT } from "../nav-overflow-script.js";
import {
  NAV_MORE_ACTIVE,
  NAV_MORE_INACTIVE,
  NAV_TOP_ACTIVE,
} from "../nav-class-tokens.js";
import { CURRENT_PATH_DATASET_KEY } from "../../current-path/index.js";

let originalOffsetWidth: PropertyDescriptor | undefined;
let originalClientWidth: PropertyDescriptor | undefined;
let originalDocumentFonts: PropertyDescriptor | undefined;
let originalResizeObserver: PropertyDescriptor | undefined;
let resizeCallbacks: ResizeObserverCallback[] = [];

beforeEach(() => {
  originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
  originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  originalDocumentFonts = Object.getOwnPropertyDescriptor(document, "fonts");
  originalResizeObserver = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
  resizeCallbacks = [];

  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get() {
      return Number((this as HTMLElement).dataset.testWidth ?? "0");
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get() {
      return Number((this as HTMLElement).dataset.testClientWidth ?? "0");
    },
  });
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: new Promise<void>(() => undefined) },
  });

  class CapturingResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      resizeCallbacks.push(callback);
    }

    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: CapturingResizeObserver,
  });
});

function setLocation(pathname: string): void {
  (window as unknown as { happyDOM?: { setURL: (url: string) => void } }).happyDOM?.setURL(
    `http://localhost${pathname}`,
  );
}

function buildNav(): HTMLElement {
  const nav = document.createElement("nav");
  nav.setAttribute("data-header-nav", "");
  nav.innerHTML = `
    <a data-nav-item href="/docs/">Docs</a>
    <div data-nav-item data-nav-item-dropdown>
      <a href="/learn/">Learn</a>
      <div>
        <a href="/learn/getting-started/">Getting Started</a>
        <a href="/learn/advanced/">Advanced</a>
      </div>
    </div>
    <a data-nav-item href="/blog/">Blog</a>
  `;
  document.body.appendChild(nav);
  return nav;
}

function buildNestedChangelogNav(): HTMLElement {
  const nav = document.createElement("nav");
  nav.setAttribute("data-header-nav", "");
  nav.innerHTML = `
    <div data-nav-item data-nav-item-dropdown>
      <a href="/docs/changelog">Changelog</a>
      <div>
        <a href="/docs/changelog/pkg-a">Package A</a>
        <a href="/docs/changelog/pkg-b">Package B</a>
      </div>
    </div>
  `;
  document.body.appendChild(nav);
  return nav;
}

interface OverflowControls {
  container: HTMLElement;
  menu: HTMLUListElement;
  toggle: HTMLButtonElement;
}

function appendOverflowControls(
  nav: HTMLElement,
  clientWidth: number,
  itemWidths: readonly number[] = [100, 100, 100],
): OverflowControls {
  nav.dataset.testClientWidth = String(clientWidth);
  Array.from(nav.querySelectorAll<HTMLElement>(":scope > [data-nav-item]")).forEach(
    (item, index) => {
      item.dataset.testWidth = String(itemWidths[index] ?? 100);
    },
  );

  const container = document.createElement("div");
  container.dataset.navMore = "";
  container.dataset.testWidth = "40";
  container.style.display = "none";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.dataset.navMoreToggle = "";
  toggle.setAttribute("aria-expanded", "false");
  toggle.className = [
    ...NAV_MORE_INACTIVE,
    "hover:underline",
    "focus-visible:underline",
  ].join(" ");

  const menu = document.createElement("ul");
  menu.dataset.navMoreMenu = "";
  menu.className = "hidden";

  container.append(toggle, menu);
  nav.appendChild(container);
  return { container, menu, toggle };
}

function findMenuLink(menu: HTMLElement, pathname: string): HTMLAnchorElement | undefined {
  return Array.from(menu.querySelectorAll<HTMLAnchorElement>("a")).find(
    (link) => new URL(link.href).pathname === pathname,
  );
}

function expectMoreToggleState(toggle: HTMLElement, active: boolean): void {
  for (const token of NAV_MORE_ACTIVE) {
    expect(toggle.classList.contains(token)).toBe(active);
  }
  for (const token of NAV_MORE_INACTIVE) {
    expect(toggle.classList.contains(token)).toBe(!active);
  }
  expect(toggle.classList.contains("hover:underline")).toBe(true);
  expect(toggle.classList.contains("focus-visible:underline")).toBe(true);
  expect(toggle.hasAttribute("aria-current")).toBe(false);
}

describe("NAV_OVERFLOW_SCRIPT — executed in jsdom (applyActiveNav)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    delete document.documentElement.dataset[CURRENT_PATH_DATASET_KEY];

    if (originalOffsetWidth) {
      Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalOffsetWidth);
    } else {
      delete (HTMLElement.prototype as unknown as { offsetWidth?: number }).offsetWidth;
    }
    if (originalClientWidth) {
      Object.defineProperty(HTMLElement.prototype, "clientWidth", originalClientWidth);
    } else {
      delete (HTMLElement.prototype as unknown as { clientWidth?: number }).clientWidth;
    }
    if (originalDocumentFonts) {
      Object.defineProperty(document, "fonts", originalDocumentFonts);
    } else {
      delete (document as unknown as { fonts?: unknown }).fonts;
    }
    if (originalResizeObserver) {
      Object.defineProperty(globalThis, "ResizeObserver", originalResizeObserver);
    } else {
      delete (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver;
    }
  });

  it("marks the matching top-level item active from location.pathname", () => {
    setLocation("/docs/introduction");
    const nav = buildNav();

    new Function(NAV_OVERFLOW_SCRIPT)();

    const docsLink = nav.querySelector('a[href="/docs/"]');
    const blogLink = nav.querySelector('a[href="/blog/"]');
    expect(docsLink?.getAttribute("aria-current")).toBe("page");
    expect(docsLink?.className).toContain(NAV_TOP_ACTIVE.join(" "));
    expect(blogLink?.getAttribute("aria-current")).toBeNull();
  });

  it("marks the matching dropdown child active and the parent as active-by-child", () => {
    setLocation("/learn/getting-started/setup");
    const nav = buildNav();

    new Function(NAV_OVERFLOW_SCRIPT)();

    const learnLink = nav.querySelector('a[href="/learn/"]');
    const activeChild = nav.querySelector('a[href="/learn/getting-started/"]');
    const inactiveChild = nav.querySelector('a[href="/learn/advanced/"]');
    expect(learnLink?.getAttribute("aria-current")).toBe("page");
    expect(activeChild?.getAttribute("data-active")).toBe("");
    expect(inactiveChild?.hasAttribute("data-active")).toBe(false);
  });

  it("marks exactly one sibling-prefix changelog child active", () => {
    setLocation("/docs/changelog/pkg-a/1.0.0");
    const nav = buildNestedChangelogNav();

    new Function(NAV_OVERFLOW_SCRIPT)();

    expect(nav.querySelector('a[href="/docs/changelog"]')?.getAttribute("aria-current")).toBe(
      "page",
    );
    expect(nav.querySelectorAll('a[data-active=""]').length).toBe(1);
    expect(nav.querySelector('a[href="/docs/changelog/pkg-a"]')?.getAttribute("data-active")).toBe(
      "",
    );
    expect(nav.querySelector('a[href="/docs/changelog/pkg-b"]')?.hasAttribute("data-active")).toBe(
      false,
    );
  });

  it("prefers document.documentElement.dataset.zdCurrentPath over location.pathname", () => {
    setLocation("/blog/post-1");
    document.documentElement.dataset[CURRENT_PATH_DATASET_KEY] = "/docs/introduction";
    const nav = buildNav();

    new Function(NAV_OVERFLOW_SCRIPT)();

    const docsLink = nav.querySelector('a[href="/docs/"]');
    const blogLink = nav.querySelector('a[href="/blog/"]');
    expect(docsLink?.getAttribute("aria-current")).toBe("page");
    expect(blogLink?.getAttribute("aria-current")).toBeNull();
  });

  it("clears every active marker when the current path matches no nav entry", () => {
    setLocation("/about/");
    const nav = buildNav();

    new Function(NAV_OVERFLOW_SCRIPT)();

    expect(nav.querySelector('a[aria-current="page"]')).toBeNull();
  });

  it("transfers a collapsed plain current item to the toggle and visible clone", () => {
    setLocation("/blog/post-1");
    const nav = buildNav();
    const { menu, toggle } = appendOverflowControls(nav, 250);

    new Function(NAV_OVERFLOW_SCRIPT)();

    expectMoreToggleState(toggle, true);
    const blogClone = findMenuLink(menu, "/blog/");
    expect(blogClone?.getAttribute("aria-current")).toBe("page");
    expect(menu.querySelectorAll('a[aria-current="page"]')).toHaveLength(1);

    toggle.click();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(menu.classList.contains("hidden")).toBe(false);
    toggle.click();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("marks a collapsed dropdown parent route as the sole current clone", () => {
    setLocation("/learn/");
    const nav = buildNav();
    const { menu, toggle } = appendOverflowControls(nav, 150);

    new Function(NAV_OVERFLOW_SCRIPT)();

    expectMoreToggleState(toggle, true);
    expect(findMenuLink(menu, "/learn/")?.getAttribute("aria-current")).toBe("page");
    expect(findMenuLink(menu, "/learn/getting-started/")?.hasAttribute("aria-current")).toBe(
      false,
    );
    expect(menu.querySelectorAll('a[aria-current="page"]')).toHaveLength(1);
  });

  it("marks the deepest collapsed dropdown child as the sole current clone", () => {
    setLocation("/learn/getting-started/setup");
    const nav = buildNav();
    const { menu, toggle } = appendOverflowControls(nav, 150);

    new Function(NAV_OVERFLOW_SCRIPT)();

    expectMoreToggleState(toggle, true);
    const parentClone = findMenuLink(menu, "/learn/");
    const childClone = findMenuLink(menu, "/learn/getting-started/");
    expect(parentClone?.classList.contains("text-accent")).toBe(true);
    expect(parentClone?.hasAttribute("aria-current")).toBe(false);
    expect(childClone?.getAttribute("aria-current")).toBe("page");
    expect(menu.querySelectorAll('a[aria-current="page"]')).toHaveLength(1);
  });

  it("keeps the toggle inactive when only inactive entries collapse", () => {
    setLocation("/docs/introduction");
    const nav = buildNav();
    const { menu, toggle } = appendOverflowControls(nav, 250);

    new Function(NAV_OVERFLOW_SCRIPT)();

    expectMoreToggleState(toggle, false);
    expect(findMenuLink(menu, "/blog/")?.hasAttribute("aria-current")).toBe(false);
    expect(menu.querySelectorAll('a[aria-current="page"]')).toHaveLength(0);
  });

  it("clears transferred state when overflow disappears or nav is unmeasurable", () => {
    setLocation("/blog/post-1");
    const nav = buildNav();
    const { container, toggle } = appendOverflowControls(nav, 250);

    new Function(NAV_OVERFLOW_SCRIPT)();
    expectMoreToggleState(toggle, true);

    toggle.click();
    const resize = resizeCallbacks[resizeCallbacks.length - 1];
    expect(resize).toBeDefined();

    nav.dataset.testClientWidth = "400";
    resize?.([], {} as ResizeObserver);

    expectMoreToggleState(toggle, false);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(container.style.display).toBe("none");

    nav.dataset.testClientWidth = "250";
    resize?.([], {} as ResizeObserver);
    expectMoreToggleState(toggle, true);

    nav.dataset.testClientWidth = "0";
    resize?.([], {} as ResizeObserver);

    expectMoreToggleState(toggle, false);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(container.style.display).toBe("none");
  });
});
