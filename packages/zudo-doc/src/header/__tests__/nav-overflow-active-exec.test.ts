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

import { afterEach, describe, expect, it } from "vitest";
import { NAV_OVERFLOW_SCRIPT } from "../nav-overflow-script.js";
import { NAV_TOP_ACTIVE } from "../nav-class-tokens.js";
import { CURRENT_PATH_DATASET_KEY } from "../../current-path/index.js";

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

describe("NAV_OVERFLOW_SCRIPT — executed in jsdom (applyActiveNav)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    delete document.documentElement.dataset[CURRENT_PATH_DATASET_KEY];
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
});
