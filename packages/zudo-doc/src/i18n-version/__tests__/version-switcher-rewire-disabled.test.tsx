/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// Drift-guard extension for epic #3242 / #3244: simulates a real
// `zfb:after-swap` cycle in happy-dom and asserts the persisted header's
// version-switcher anchors end up matching a fresh SSR render of the
// destination page across all FIVE SSR-divergent properties (`aria-disabled`,
// `tabindex`, `title`, the full class list, `aria-current`) — not just hrefs
// / active state, which `version-switcher.test.tsx` already pins.
//
// Wave 1 (#3243) emits the per-page availability payload
// (`UNAVAILABLE_VERSIONS_ATTR`) onto the swapped `<article>`;
// `VERSION_SWITCHER_REWIRE_SCRIPT` (`../version-switcher.js`) is the wave-2
// consumer under test here. This file is kept separate from
// `version-switcher.test.tsx` (which runs in vitest's default plain-Node
// environment) because exercising the actual script string end-to-end needs
// a real DOM (`happy-dom`, declared via the file-scoped pragma above).

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
  unavailableLabel: labels.unavailable,
};

interface PageState {
  /** Pathname the "live" location is set to for this page. */
  pathname: string;
  currentVersion?: string;
  currentSlug: string;
  /** `undefined` ⇒ the payload attribute is ABSENT (mirrors the 3-state contract). */
  unavailable: Set<string> | undefined;
}

function versionUrlsFor(currentSlug: string): Record<string, string> {
  return {
    v1: `/v/v1/docs/${currentSlug}`,
    v2: `/v/v2/docs/${currentSlug}`,
  };
}

/** Real SSR render of the header's VersionSwitcher for a given page state. */
function renderHeaderSwitcher(page: PageState): string {
  return render(
    <VersionSwitcher
      versions={versions}
      currentVersion={page.currentVersion}
      latestUrl={`/docs/${page.currentSlug}`}
      versionsPageUrl="/docs/versions"
      versionUrls={versionUrlsFor(page.currentSlug)}
      unavailableVersions={page.unavailable}
      labels={labels}
      idSuffix="header"
      rewireConfig={rewireConfig}
    />,
  );
}

/**
 * The swapped `<article>` wave 1 emits. `undefined` reproduces the ABSENT
 * case (no key at all) — see `version-availability/index.ts`'s three-state
 * contract this mirrors.
 */
function articleHtml(unavailable: Set<string> | undefined): string {
  const attr =
    unavailable === undefined
      ? ""
      : ` ${UNAVAILABLE_VERSIONS_ATTR}="${Array.from(unavailable).sort().join(",")}"`;
  return `<article class="zd-content max-w-none"${attr}></article>`;
}

function setArticle(unavailable: Set<string> | undefined): void {
  document.body.querySelectorAll("article").forEach((el) => el.remove());
  const wrapper = document.createElement("div");
  wrapper.innerHTML = articleHtml(unavailable);
  const article = wrapper.firstElementChild;
  if (!article) throw new Error("articleHtml produced no element");
  document.body.appendChild(article);
}

