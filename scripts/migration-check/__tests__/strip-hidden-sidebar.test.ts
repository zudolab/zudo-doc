/**
 * strip-hidden-sidebar.test.ts
 *
 * Unit tests for hasHiddenSidebar(), stripDesktopSidebarAside(), and
 * maybeStripHiddenSidebar() from lib/strip-hidden-sidebar.mjs.
 *
 * Covers:
 *   - Detection of hidden sidebar markers (class="sr-only" on aside#desktop-sidebar)
 *   - Non-detection on normal (visible) sidebar pages
 *   - Removal of the aside element and all its children
 *   - Symmetric stripping: content in the stripped block is gone from both sides
 *   - Toggle: maybeStripHiddenSidebar is a no-op when enabled=false
 *   - Edge cases: nested asides, sidebar absent entirely
 */

import { describe, expect, it } from "vitest";
import {
  hasHiddenSidebar,
  stripDesktopSidebarAside,
  maybeStripHiddenSidebar,
} from "../lib/strip-hidden-sidebar.mjs";

// ── hasHiddenSidebar ──────────────────────────────────────────────────────────

describe("hasHiddenSidebar", () => {
  it("detects aside#desktop-sidebar with class sr-only (B-side pattern)", () => {
    const html = `<aside id="desktop-sidebar" aria-label="Documentation sidebar" class="sr-only"><nav>links</nav></aside>`;
    expect(hasHiddenSidebar(html)).toBe(true);
  });

  it("detects aside#desktop-sidebar with class sr-only as first class", () => {
    const html = `<aside class="sr-only" id="desktop-sidebar" aria-label="Documentation sidebar"><nav>links</nav></aside>`;
    expect(hasHiddenSidebar(html)).toBe(true);
  });

  it("returns false when aside has visible sidebar classes (not hidden)", () => {
    // On regular doc pages the aside has the full CSS layout class, not sr-only
    const html = `<aside id="desktop-sidebar" class="hidden lg:block fixed top-[3.5rem] left-0 z-30"><nav>links</nav></aside>`;
    expect(hasHiddenSidebar(html)).toBe(false);
  });

  it("returns false when there is no aside#desktop-sidebar at all", () => {
    const html = `<html><body><main>content</main></body></html>`;
    expect(hasHiddenSidebar(html)).toBe(false);
  });

  it("returns false for an aside with sr-only but a different id", () => {
    const html = `<aside id="mobile-sidebar" class="sr-only"><nav>links</nav></aside>`;
    expect(hasHiddenSidebar(html)).toBe(false);
  });
});

// ── stripDesktopSidebarAside ──────────────────────────────────────────────────

describe("stripDesktopSidebarAside", () => {
  it("removes the entire aside element including children", () => {
    const html = `<body><header>H</header><aside id="desktop-sidebar" class="sr-only"><nav><a href="/docs/intro">Intro</a></nav></aside><main>Content</main></body>`;
    const result = stripDesktopSidebarAside(html);
    expect(result).not.toContain("desktop-sidebar");
    expect(result).not.toContain("/docs/intro");
    expect(result).toContain("<main>Content</main>");
    expect(result).toContain("<header>H</header>");
  });

  it("leaves the rest of the document intact", () => {
    const html = `<body><aside id="desktop-sidebar" class="sr-only"><nav>NAV</nav></aside><main><h1>Title</h1><p>Body text</p></main></body>`;
    const result = stripDesktopSidebarAside(html);
    expect(result).toBe("<body><main><h1>Title</h1><p>Body text</p></main></body>");
  });

  it("is a no-op when there is no aside#desktop-sidebar", () => {
    const html = `<body><main>Content</main></body>`;
    expect(stripDesktopSidebarAside(html)).toBe(html);
  });

  it("handles aside with attributes in any order", () => {
    const html = `<html><body><aside aria-label="Sidebar" class="sr-only" id="desktop-sidebar" style="color:red"><p>Sidebar content</p></aside><main>Main</main></body></html>`;
    const result = stripDesktopSidebarAside(html);
    expect(result).not.toContain("Sidebar content");
    expect(result).toContain("<main>Main</main>");
  });

  it("strips the aside even when it is large (many nav links)", () => {
    const navLinks = Array.from({ length: 50 }, (_, i) =>
      `<a href="/docs/page-${i}">Page ${i}</a>`
    ).join("");
    const html = `<body><aside id="desktop-sidebar" class="sr-only"><nav>${navLinks}</nav></aside><main>Main content</main></body>`;
    const result = stripDesktopSidebarAside(html);
    expect(result).not.toContain("Page 0");
    expect(result).not.toContain("Page 49");
    expect(result).toContain("Main content");
  });
});

// ── maybeStripHiddenSidebar ───────────────────────────────────────────────────

describe("maybeStripHiddenSidebar", () => {
  const hiddenSidebarHtml = `<body><aside id="desktop-sidebar" class="sr-only"><nav><a href="/docs/x">X</a></nav></aside><main>Page content</main></body>`;
  const visibleSidebarHtml = `<body><aside id="desktop-sidebar" class="hidden lg:block fixed"><nav><a href="/docs/x">X</a></nav></aside><main>Page content</main></body>`;

  it("strips hidden sidebar when enabled=true and page has hidden sidebar", () => {
    const result = maybeStripHiddenSidebar(hiddenSidebarHtml, true);
    expect(result).not.toContain("desktop-sidebar");
    expect(result).not.toContain("/docs/x");
    expect(result).toContain("Page content");
  });

  it("is a no-op when enabled=false even if page has hidden sidebar", () => {
    const result = maybeStripHiddenSidebar(hiddenSidebarHtml, false);
    expect(result).toBe(hiddenSidebarHtml);
  });

  it("is a no-op when enabled=true but sidebar is visible (not sr-only)", () => {
    const result = maybeStripHiddenSidebar(visibleSidebarHtml, true);
    expect(result).toBe(visibleSidebarHtml);
  });

  it("is a no-op when enabled=true but no sidebar present at all", () => {
    const html = `<body><main>No sidebar here</main></body>`;
    expect(maybeStripHiddenSidebar(html, true)).toBe(html);
  });

  it("symmetric stripping: same content disappears from both sides", () => {
    // Simulate A-side: aside present with sr-only (e.g. Astro CSS-hidden sidebar)
    const sideA = `<body><aside id="desktop-sidebar" class="sr-only"><nav><a href="/docs/guide">Guide</a></nav></aside><main>Tag page content</main></body>`;
    // Simulate B-side: same aside but with empty sidebar island
    const sideB = `<body><aside id="desktop-sidebar" class="sr-only"><div data-zfb-island="Sidebar"></div></aside><main>Tag page content</main></body>`;

    const strippedA = maybeStripHiddenSidebar(sideA, true);
    const strippedB = maybeStripHiddenSidebar(sideB, true);

    // After stripping, both sides have no sidebar DOM
    expect(strippedA).not.toContain("desktop-sidebar");
    expect(strippedB).not.toContain("desktop-sidebar");
    // Main content is unchanged on both sides
    expect(strippedA).toContain("Tag page content");
    expect(strippedB).toContain("Tag page content");
  });
});
