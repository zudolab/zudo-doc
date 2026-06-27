/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * SSG marker test for the package-default body-end islands (#2406 / #2401(c)).
 *
 * `createBodyEndIslands({ settings })` returns the `BodyEndIslands` component
 * that package-owned routes render at their body-end slot. This proves that:
 *
 *   1. With a package-island flag ON, the corresponding skip-ssr island marker
 *      (`data-zfb-island-skip-ssr="<Component>"`) AND its SSR fallback markup
 *      reach the static HTML.
 *   2. With a flag OFF, that marker + landmark is ABSENT (matches host gating —
 *      a feature-off route ships neither a dead marker nor a misleading
 *      landmark, zudolab/zudo-doc#2058).
 *   3. The three flags gate independently.
 *
 * The skip-ssr marker name is derived by zfb's `captureComponentName` from each
 * island's pinned `displayName` (AiChatModal / ImageEnlarge / MermaidEnlarge).
 *
 * Pattern: src/image-enlarge/__tests__/image-enlarge-ssg.test.tsx.
 */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { createBodyEndIslands } from "../index.js";

const ALL_ON = { aiAssistant: true, imageEnlarge: true, mermaid: true };
const ALL_OFF = { aiAssistant: false, imageEnlarge: false, mermaid: false };

function renderIslands(settings: {
  aiAssistant: boolean;
  imageEnlarge: boolean;
  mermaid: boolean;
}): string {
  const BodyEndIslands = createBodyEndIslands({ settings });
  return render(<BodyEndIslands basePath="/" />);
}

describe("BodyEndIslands — all package-island flags ON", () => {
  const html = renderIslands(ALL_ON);

  it("emits the AiChatModal skip-ssr island marker", () => {
    expect(html).toContain('data-zfb-island-skip-ssr="AiChatModal"');
  });

  it("emits the sr-only 'AI Assistant' landmark heading + body-label fallback", () => {
    expect(html).toContain("AI Assistant");
    expect(html).toContain("Ask a question about the documentation.");
  });

  it("emits the ImageEnlarge skip-ssr island marker + dialog-shell fallback", () => {
    expect(html).toContain('data-zfb-island-skip-ssr="ImageEnlarge"');
    expect(html).toContain("zd-enlarge-dialog");
  });

  it("emits the MermaidEnlarge skip-ssr island marker + dialog-shell fallback", () => {
    expect(html).toContain('data-zfb-island-skip-ssr="MermaidEnlarge"');
    expect(html).toContain("zd-mermaid-dialog");
  });
});

describe("BodyEndIslands — all package-island flags OFF", () => {
  const html = renderIslands(ALL_OFF);

  it("emits no island markers when every flag is off", () => {
    expect(html).not.toContain("data-zfb-island-skip-ssr");
    expect(html).not.toContain('data-zfb-island="');
  });

  it("emits neither the AI Assistant landmark nor any enlarge dialog", () => {
    expect(html).not.toContain("AI Assistant");
    expect(html).not.toContain("zd-enlarge-dialog");
    expect(html).not.toContain("zd-mermaid-dialog");
  });
});

describe("BodyEndIslands — flags gate independently", () => {
  it("imageEnlarge ON alone emits only the ImageEnlarge marker", () => {
    const html = renderIslands({
      aiAssistant: false,
      imageEnlarge: true,
      mermaid: false,
    });
    expect(html).toContain('data-zfb-island-skip-ssr="ImageEnlarge"');
    expect(html).not.toContain('data-zfb-island-skip-ssr="AiChatModal"');
    expect(html).not.toContain('data-zfb-island-skip-ssr="MermaidEnlarge"');
  });

  it("aiAssistant ON alone emits only the AiChatModal marker + landmark", () => {
    const html = renderIslands({
      aiAssistant: true,
      imageEnlarge: false,
      mermaid: false,
    });
    expect(html).toContain('data-zfb-island-skip-ssr="AiChatModal"');
    expect(html).toContain("AI Assistant");
    expect(html).not.toContain('data-zfb-island-skip-ssr="ImageEnlarge"');
    expect(html).not.toContain('data-zfb-island-skip-ssr="MermaidEnlarge"');
  });
});
