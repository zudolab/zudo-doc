/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * Unit tests for the `docContentHeaderExtras` host-binding seam
 * (zudolab/zudo-doc#2500, epic #2499).
 *
 * Pins the byte-identical baseline (slot unset), the injection point
 * (immediately after `<h1>`, before the metainfo/tags block — including on
 * versioned pages, where metainfo/tags are hidden but extras still render),
 * and the exact renderer-call payload.
 */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { createDocContentHeader } from "../index.js";
import type { DocPageEntry } from "../../doc-page-props/index.js";
import type { ChromeContext } from "../../factory-context/index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";

function makeEntry(data: Record<string, unknown> = {}): DocPageEntry {
  return {
    slug: "test-page",
    id: "test-page",
    collection: "docs",
    data: { title: "Test Page", ...data },
    module_specifier: "test-page.mdx",
    Content: () => null,
  } as unknown as DocPageEntry;
}

const BASELINE_HTML = '<h1 class="text-heading font-bold mb-vsp-xs">Test Page</h1>';

describe("createDocContentHeader — docContentHeaderExtras seam", () => {
  it("slot unset: renders byte-identical output to the pre-seam header", () => {
    const ctx = makeFakeChromeContext({ overrides: { hostBindings: {} } as Partial<ChromeContext> });
    const DocContentHeader = createDocContentHeader(ctx);
    const out = render(
      <DocContentHeader entry={makeEntry()} slug="test-page" locale="en" />,
    );
    expect(out).toBe(BASELINE_HTML);
  });

  it("slot set: extras render immediately after </h1> and before the metainfo block", () => {
    const ctx = makeFakeChromeContext({
      overrides: {
        hostBindings: {
          docHistoryMeta: {
            "test-page": { author: "A", createdDate: "2024-01-01", updatedDate: "2024-01-02" },
          },
          docContentHeaderExtras: () => <div class="extra">EXTRA</div>,
        },
      } as Partial<ChromeContext>,
    });
    const DocContentHeader = createDocContentHeader(ctx);
    const out = render(
      <DocContentHeader entry={makeEntry()} slug="test-page" locale="en" />,
    );

    const h1End = out.indexOf("</h1>") + "</h1>".length;
    const extraIdx = out.indexOf('<div class="extra">EXTRA</div>');
    const metainfoIdx = out.indexOf("doc.created");

    expect(extraIdx).toBe(h1End);
    expect(metainfoIdx).toBeGreaterThan(-1);
    expect(extraIdx).toBeLessThan(metainfoIdx);
  });

  it("versioned page: extras still render (receiving version) while metainfo/tags stay hidden", () => {
    const ctx = makeFakeChromeContext({
      overrides: {
        hostBindings: {
          docHistoryMeta: {
            "test-page": { author: "A", createdDate: "2024-01-01", updatedDate: "2024-01-02" },
          },
          docContentHeaderExtras: (args) => <div class="extra">v={String(args.version)}</div>,
        },
      } as Partial<ChromeContext>,
    });
    const DocContentHeader = createDocContentHeader(ctx);
    const out = render(
      <DocContentHeader entry={makeEntry()} slug="test-page" locale="en" version="1.0" />,
    );

    expect(out).toContain('<div class="extra">v=1.0</div>');
    // Metainfo/tags are unconditionally hidden on versioned pages, even
    // though docHistoryMeta has a matching entry.
    expect(out).not.toContain("doc.created");
    expect(out).not.toContain("doc.updated");
  });

  it("passes { entry, slug, locale, isFallback, version } to the renderer", () => {
    const calls: unknown[] = [];
    const ctx = makeFakeChromeContext({
      overrides: {
        hostBindings: {
          docContentHeaderExtras: (args) => {
            calls.push(args);
            return null;
          },
        },
      } as Partial<ChromeContext>,
    });
    const DocContentHeader = createDocContentHeader(ctx);
    const entry = makeEntry();
    render(
      <DocContentHeader
        entry={entry}
        slug="test-page"
        locale="ja"
        isFallback
        version="2.0"
      />,
    );

    expect(calls).toEqual([
      {
        entry,
        slug: "test-page",
        locale: "ja",
        isFallback: true,
        version: "2.0",
      },
    ]);
  });
});
