/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { TabItem } from "../tab-item";

describe("<TabItem />", () => {
  it("renders a hidden tabpanel with label-derived data-tab-value when value is omitted", () => {
    const html = render(
      <TabItem label="Apple">
        <p>fruit body</p>
      </TabItem>,
    );
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('data-tab-value="Apple"');
    expect(html).toContain('data-tab-label="Apple"');
    // Non-default TabItem keeps `hidden` so only the chosen panel paints.
    expect(html).toContain("hidden");
    expect(html).not.toContain("data-tab-default");
    expect(html).toContain("<p>fruit body</p>");
  });

  it("uses an explicit value over the label when both are provided", () => {
    const html = render(<TabItem label="Apple" value="apple-id" />);
    expect(html).toContain('data-tab-value="apple-id"');
    expect(html).toContain('data-tab-label="Apple"');
  });

  it("encodes default={true} as a present data-tab-default attribute", () => {
    const html = render(<TabItem label="Banana" default />);
    // preact-render-to-string emits boolean-style bare attributes for
    // empty strings (`data-tab-default `); the Astro template emitted
    // `data-tab-default=""`. Both forms satisfy `[data-tab-default]`
    // selectors and `getAttribute("data-tab-default")` reads as "".
    expect(html).toMatch(/data-tab-default(=""|\s|>)/);
  });

  it("omits the hidden attribute when default={true} so the SSR HTML paints the active panel", () => {
    // Wave 11 (zudolab/zudo-doc#1355): the default panel must be
    // visible from SSR so the no-JS path and pre-init paint both show
    // the chosen tab. preact-render-to-string emits `hidden` as a bare
    // attribute when truthy and omits it entirely when undefined, so
    // the simple substring assertion below is sufficient.
    const html = render(<TabItem label="Banana" default />);
    expect(html).not.toContain("hidden");
  });

  it("omits data-tab-default when default is false or not set", () => {
    const html = render(<TabItem label="Cherry" default={false} />);
    expect(html).not.toContain("data-tab-default");
  });
});
