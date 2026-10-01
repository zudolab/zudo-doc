/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
import { describe, expect, it } from "vitest";
import { renderIsland, renderSsr } from "../../__tests__/helpers/zudo-react.js";

const code = "\nfirst\nsecond";
function PreFixture() {
  return <pre>{code}</pre>;
}

describe("native pre leading newline hydration", () => {
  it("hydrates the browser-parsed text without an extra or missing LF", async () => {
    expect(renderSsr(<PreFixture />)).toBe("<pre>\n\nfirst\nsecond</pre>");
    const view = await renderIsland(PreFixture, {}, {
      identity: { component: "PreFixture", build: "test" },
      // happy-dom leaves the protection LF in place; browsers consume one LF
      // immediately after <pre>. Simulate that parser step before hydration.
      beforeActivate(root) {
        const pre = root.querySelector("pre")!;
        pre.firstChild!.textContent = pre.firstChild!.textContent!.slice(1);
      },
    });
    try {
      expect(view.diagnostics).toEqual([]);
      expect(view.root.querySelector("pre")?.textContent).toBe(code);
    } finally {
      view.dispose();
    }
  });
});
