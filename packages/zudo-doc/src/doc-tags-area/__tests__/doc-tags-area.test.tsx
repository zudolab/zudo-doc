/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
import { describe, expect, it } from "vitest";
import { createDocTagsArea } from "../index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";
import { renderNav } from "../../nav-indexing/__tests__/helpers.js";

describe("createDocTagsArea", () => {
  it("renders deduplicated locale-aware tag links through owned SSR", () => {
    const DocTagsArea = createDocTagsArea(makeFakeChromeContext({
      settings: {
        docTags: true,
        tagVocabulary: false,
        tagGovernance: "off",
      },
    }));
    const root = renderNav(DocTagsArea({
      slug: "guide/setup",
      locale: "ja",
      tags: ["preact", "preact", "island"],
    }));

    expect(root.querySelectorAll("a[href]")).toHaveLength(2);
    expect(root.querySelector('a[href="/ja/docs/tags/preact"]')?.textContent).toContain("#preact");
    expect(root.querySelector('a[href="/ja/docs/tags/island"]')?.textContent).toContain("#island");
  });

  it("renders nothing when tag output is disabled or empty", () => {
    const disabled = createDocTagsArea(makeFakeChromeContext({ settings: { docTags: false } }));
    const enabled = createDocTagsArea(makeFakeChromeContext({
      settings: { docTags: true, tagVocabulary: false, tagGovernance: "off" },
    }));
    expect(disabled({ slug: "guide/setup", locale: "en", tags: ["preact"] })).toBeNull();
    expect(enabled({ slug: "guide/setup", locale: "en", tags: [] })).toBeNull();
  });
});
