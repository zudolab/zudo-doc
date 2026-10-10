/** @jsxRuntime automatic */
import { describe, expect, it } from "vitest";
import { Details } from "../details.js";

import { renderSsr as serialize } from "../../__tests__/helpers/zudo-react.js";

describe("Details", () => {
  it("renders a <details> element", () => {
    const html = serialize(<Details />);
    expect(html).toMatch(/<details[^>]*>/);
    expect(html).toContain("</details>");
  });

  it("renders a <summary> with the default title", () => {
    const html = serialize(<Details />);
    expect(html).toContain("<summary");
    expect(html).toContain("Details");
  });

  it("renders a custom title in <summary>", () => {
    const html = serialize(<Details title="Show more" />);
    expect(html).toContain("Show more");
  });

  it("renders children inside the content div", () => {
    const html = serialize(<Details title="Info">Hello world</Details>);
    expect(html).toContain("Hello world");
  });

  it("applies the zd-content class to the inner div", () => {
    const html = serialize(<Details />);
    expect(html).toContain("zd-content");
  });

  it("applies border and rounded classes to <details>", () => {
    const html = serialize(<Details />);
    expect(html).toContain("border");
    expect(html).toContain("rounded-lg");
  });
});
