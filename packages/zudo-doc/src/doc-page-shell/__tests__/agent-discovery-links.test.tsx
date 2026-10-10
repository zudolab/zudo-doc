/** @jsxRuntime automatic */
import "../../__tests__/fixtures/install-island-metadata.js";

import { describe, expect, it } from "vitest";
import { renderSsr as render } from "../../__tests__/helpers/zudo-react.js";
import { agentPageKey } from "../../agent-docs/identity.js";
import { createDocPageShell } from "../index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";

const props = {
  kind: "entry" as const,
  locale: "ja",
  slug: "custom-route",
  title: "Custom page",
  breadcrumbs: [],
  prev: null,
  next: null,
  headings: [],
  navSection: undefined,
  sidebarPersistKey: undefined,
  currentPath: "/manual/docs/custom-route",
  versionSwitcher: null,
};

describe("createDocPageShell — agent discovery links", () => {
  it("renders the page Markdown and llms.txt links with a non-root base", () => {
    const ctx = makeFakeChromeContext({
      settings: { base: "/manual/", agentExport: true, llmsTxt: true },
      overrides: {
        withBase: (path: string) =>
          path === "/" ? "/manual/" : `/manual${path}`,
      },
    });
    const DocPageShell = createDocPageShell(ctx);
    const pageKey = agentPageKey("ja", "custom-route");
    const html = render(
      <DocPageShell
        {...props}
        alternateLinks={[
          {
            rel: "alternate",
            type: "text/markdown",
            href: `/manual/agent/v1/pages/${pageKey}.md`,
          },
        ]}
      />,
    );

    // #4430: native zudo-react serializes HTML void elements without an XML slash.
    expect(html).toContain(
      `<link rel="alternate" href="/manual/agent/v1/pages/${pageKey}.md" type="text/markdown">`,
    );
    expect(html).toContain(
      '<link rel="alternate" href="/manual/llms.txt" type="text/plain">',
    );
  });

  it("emits no discovery links when agent export is off", () => {
    const ctx = makeFakeChromeContext({
      settings: { base: "/manual/", agentExport: false, llmsTxt: true },
      overrides: {
        withBase: (path: string) =>
          path === "/" ? "/manual/" : `/manual${path}`,
      },
    });
    const DocPageShell = createDocPageShell(ctx);
    const html = render(<DocPageShell {...props} />);

    expect(html).not.toContain('type="text/markdown"');
    expect(html).not.toContain('href="/manual/llms.txt"');
  });
});
