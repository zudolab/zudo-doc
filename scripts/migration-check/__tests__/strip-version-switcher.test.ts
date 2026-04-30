/**
 * strip-version-switcher.test.ts
 *
 * Unit tests for hasVersionSwitcher(), stripVersionSwitcher(), and
 * maybeStripVersionSwitcher() from lib/strip-version-switcher.mjs.
 *
 * Covers:
 *   - Detection of A-side div.version-switcher marker
 *   - Detection of B-side div[data-version-switcher] marker
 *   - Non-detection on pages without a version-switcher
 *   - Removal of the div element and all its children (button + dropdown ul)
 *   - Symmetric stripping: A-side and B-side version-switcher markup both fall out
 *   - Toggle: maybeStripVersionSwitcher is a no-op when enabled=false
 *   - Edge cases: nested divs inside the switcher, switcher absent
 */

import { describe, expect, it } from "vitest";
import {
  hasVersionSwitcher,
  stripVersionSwitcher,
  maybeStripVersionSwitcher,
} from "../lib/strip-version-switcher.mjs";

// ── Fixtures ──────────────────────────────────────────────────────────────────

// A-side (Astro) inline version-switcher — renders in <main> next to breadcrumb.
const A_SIDE_VERSION_SWITCHER = `<div class="version-switcher"><button type="button">Version: Latest</button><ul class="hidden"><li><a href="/docs/">Latest</a></li><li><a href="/docs/1.0.0/">1.0.0</a></li><li><a href="/docs/all/">All versions</a></li></ul></div>`;

// B-side (zfb) version-switcher marker using a data attribute.
const B_SIDE_VERSION_SWITCHER = `<div data-version-switcher><button type="button">Version: Latest</button></div>`;

// A-side switcher with additional classes alongside "version-switcher".
const A_SIDE_VERSION_SWITCHER_EXTRA_CLASSES = `<div class="relative version-switcher ml-4"><button>Version: Latest</button></div>`;

// ── hasVersionSwitcher ────────────────────────────────────────────────────────

describe("hasVersionSwitcher", () => {
  it("detects div with class version-switcher (A-side pattern)", () => {
    expect(hasVersionSwitcher(A_SIDE_VERSION_SWITCHER)).toBe(true);
  });

  it("detects div with data-version-switcher attribute (B-side pattern)", () => {
    expect(hasVersionSwitcher(B_SIDE_VERSION_SWITCHER)).toBe(true);
  });

  it("detects version-switcher even when surrounded by page markup", () => {
    const html = `<body><main><div class="breadcrumb">Home</div>${A_SIDE_VERSION_SWITCHER}<article>Content</article></main></body>`;
    expect(hasVersionSwitcher(html)).toBe(true);
  });

  it("detects version-switcher when class has additional class names", () => {
    expect(hasVersionSwitcher(A_SIDE_VERSION_SWITCHER_EXTRA_CLASSES)).toBe(true);
  });

  it("returns false for a plain div without version-switcher markers", () => {
    const html = `<body><div class="breadcrumb"><a href="/">Home</a></div><main>Content</main></body>`;
    expect(hasVersionSwitcher(html)).toBe(false);
  });

  it("returns false when there are no divs at all", () => {
    const html = `<html><body><main><p>Content</p></main></body></html>`;
    expect(hasVersionSwitcher(html)).toBe(false);
  });

  it("returns false for a div with a class that partially matches (not a whole word)", () => {
    const html = `<div class="version-switcher-wrapper"><button>Version</button></div>`;
    expect(hasVersionSwitcher(html)).toBe(false);
  });
});

// ── stripVersionSwitcher ──────────────────────────────────────────────────────

