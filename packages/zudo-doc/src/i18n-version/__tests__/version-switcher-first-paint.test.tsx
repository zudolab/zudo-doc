/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// Regression guard for the first-paint clobber bug found while arming the
// #3245 e2e guard: `VERSION_SWITCHER_REWIRE_SCRIPT` is inline in <header>,
// which parses before <article> in document order. Its unconditional
// `rewire()` call at script-evaluation time therefore used to run BEFORE the
// article (carrying `UNAVAILABLE_VERSIONS_ATTR`) exists in the DOM, so
// `document.querySelector("["+ATTR+"]")` returned null and every SSR-disabled
// entry was read as "no unavailable slugs" and re-enabled into a live link to
// a page that 404s. This mirrors `version-switcher-rewire-disabled.test.tsx`
// (same script, same anchor-property assertions) but drives the REAL
// first-paint ordering — article absent + `document.readyState === "loading"`
// at script-eval time — instead of `simulateSwap`'s already-parsed setup.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import {
  VersionSwitcher,
  VERSION_SWITCHER_REWIRE_SCRIPT,
  type VersionSwitcherRewireConfig,
} from "../version-switcher.js";
import type { VersionEntry, VersionSwitcherLabels } from "../types.js";
import { UNAVAILABLE_VERSIONS_ATTR } from "../../version-availability/index.js";
import { AFTER_NAVIGATE_EVENT } from "../../transitions/page-events.js";

const labels: VersionSwitcherLabels = {
  latest: "Latest",
  switcher: "Version",
  unavailable: "Not available",
  allVersions: "All versions",
};

const versions: VersionEntry[] = [
  { slug: "v1", label: "v1.x" },
  { slug: "v2", label: "v2.0" },
];

const rewireConfig: VersionSwitcherRewireConfig = {
  base: "",
  defaultLocale: "en",
  trailingSlash: false,
  currentLocale: "en",
};

/** Real SSR render of the header's VersionSwitcher, v1 disabled, viewing "latest". */
function renderHeaderSwitcher(): string {
  return render(
    <VersionSwitcher
      versions={versions}
      currentVersion={undefined}
      latestUrl="/docs/intro"
      versionsPageUrl="/docs/versions"
      versionUrls={{ v1: "/v/v1/docs/intro", v2: "/v/v2/docs/intro" }}
      unavailableVersions={new Set(["v1"])}
      labels={labels}
      idSuffix="header"
      rewireConfig={rewireConfig}
    />,
  );
}

function articleHtml(): string {
  return `<article class="zd-content max-w-none" ${UNAVAILABLE_VERSIONS_ATTR}="v1"></article>`;
}

interface AnchorSnapshot {
  ariaDisabled: string | null;
  tabIndex: string | null;
  title: string | null;
  className: string;
  ariaCurrent: string | null;
}

function anchorProps(root: ParentNode, slug: string): AnchorSnapshot {
  const a = root.querySelector(`a[data-version-slug="${slug}"]`);
  if (!a) throw new Error(`no anchor for slug "${slug}"`);
  return {
    ariaDisabled: a.getAttribute("aria-disabled"),
    tabIndex: a.getAttribute("tabindex"),
    title: a.getAttribute("title"),
    className: a.className,
    ariaCurrent: a.getAttribute("aria-current"),
  };
}

/** Overrides `document.readyState` for the duration of the callback. */
function withReadyState<T>(state: DocumentReadyState, fn: () => T): T {
  const original = Object.getOwnPropertyDescriptor(Document.prototype, "readyState");
  Object.defineProperty(document, "readyState", {
    configurable: true,
    get: () => state,
  });
  try {
    return fn();
  } finally {
    if (original) {
      Object.defineProperty(Document.prototype, "readyState", original);
    }
    // Own-property override (set directly on `document`, not the prototype)
    // must also be removed so it doesn't shadow the restored prototype getter.
    delete (document as unknown as Record<string, unknown>).readyState;
  }
}

describe("VERSION_SWITCHER_REWIRE_SCRIPT survives first paint before <article> exists", () => {
  let header: HTMLDivElement;

  beforeEach(() => {
    delete (window as unknown as { __zdVersionSwitcherRewire?: boolean })
      .__zdVersionSwitcherRewire;
    header = document.createElement("div");
    document.body.appendChild(header);
    header.innerHTML = renderHeaderSwitcher();
  });

  afterEach(() => {
    header.remove();
    document.body.querySelectorAll("article").forEach((el) => el.remove());
  });

  it("does not clobber SSR-disabled entries when the script runs before <article> is parsed", () => {
    // Document still parsing, <article> not yet in the DOM — the exact
    // first-paint ordering an inline <header> script sees in production.
    withReadyState("loading", () => {
      new Function(VERSION_SWITCHER_REWIRE_SCRIPT)();
    });

    // Parsing completes: <article> (carrying the SSR availability payload)
    // is appended, then DOMContentLoaded fires.
    const wrapper = document.createElement("div");
    wrapper.innerHTML = articleHtml();
    const article = wrapper.firstElementChild;
    if (!article) throw new Error("articleHtml produced no element");
    document.body.appendChild(article);

    withReadyState("complete", () => {
      document.dispatchEvent(new Event("DOMContentLoaded"));
    });

    const expected = anchorProps(
      (() => {
        const div = document.createElement("div");
        div.innerHTML = renderHeaderSwitcher();
        return div;
      })(),
      "v1",
    );
    expect(anchorProps(header, "v1")).toEqual(expected);
    expect(anchorProps(header, "v1").ariaDisabled).toBe("true");
  });

  it("still recomputes correctly from a real zfb:after-swap once parsing has completed", () => {
    // Sanity check that deferring the initial call doesn't regress waves 1-3:
    // once the document is already "complete", the script must still react
    // to after-swap the same way `version-switcher-rewire-disabled.test.tsx`
    // pins.
    const wrapper = document.createElement("div");
    wrapper.innerHTML = articleHtml();
    const article = wrapper.firstElementChild;
    if (!article) throw new Error("articleHtml produced no element");
    document.body.appendChild(article);

    new Function(VERSION_SWITCHER_REWIRE_SCRIPT)();

    // Swap to a page where v1 is available again. Must carry the EMPTY
    // (`""`) payload — not an absent attribute — to mean "available in every
    // version" (see `version-availability/index.ts`'s three-state contract,
    // and the #3244 codex review fix in `version-switcher.tsx`'s `rewire()`:
    // an ABSENT attribute now means "leave disabled state untouched", so an
    // omitted attribute here would no longer re-enable v1).
    document.body.querySelectorAll("article").forEach((el) => el.remove());
    const freshWrapper = document.createElement("div");
    freshWrapper.innerHTML = `<article class="zd-content max-w-none" ${UNAVAILABLE_VERSIONS_ATTR}=""></article>`;
    const freshArticle = freshWrapper.firstElementChild;
    if (!freshArticle) throw new Error("fresh article missing");
    document.body.appendChild(freshArticle);
    document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));

    expect(anchorProps(header, "v1").ariaDisabled).toBeNull();
  });
});
