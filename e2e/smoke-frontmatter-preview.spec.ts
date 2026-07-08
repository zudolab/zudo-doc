import { test, expect } from "@playwright/test";
import { expectHtmlAttr } from "./html-assertions";
import { readDistFile } from "./smoke-dist-helper";

/**
 * L3 static dist reads for the frontmatter-preview block rendered-vs-hidden
 * behavior. Demoted from browser tests (zudolab/zudo-doc#2537, preserving
 * every prior assertion): the block is SSR-only static markup, so a real
 * page load + DOM query added zero coverage a dist read doesn't already
 * give — the fixture wiring these tests also pin (which pages get which
 * frontmatter) is unchanged, just asserted against `dist/` instead.
 *
 * Three scenarios:
 * 1. System-only frontmatter → block absent.
 * 2. Custom frontmatter → block visible with correct rows (and ignored keys absent).
 * 3. Auto-index category page → block absent (no entry, auto-generated).
 *
 * Fixture content:
 * - /docs/getting-started — system-only frontmatter (title, sidebar_position)
 * - /docs/guides/frontmatter-preview-test — custom fields: author, status
 * - /docs/auto-index-category — auto-generated index (no index.mdx)
 */

test.describe("Frontmatter Preview: rendered-vs-hidden behavior", () => {
  test("system-only frontmatter → block absent", () => {
    const html = readDistFile("docs/getting-started/index.html");
    expect(html).not.toMatch(/data-testid\s*=\s*["']?frontmatter-preview/);
  });

  test("custom frontmatter → block visible with correct rows", () => {
    const html = readDistFile("docs/guides/frontmatter-preview-test/index.html");

    // Block must be present
    expectHtmlAttr(html, "data-testid", "frontmatter-preview");

    // Scope row assertions to the block's <tbody> — the page also has a
    // prose paragraph mentioning "author"/"status" outside the block.
    const blockStart = html.search(/data-testid\s*=\s*["']?frontmatter-preview/);
    const tbodyStart = html.indexOf("<tbody>", blockStart);
    const tbodyEnd = html.indexOf("</tbody>", tbodyStart);
    const tbody = html.slice(tbodyStart, tbodyEnd);

    // Custom field rows must appear
    const rowCount = (tbody.match(/<tr[ >]/g) ?? []).length;
    expect(rowCount).toBe(2);
    expect(tbody).toContain(">author<");
    expect(tbody).toContain(">status<");

    // System-managed keys must NOT appear
    expect(tbody).not.toContain(">title<");
    expect(tbody).not.toContain(">sidebar_position<");
  });

  test("auto-index category page → block absent", () => {
    const html = readDistFile("docs/auto-index-category/index.html");
    expect(html).not.toMatch(/data-testid\s*=\s*["']?frontmatter-preview/);
  });
});
