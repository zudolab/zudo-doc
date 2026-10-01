/** @jsxRuntime automatic */
import { describe, expect, it } from "vitest";
import { renderSsr as render } from "../../__tests__/helpers/zudo-react.js";
import { SearchWidget } from "../index.js";

describe("SearchWidget server rendering", () => {
  it("keeps spellcheck disabled and emits the trusted static custom-element script", () => {
    const html = render(
      <SearchWidget
        base="/"
        placeholderText="Search docs"
        shortcutHint="to open search from anywhere"
        resultCountTemplate="{count} results"
        searchLabel="Open search"
        searchUnavailableText="Search unavailable"
        loadingIndexText="Loading search index"
        noResultsText="No results found"
      />,
    );

    expect(html).toContain('<input');
    expect(html).toContain('spellcheck="false"');
    expect(html).toContain('data-search-input');
    expect(html).toContain('customElements.define("site-search"');
  });
});
