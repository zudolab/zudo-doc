/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * Stable DOM hook + gating regression test for the desktop TOC-toggle
 * feature (epic #3252, #3254).
 *
 * Coverage:
 *   1. `zd-toc-col` is present on the default-TOC wrapper when the package's
 *      own TOC renders.
 *   2. A page with a custom `hostBindings.Toc` override emits NEITHER the
 *      pre-paint script NOR the toggle island — `shouldRenderDefaultToc` must
 *      gate both factories off a custom Toc even though a TOC is visible.
 */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { createDocPageShell } from "../index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";

const BASE_PROPS = {
  kind: "entry" as const,
  locale: "en",
  slug: "getting-started",
  title: "Getting Started",
  breadcrumbs: [],
  prev: null,
  next: null,
  headings: [{ depth: 2, slug: "intro", text: "Intro" }],
  navSection: undefined,
  sidebarPersistKey: undefined,
  currentPath: "/docs/getting-started",
  versionSwitcher: null,
};

const SCRIPT_SET_ATTR = `setAttribute('data-toc-hidden','')`;

describe("createDocPageShell — desktop TOC toggle, default TOC", () => {
  it("renders the zd-toc-col hook class on the default-TOC wrapper", () => {
    const ctx = makeFakeChromeContext({ settings: { tocToggle: true } });
    const DocPageShell = createDocPageShell(ctx);
    const html = render(<DocPageShell {...BASE_PROPS} />);

    expect(html).toContain("zd-toc-col");
  });

  it("emits the pre-paint script in <head> and the toggle island in the body", () => {
    const ctx = makeFakeChromeContext({ settings: { tocToggle: true } });
    const DocPageShell = createDocPageShell(ctx);
    const html = render(<DocPageShell {...BASE_PROPS} />);

    expect(html).toContain(SCRIPT_SET_ATTR);
    expect(html).toContain('data-zfb-island="DesktopTocToggle"');
  });

  it("emits neither the script nor the island when tocToggle is off", () => {
    const ctx = makeFakeChromeContext({ settings: { tocToggle: false } });
    const DocPageShell = createDocPageShell(ctx);
    const html = render(<DocPageShell {...BASE_PROPS} />);

    expect(html).not.toContain(SCRIPT_SET_ATTR);
    expect(html).not.toContain('data-zfb-island="DesktopTocToggle"');
  });
});

describe("createDocPageShell — desktop TOC toggle, custom Toc override", () => {
  function CustomToc() {
    return <nav data-custom-toc>custom toc</nav>;
  }

  it("emits neither the prepaint script nor the toggle island on a custom-Toc page", () => {
    const ctx = makeFakeChromeContext({
      settings: { tocToggle: true },
      overrides: { hostBindings: { Toc: CustomToc } },
    });
    const DocPageShell = createDocPageShell(ctx);
    const html = render(<DocPageShell {...BASE_PROPS} />);

    // The custom Toc itself still renders...
    expect(html).toContain("data-custom-toc");
    // ...but the toggle feature (gated on shouldRenderDefaultToc) must stay
    // off: data-toc-hidden persisting across SPA navigation would otherwise
    // collapse/squish this custom Toc after the default TOC was hidden on
    // another page.
    expect(html).not.toContain(SCRIPT_SET_ATTR);
    expect(html).not.toContain('data-zfb-island="DesktopTocToggle"');
    // And the zd-toc-col hook class (which only decorates the default-TOC
    // wrapper) must not appear either.
    expect(html).not.toContain("zd-toc-col");
  });
});
