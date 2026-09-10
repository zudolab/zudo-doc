/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import type { ChromeContext } from "../../factory-context/index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";
import { createDocHistoryArea } from "../index.js";

const GITHUB_URL = "https://github.com/example/docs";

function renderArea(
  docHistoryMeta: Record<string, unknown>,
  sourceFileExt?: ".mdx" | ".md",
  docHistoryExclude?: string[],
  docHistoryUi?: boolean,
): string {
  const ctx = makeFakeChromeContext({
    settings: {
      githubUrl: GITHUB_URL,
      bodyFootUtilArea: { viewSourceLink: true },
      docHistoryExclude,
      docHistoryUi,
    },
    overrides: { hostBindings: { docHistoryMeta } } as Partial<ChromeContext>,
  });
  const DocHistoryArea = createDocHistoryArea(ctx);

  return render(
    <DocHistoryArea
      slug="guide"
      locale="en"
      entrySlug="guide"
      sourceFileExt={sourceFileExt}
      contentDir="src/content/docs"
    />,
  );
}

describe("createDocHistoryArea exclusion render state", () => {
  it("suppresses the DocHistory island for a matched history slug", () => {
    const html = renderArea({}, ".mdx", ["guide"]);

    expect(html).toBe("");
    expect(html).not.toContain('data-zfb-island-skip-ssr="DocHistory"');
  });

  it("renders the DocHistory island for a non-matching history slug", () => {
    const html = renderArea({}, ".mdx", ["private/**"]);

    expect(html).toContain('data-zfb-island-skip-ssr="DocHistory"');
  });
});

describe("createDocHistoryArea source extension contract", () => {
  it.each([
    [".md", ".mdx"],
    [".mdx", ".md"],
  ] as const)(
    "uses required manifest ext %s for tracked files",
    (manifestExt, currentExt) => {
      const html = renderArea(
        {
          guide: {
            author: "Alice",
            createdDate: "2024-01-01T00:00:00Z",
            updatedDate: "2024-02-01T00:00:00Z",
            ext: manifestExt,
          },
        },
        currentExt,
      );

      expect(html).toContain(
        `href="${GITHUB_URL}/blob/HEAD/src/content/docs/guide${manifestExt}"`,
      );
    },
  );

  it.each([".md", ".mdx"] as const)(
    "uses the explicit current-entry ext %s when metadata is absent",
    (sourceFileExt) => {
      const html = renderArea({}, sourceFileExt);

      expect(html).toContain(
        `href="${GITHUB_URL}/blob/HEAD/src/content/docs/guide${sourceFileExt}"`,
      );
    },
  );

  it("does not treat a present old manifest without ext as a no-meta entry", () => {
    const html = renderArea(
      {
        guide: {
          author: "Alice",
          createdDate: "2024-01-01T00:00:00Z",
          updatedDate: "2024-02-01T00:00:00Z",
        },
      },
      ".mdx",
    );

    expect(html).not.toContain(`${GITHUB_URL}/blob/HEAD/`);
  });
});

describe("createDocHistoryArea UI gate", () => {
  it("suppresses the history island while retaining the view-source link", () => {
    const html = renderArea({}, ".mdx", undefined, false);

    expect(html).toContain(
      `href="${GITHUB_URL}/blob/HEAD/src/content/docs/guide.mdx"`,
    );
    expect(html).not.toContain('data-zfb-island-skip-ssr="DocHistory"');
  });

  it("keeps the view-source link for an excluded page in dates-only mode", () => {
    const html = renderArea({}, ".mdx", ["guide"], false);

    expect(html).toContain(
      `href="${GITHUB_URL}/blob/HEAD/src/content/docs/guide.mdx"`,
    );
    expect(html).not.toContain('data-zfb-island-skip-ssr="DocHistory"');
  });

  it("returns no utility area when UI is off and the source link is disabled", () => {
    const ctx = makeFakeChromeContext({
      settings: { bodyFootUtilArea: false, docHistoryUi: false },
    });
    const DocHistoryArea = createDocHistoryArea(ctx);

    expect(
      render(
        <DocHistoryArea
          slug="guide"
          locale="en"
          entrySlug="guide"
          sourceFileExt=".mdx"
          contentDir="src/content/docs"
        />,
      ),
    ).toBe("");
  });
});

// ---------------------------------------------------------------------------
// displayLocale contract (#4073) — the real `DocHistory` island props ride
// the Island() marker's `data-props` JSON even in skip-ssr mode (see
// `@takazudo/zfb`'s `captureSerializableProps`), so we can assert exactly
// what reaches the island — including the fetch-path-determining `locale` —
// without needing to hydrate the component.
// ---------------------------------------------------------------------------

function renderAreaForLocale(locale: string, isFallback?: boolean): string {
  const ctx = makeFakeChromeContext({
    settings: { bodyFootUtilArea: false },
  });
  const DocHistoryArea = createDocHistoryArea(ctx);

  return render(
    <DocHistoryArea slug="guide" locale={locale} isFallback={isFallback} />,
  );
}

describe("createDocHistoryArea displayLocale / locale prop contract (#4073)", () => {
  it("default-locale page: fetch-path locale omitted, displayLocale set to the page locale", () => {
    const html = renderAreaForLocale("en");

    // `locale` is the storage-path parameter — omitted (bare-path fetch) for
    // the default locale, matching the pre-existing fetch semantics.
    // (SSR HTML-escapes the data-props JSON, so quotes are &quot; entities.)
    expect(html).not.toMatch(/&quot;locale&quot;:/);
    // `displayLocale` is the new, separate display-only prop.
    expect(html).toContain("&quot;displayLocale&quot;:&quot;en&quot;");
  });

  it("non-default-locale page: fetch-path locale AND displayLocale both set to the page locale", () => {
    const html = renderAreaForLocale("ja");

    expect(html).toContain("&quot;locale&quot;:&quot;ja&quot;");
    expect(html).toContain("&quot;displayLocale&quot;:&quot;ja&quot;");
  });

  it("EN-fallback JA page: fetch-path locale still omitted (bare-path fetch), but displayLocale stays JA", () => {
    const html = renderAreaForLocale("ja", true);

    // isFallback swaps the storage-path lookup to defaultLocale, so the
    // fetch-relevant `locale` prop is omitted exactly like the default-locale
    // case above — the history JSON lives only at the bare path.
    expect(html).not.toMatch(/&quot;locale&quot;:/);
    // The visitor is still reading the JA page — displayLocale must stay
    // "ja", not silently fall back to "en" like the storage path did.
    expect(html).toContain("&quot;displayLocale&quot;:&quot;ja&quot;");
  });
});
