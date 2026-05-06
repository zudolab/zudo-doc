/**
 * strip-hidden-sidebar.test.ts
 *
 * Unit tests for hasHiddenSidebar(), stripDesktopSidebarAside(), and
 * maybeStripHiddenSidebar() from lib/strip-hidden-sidebar.mjs.
 *
 * Covers:
 *   - Detection of hidden sidebar markers (B-side: aside#desktop-sidebar.sr-only)
 *   - Detection of A-side Astro mobile-drawer aside (lg:hidden + -translate-x-full)
 *   - Non-detection on normal (visible) sidebar pages
 *   - Removal of the aside element and all its children
 *   - Symmetric stripping: B-side and A-side hidden asides both fall out of the diff
 *   - Toggle: maybeStripHiddenSidebar is a no-op when enabled=false
 *   - Edge cases: multi-line class attribute, nested asides, sidebar absent
 */

import { describe, expect, it } from "vitest";
import {
  hasHiddenSidebar,
  stripDesktopSidebarAside,
  maybeStripHiddenSidebar,
} from "../lib/strip-hidden-sidebar.mjs";

// ── Fixtures ──────────────────────────────────────────────────────────────────

// B-side (zfb) hideSidebar=true marker — single-line, sr-only on #desktop-sidebar.
const B_SIDE_HIDDEN_ASIDE = `<aside id="desktop-sidebar" aria-label="Documentation sidebar" class="sr-only"><nav><a href="/docs/x">X</a></nav></aside>`;

// A-side (Astro) mobile-drawer aside emitted by SidebarToggle. The class
// attribute spans multiple lines and contains both `lg:hidden` (hides on
// desktop) and `-translate-x-full` (hides on mobile when drawer is closed),
// so the aside is hidden on every viewport at first paint.
const A_SIDE_MOBILE_DRAWER_ASIDE = `<aside class="
      fixed top-[3.5rem] left-0 z-40 h-[calc(100vh-3.5rem)] w-[16rem] flex flex-col
      border-r border-muted bg-bg transition-transform duration-200
      lg:hidden
      -translate-x-full
    "><nav><a href="/docs/guide">Guide</a></nav></aside>`;

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

  it("detects A-side Astro mobile-drawer aside (lg:hidden + -translate-x-full, multi-line class)", () => {
    expect(hasHiddenSidebar(A_SIDE_MOBILE_DRAWER_ASIDE)).toBe(true);
  });

  it("detects A-side mobile-drawer aside even when wrapped in surrounding markup", () => {
    const html = `<body><header>H</header>${A_SIDE_MOBILE_DRAWER_ASIDE}<main>Content</main></body>`;
    expect(hasHiddenSidebar(html)).toBe(true);
  });

  it("returns false for an aside with lg:hidden but no -translate-x-full", () => {
    // Sidebar that is desktop-hidden but visible on mobile is NOT the
    // mobile-drawer pattern — only the drawer ships with both classes.
    const html = `<aside class="lg:hidden flex w-full"><nav>links</nav></aside>`;
    expect(hasHiddenSidebar(html)).toBe(false);
  });

  it("returns false for an aside with -translate-x-full but no lg:hidden", () => {
    const html = `<aside class="fixed -translate-x-full"><nav>links</nav></aside>`;
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

  it("strips A-side Astro mobile-drawer aside (multi-line class attribute)", () => {
    const html = `<body><header>H</header>${A_SIDE_MOBILE_DRAWER_ASIDE}<main>Main</main></body>`;
    const result = stripDesktopSidebarAside(html);
    expect(result).not.toContain("-translate-x-full");
    expect(result).not.toContain("/docs/guide");
    expect(result).not.toContain("<aside");
    expect(result).toContain("<header>H</header>");
    expect(result).toContain("<main>Main</main>");
  });

  it("strips both shapes in the same document", () => {
    const html = `<body>${B_SIDE_HIDDEN_ASIDE}<main>Hello</main>${A_SIDE_MOBILE_DRAWER_ASIDE}</body>`;
    const result = stripDesktopSidebarAside(html);
    expect(result).not.toContain("<aside");
    expect(result).not.toContain("desktop-sidebar");
    expect(result).not.toContain("-translate-x-full");
    expect(result).toContain("<main>Hello</main>");
  });

  it("leaves a non-hidden aside untouched", () => {
    // Visible sidebar on a regular doc page — must not be stripped.
    const visible = `<aside id="desktop-sidebar" class="hidden lg:block fixed"><nav><a href="/docs/x">X</a></nav></aside>`;
    const html = `<body>${visible}<main>Main</main></body>`;
    const result = stripDesktopSidebarAside(html);
    expect(result).toBe(html);
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

  it("symmetric stripping across asymmetric markup shapes (A-side mobile drawer vs B-side sr-only)", () => {
    // hideSidebar=true route post-migration: A renders the Astro mobile drawer,
    // B renders the zfb sr-only marker. Different DOM shapes, but both must
    // fall out of the diff so the content-loss check sees only the visible
    // page content.
    const sideA = `<body><header>H</header>${A_SIDE_MOBILE_DRAWER_ASIDE}<main>Tag page content</main></body>`;
    const sideB = `<body><header>H</header>${B_SIDE_HIDDEN_ASIDE}<main>Tag page content</main></body>`;

    const strippedA = maybeStripHiddenSidebar(sideA, true);
    const strippedB = maybeStripHiddenSidebar(sideB, true);

    // Both sides have no aside left
    expect(strippedA).not.toContain("<aside");
    expect(strippedB).not.toContain("<aside");
    // No nav link text leaked through from either hidden sidebar
    expect(strippedA).not.toContain("/docs/guide");
    expect(strippedB).not.toContain("/docs/x");
    // Both sides converge on the same shape after stripping
    expect(strippedA).toBe(strippedB);
  });

  it("strips A-side Astro mobile-drawer aside via the public contract", () => {
    const html = `<body>${A_SIDE_MOBILE_DRAWER_ASIDE}<main>Page content</main></body>`;
    const result = maybeStripHiddenSidebar(html, true);
    expect(result).not.toContain("<aside");
    expect(result).not.toContain("/docs/guide");
    expect(result).toContain("Page content");
  });

  it("is a no-op on the A-side aside when enabled=false", () => {
    const html = `<body>${A_SIDE_MOBILE_DRAWER_ASIDE}<main>Page content</main></body>`;
    expect(maybeStripHiddenSidebar(html, false)).toBe(html);
  });
});
