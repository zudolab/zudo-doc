/** @jsxRuntime automatic */
import { describe, expect, it } from "vitest";
import { h } from "@takazudo/zfb/zudo-react";
import { renderSsr as render } from "../../__tests__/helpers/zudo-react.js";
import { BodyFootUtilArea, DEFAULT_VIEW_SOURCE_LABEL } from "../body-foot-util-area.js";
import { EditLink } from "../edit-link.js";

describe("BodyFootUtilArea and EditLink server rendering", () => {
  it("omits an empty utility area and renders a supplied source link", () => {
    expect(render(<BodyFootUtilArea />)).toBe("");
    expect(
      render(<BodyFootUtilArea sourceUrl="https://github.com/example/docs" />),
    ).toContain(DEFAULT_VIEW_SOURCE_LABEL);
  });

  it("accepts a prebuilt history description and preserves the edit-link label", () => {
    const html = render(
      <BodyFootUtilArea docHistoryIsland={h("div", { "data-history": true })} />,
    );

    expect(html).toContain('data-history');
    expect(html).toContain("Revision History");
    expect(render(<EditLink editUrl="/edit/page" />)).toContain("Edit this page");
  });
});
