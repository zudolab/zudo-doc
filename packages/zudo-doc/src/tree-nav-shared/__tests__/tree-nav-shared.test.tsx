import { describe, expect, it } from "vitest";
import { renderSsr } from "../../__tests__/helpers/zudo-react.js";
import { CategoryLinkIcon, ConnectorLines, connectorLeft } from "../index.js";

describe("tree navigation shared primitives", () => {
  it("computes the depth offset and emits an accessible decorative icon", () => {
    expect(connectorLeft(2)).toBe("calc(2 * clamp(0.8rem, 1.2vw, 1.625rem) + clamp(0.2rem, 0.3vw, 0.5rem))");
    const html = renderSsr(<CategoryLinkIcon class="w-icon-sm" />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('class="shrink-0 w-icon-sm"');
  });

  it("renders no connector at root and clips the last vertical line", () => {
    expect(renderSsr(<ConnectorLines depth={0} isLast={false} />)).toBe("");
    const html = renderSsr(<ConnectorLines depth={2} isLast={true} topPad="1rem" />);
    expect(html).toContain("calc(100% - calc(1rem + 0.5lh))");
    expect(html).toContain("border-t border-dashed border-muted");
  });
});