function setLocation(pathname: string): void {
  (window as unknown as { happyDOM?: { setURL: (url: string) => void } }).happyDOM?.setURL(
    `http://localhost${pathname}`,
  );
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

/** The properties an SSR render of `page` would produce for `slug`. */
function expectedProps(page: PageState, slug: string): AnchorSnapshot {
  const div = document.createElement("div");
  div.innerHTML = renderHeaderSwitcher(page);
  return anchorProps(div, slug);
}

describe("VERSION_SWITCHER_REWIRE_SCRIPT recomputes disabled state on zfb:after-swap (#3244)", () => {
  let header: HTMLDivElement;

  beforeEach(() => {
    delete (window as unknown as { __zdVersionSwitcherRewire?: boolean })
      .__zdVersionSwitcherRewire;
    header = document.createElement("div");
    document.body.appendChild(header);
  });

  afterEach(() => {
    header.remove();
    document.body.querySelectorAll("article").forEach((el) => el.remove());
  });

  /**
   * Mounts `before`'s SSR header + article, runs the rewire script (this
   * registers the after-swap listener and performs the harmless initial
   * pass), then swaps in `after`'s article + location and dispatches the
   * after-swap event — the same sequence a real same-locale SPA navigation
   * produces against the persisted header.
   */
  function simulateSwap(before: PageState, after: PageState): void {
    setLocation(before.pathname);
    header.innerHTML = renderHeaderSwitcher(before);
    setArticle(before.unavailable);
    new Function(VERSION_SWITCHER_REWIRE_SCRIPT)();

    setArticle(after.unavailable);
    setLocation(after.pathname);
    document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
  }

  describe("latest active throughout (currentVersion undefined)", () => {
    const base: Omit<PageState, "unavailable"> = {
      pathname: "/docs/intro",
      currentVersion: undefined,
      currentSlug: "intro",
    };

    it("disabled -> available: v1 regains full interactivity", () => {
      const before: PageState = { ...base, unavailable: new Set(["v1"]) };
      const after: PageState = { ...base, unavailable: new Set() };
      simulateSwap(before, after);

      expect(anchorProps(header, "v1")).toEqual(expectedProps(after, "v1"));
      // v2 was never disabled — must stay untouched across the swap.
      expect(anchorProps(header, "v2")).toEqual(expectedProps(after, "v2"));
    });

    it("available -> disabled: v1 becomes muted, non-interactive", () => {
      const before: PageState = { ...base, unavailable: new Set() };
      const after: PageState = { ...base, unavailable: new Set(["v1"]) };
      simulateSwap(before, after);

      expect(anchorProps(header, "v1")).toEqual(expectedProps(after, "v1"));
      expect(anchorProps(header, "v2")).toEqual(expectedProps(after, "v2"));
    });
  });

  describe("shared active slug throughout (currentVersion \"v1\" on both pages)", () => {
    const base: Omit<PageState, "unavailable"> = {
      pathname: "/v/v1/docs/intro",
      currentVersion: "v1",
      currentSlug: "intro",
    };

    it("disabled -> available: v2 regains full interactivity, v1 stays active", () => {
      const before: PageState = { ...base, unavailable: new Set(["v2"]) };
      const after: PageState = { ...base, unavailable: new Set() };
      simulateSwap(before, after);

      expect(anchorProps(header, "v2")).toEqual(expectedProps(after, "v2"));
      // The active entry (v1) must be untouched by v2's transition.
      expect(anchorProps(header, "v1")).toEqual(expectedProps(after, "v1"));
    });

    it("available -> disabled: v2 becomes muted, non-interactive, v1 stays active", () => {
      const before: PageState = { ...base, unavailable: new Set() };
      const after: PageState = { ...base, unavailable: new Set(["v2"]) };
      simulateSwap(before, after);

      expect(anchorProps(header, "v2")).toEqual(expectedProps(after, "v2"));
      expect(anchorProps(header, "v1")).toEqual(expectedProps(after, "v1"));
    });
  });

  it("restores aria-current when an entry becomes BOTH available and active (property 5)", () => {
    // Before: viewing "latest", v1 is disabled on this page (v1 is not the
    // active entry here, so this is a legal SSR state).
    const before: PageState = {
      pathname: "/docs/intro",
      currentVersion: undefined,
      currentSlug: "intro",
      unavailable: new Set(["v1"]),
    };
    // After: same-locale navigation lands ON v1's own page, where v1 is of
    // course available. The persisted header must both re-enable v1 AND
    // mark it active (aria-current="page" + font-bold/text-accent) — a
    // partial transition would leave it enabled-but-inactive or (worse)
    // still disabled while the URL says otherwise.
    const after: PageState = {
      pathname: "/v/v1/docs/intro",
      currentVersion: "v1",
      currentSlug: "intro",
      unavailable: new Set(),
    };
    simulateSwap(before, after);

    const actual = anchorProps(header, "v1");
    const expected = expectedProps(after, "v1");
    expect(actual).toEqual(expected);
    expect(actual.ariaCurrent).toBe("page");
    expect(actual.ariaDisabled).toBeNull();
  });

  it('absent payload leaves every entry enabled ("no availability info" fallback)', () => {
    const before: PageState = {
      pathname: "/docs/intro",
      currentVersion: undefined,
      currentSlug: "intro",
      unavailable: new Set(["v1"]),
    };
    // The destination page carries NO availability data at all (e.g. a
    // non-doc page) — must NOT be read as "everything unavailable"; per the
    // component's own SSR fallback (`!unavailableVersions || …`), it must
    // render every entry available, matching `expectedProps` built from
    // `unavailable: undefined`.
    const after: PageState = {
      pathname: "/docs/other",
      currentVersion: undefined,
      currentSlug: "other",
      unavailable: undefined,
    };
    simulateSwap(before, after);

    expect(anchorProps(header, "v1")).toEqual(expectedProps(after, "v1"));
    expect(anchorProps(header, "v1").ariaDisabled).toBeNull();
  });

  it("absent and empty-string payloads produce the identical enabled DOM state", () => {
    // Pins the three-state contract's documented equivalence for THIS
    // consumer: `version-availability/index.ts` treats "absent" and
    // "present, empty" as distinct concepts at the derivation layer, but
    // once they reach this script both must resolve to "no slug is
    // unavailable" — the same outcome the SSR component's own
    // no-unavailableVersions-prop fallback produces.
    const before: PageState = {
      pathname: "/docs/intro",
      currentVersion: undefined,
      currentSlug: "intro",
      unavailable: new Set(["v1"]),
    };
    const afterAbsent: PageState = { ...before, unavailable: undefined };
    const afterEmpty: PageState = { ...before, unavailable: new Set() };

    simulateSwap(before, afterAbsent);
    const absentResult = anchorProps(header, "v1");

    simulateSwap(before, afterEmpty);
    const emptyResult = anchorProps(header, "v1");

    expect(absentResult).toEqual(emptyResult);
  });
});
