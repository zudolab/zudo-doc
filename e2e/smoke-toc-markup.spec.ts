import { test, expect } from "@playwright/test";
import { readDistFile } from "./smoke-dist-helper";

/**
 * L3 static dist reads for the desktop Table of Contents markup — split out
 * of `smoke-toc.spec.ts` (zudolab/zudo-doc#2537, preserving every prior
 * assertion): heading-link presence and the h3 indent class are static SSR
 * markup, so a browser isn't needed to assert them. Viewport-visibility and
 * scroll-spy behavior (which DO need real layout/CSS and scroll events)
 * stay in `smoke-toc.spec.ts`.
 *
 * Uses the toc-test page which has multiple h2/h3 headings.
 */

const DIST_PAGE = "docs/guides/toc-test/index.html";

/** Scope assertions to the TOC nav element (matches the original browser
 * tests' `[aria-label="Table of contents"]` locator scope). */
function extractTocNav(html: string): string {
  const labelIndex = html.indexOf('aria-label="Table of contents"');
  const navStart = html.lastIndexOf("<nav", labelIndex);
  const navEnd = html.indexOf("</nav>", labelIndex);
  return html.slice(navStart, navEnd);
}

test.describe("TOC: desktop table of contents markup", () => {
  let toc: string;

  test.beforeAll(() => {
    toc = extractTocNav(readDistFile(DIST_PAGE));
  });

  test("TOC contains h2 heading links", () => {
    const h2Headings = [
      "Introduction",
      "Getting Started",
      "Configuration",
      "Content Authoring",
      "Deployment",
    ];

    for (const heading of h2Headings) {
      expect(toc).toContain(`>${heading}</a>`);
    }
  });

  test("TOC contains h3 heading links", () => {
    const h3Headings = [
      "Prerequisites",
      "Installation",
      "Basic Settings",
      "Advanced Options",
      "Writing MDX",
      "Using Components",
    ];

    for (const heading of h3Headings) {
      expect(toc).toContain(`>${heading}</a>`);
    }
  });

  test("h3 list items have ml-hsp-lg class", () => {
    // Mirrors the original browser test's spot check: the "Prerequisites"
    // h3 link's parent <li> carries the indent class.
    expect(toc).toContain(
      '<li class="ml-hsp-lg"><a href="#getting-started-prerequisites"',
    );
  });
});
