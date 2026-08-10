// Compat spike (bootstrap sub-issue #3328): calls the public package-root
// @takazudo/zfb-md-wasm `renderHtml` on a fixture with a heading, a fenced
// ts code block, and a `:::note` directive. The preview sub-issue (#3338)
// reads the finding recorded below instead of re-discovering it.
//
// FINDING: renderHtml emits a literal, UNEXPANDED `<Note>...</Note>` tag for
// `:::note` — i.e. `<Note>A note directive body.</Note>`, using the exact
// component name from `pipeline.features.directives.note` ("Note") as a bare
// HTML tag name wrapping the directive's inner content verbatim. It is NOT
// resolved into real admonition markup (no CSS classes, no icon/label
// wrapper) — renderHtml is an HTML-*fragment* renderer, not a JSX compiler,
// so directives never reach zfb's <Note>/<Tip>/... component implementations.
// A browser renders `<Note>` as an unstyled unknown custom element; its text
// content still displays. The preview pane (#3338) must either post-process
// this tag into real admonition markup itself, or accept the plain/unstyled
// fallback. See the snapshot in __snapshots__/wasm-spike.test.ts.snap for the
// exact fixture output (also: only the `##` heading gets an
// id+hash-link anchor here, not the `#` heading — a `headingMarkerToc`-style
// feature was not enabled in this spike's options).
import { describe, expect, it } from "vitest";
import { renderHtml } from "@takazudo/zfb-md-wasm";

const FIXTURE = `# Spike fixture

## Heading

\`\`\`ts
const answer: number = 42;
\`\`\`

:::note
A note directive body.
:::
`;

describe("@takazudo/zfb-md-wasm renderHtml directive + highlight spike", () => {
  it("emits hi- classes for the fenced code block and records the directive-output finding", async () => {
    const result = await renderHtml(FIXTURE, {
      filename: "spike.mdx",
      pipeline: {
        codeHighlight: { mode: "class" },
        features: {
          directives: {
            note: "Note",
            tip: "Tip",
            info: "Info",
            warning: "Warning",
            danger: "Danger",
            caution: "Caution",
            details: "Details",
          },
          githubAlerts: true,
        },
      },
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.html).not.toBeNull();
    expect(result.html).toContain("hi-");
    expect(result.html).toMatchSnapshot();
  });
});
