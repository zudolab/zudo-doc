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
): string {
  const ctx = makeFakeChromeContext({
    settings: {
      githubUrl: GITHUB_URL,
      bodyFootUtilArea: { viewSourceLink: true },
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