describe("stripVersionSwitcher", () => {
  it("removes the entire A-side div.version-switcher including its children", () => {
    const html = `<body><main><div class="breadcrumb">Home</div>${A_SIDE_VERSION_SWITCHER}<article>Page content</article></main></body>`;
    const result = stripVersionSwitcher(html);
    expect(result).not.toContain("version-switcher");
    expect(result).not.toContain("Version: Latest");
    expect(result).not.toContain("All versions");
    expect(result).toContain("<article>Page content</article>");
    expect(result).toContain('<div class="breadcrumb">Home</div>');
  });

  it("removes the B-side data-version-switcher div", () => {
    const html = `<body><main>${B_SIDE_VERSION_SWITCHER}<article>Page content</article></main></body>`;
    const result = stripVersionSwitcher(html);
    expect(result).not.toContain("data-version-switcher");
    expect(result).not.toContain("Version: Latest");
    expect(result).toContain("<article>Page content</article>");
  });

  it("leaves the rest of the document intact", () => {
    const html = `<body><main>${A_SIDE_VERSION_SWITCHER}<h1>Title</h1><p>Body text</p></main></body>`;
    const result = stripVersionSwitcher(html);
    expect(result).toBe("<body><main><h1>Title</h1><p>Body text</p></main></body>");
  });

  it("is a no-op when there is no version-switcher", () => {
    const html = `<body><main><p>Content</p></main></body>`;
    expect(stripVersionSwitcher(html)).toBe(html);
  });

  it("handles nested divs inside the version-switcher without stripping them separately", () => {
    // The switcher contains a nested dropdown div — depth tracking must handle this.
    const html = `<body><div class="version-switcher"><div class="dropdown"><div class="item">1.0.0</div></div></div><main>Main</main></body>`;
    const result = stripVersionSwitcher(html);
    expect(result).not.toContain("version-switcher");
    expect(result).not.toContain("dropdown");
    expect(result).not.toContain("1.0.0");
    expect(result).toContain("<main>Main</main>");
  });

  it("strips version-switcher div with additional classes alongside the marker", () => {
    const html = `<body>${A_SIDE_VERSION_SWITCHER_EXTRA_CLASSES}<main>Main</main></body>`;
    const result = stripVersionSwitcher(html);
    expect(result).not.toContain("version-switcher");
    expect(result).not.toContain("Version: Latest");
    expect(result).toContain("<main>Main</main>");
  });

  it("leaves non-version-switcher divs untouched", () => {
    const html = `<body><div class="breadcrumb"><a href="/">Home</a></div><main>Main</main></body>`;
    expect(stripVersionSwitcher(html)).toBe(html);
  });

  it("strips both A-side and B-side shapes in the same document", () => {
    const html = `<body>${A_SIDE_VERSION_SWITCHER}<main>Hello</main>${B_SIDE_VERSION_SWITCHER}</body>`;
    const result = stripVersionSwitcher(html);
    expect(result).not.toContain("version-switcher");
    expect(result).not.toContain("data-version-switcher");
    expect(result).not.toContain("Version: Latest");
    expect(result).toContain("<main>Hello</main>");
  });

  it("strips multiple version-switcher divs when they appear more than once in a document", () => {
    // Unlikely in practice but the walker is a loop — verify it removes all occurrences.
    const html = `<body>${A_SIDE_VERSION_SWITCHER}<main>Middle</main>${A_SIDE_VERSION_SWITCHER}</body>`;
    const result = stripVersionSwitcher(html);
    expect(result).not.toContain("version-switcher");
    expect(result).not.toContain("Version: Latest");
    expect(result).toContain("<main>Middle</main>");
  });
});

// ── maybeStripVersionSwitcher ─────────────────────────────────────────────────

describe("maybeStripVersionSwitcher", () => {
  const withSwitcherHtml = `<body><main>${A_SIDE_VERSION_SWITCHER}<article>Page content</article></main></body>`;
  const withoutSwitcherHtml = `<body><main><article>Page content</article></main></body>`;

  it("strips version-switcher when enabled=true and page has version-switcher", () => {
    const result = maybeStripVersionSwitcher(withSwitcherHtml, true);
    expect(result).not.toContain("version-switcher");
    expect(result).not.toContain("Version: Latest");
    expect(result).toContain("Page content");
  });

  it("is a no-op when enabled=false even if page has version-switcher", () => {
    const result = maybeStripVersionSwitcher(withSwitcherHtml, false);
    expect(result).toBe(withSwitcherHtml);
  });

  it("is a no-op when enabled=true but no version-switcher present", () => {
    const result = maybeStripVersionSwitcher(withoutSwitcherHtml, true);
    expect(result).toBe(withoutSwitcherHtml);
  });

  it("is a no-op when enabled=false and no version-switcher present", () => {
    expect(maybeStripVersionSwitcher(withoutSwitcherHtml, false)).toBe(withoutSwitcherHtml);
  });

  it("symmetric stripping: same version-switcher text disappears from both A and B", () => {
    // A-side has the inline div.version-switcher with dropdown text.
    const sideA = `<body><main>${A_SIDE_VERSION_SWITCHER}<article>Doc content</article></main></body>`;
    // B-side has a simpler data-version-switcher marker (header-only; inline is minimal).
    const sideB = `<body><main>${B_SIDE_VERSION_SWITCHER}<article>Doc content</article></main></body>`;

    const strippedA = maybeStripVersionSwitcher(sideA, true);
    const strippedB = maybeStripVersionSwitcher(sideB, true);

    // After stripping, neither side has version-switcher DOM.
    expect(strippedA).not.toContain("version-switcher");
    expect(strippedB).not.toContain("data-version-switcher");
    // Main content is unchanged on both sides.
    expect(strippedA).toContain("Doc content");
    expect(strippedB).toContain("Doc content");
  });

  it("symmetric stripping: A-side without switcher and B-side without switcher both pass through unchanged", () => {
    // Pages with no version-switcher at all — must be no-ops on both sides.
    const sideA = `<body><main><article>Doc content</article></main></body>`;
    const sideB = `<body><main><article>Doc content</article></main></body>`;

    expect(maybeStripVersionSwitcher(sideA, true)).toBe(sideA);
    expect(maybeStripVersionSwitcher(sideB, true)).toBe(sideB);
  });
});
