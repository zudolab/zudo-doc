/** @jsxRuntime automatic */
import { Fragment, h } from "@takazudo/zfb/zudo-react";
import type { Component, Description } from "@takazudo/zfb/zudo-react";
import { renderToString } from "@takazudo/zfb/zudo-react/server";
import { withIslandTestContext } from "@takazudo/zfb/zudo-react/testing";
import { renderHtml } from "@takazudo/zfb-md-wasm/render";
import { createRouteContextPayload } from "@takazudo/zudo-doc/route-context-payload";
import { createRouteContext } from "@takazudo/zudo-doc/route-context";
import { createChrome } from "@takazudo/zudo-doc/chrome";
import type { DocPageEntry } from "@takazudo/zudo-doc/doc-page-props";
import { SidebarToggle } from "@takazudo/zudo-doc/sidebar-toggle-island";
import { SidebarTree } from "@takazudo/zudo-doc/sidebar-tree-island";

const ISLAND_BUILD = "browser-embed-v1";

const MARKDOWN = `:::note[Heads up]
First paragraph with **bold**, \`code\`, and [a link](https://example.com).

Second paragraph in the note.
:::

> [!IMPORTANT]
> First important paragraph.
>
> Second important paragraph.`;

const DIRECTIVES = {
  note: "Note",
  tip: "Tip",
  info: "Info",
  warning: "Warning",
  danger: "Danger",
  caution: "Caution",
};

function htmlToDescription(html: string, components: Record<string, unknown>): Description {
  const document = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const componentByTag = new Map(
    Object.entries(components).map(([name, component]) => [name.toLowerCase(), component]),
  );

  function convert(node: Node): Description | string | null {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (!(node instanceof Element)) return null;

    const props = Object.fromEntries(
      Array.from(node.attributes).map(({ name, value }) => [name, value]),
    );
    const component = componentByTag.get(node.localName) as Component | undefined;
    const children = Array.from(node.childNodes).map(convert);
    return h(component ?? node.localName, props, children);
  }

  return h(Fragment, null, Array.from(document.body.childNodes).map(convert));
}

declare global {
  interface Window {
    browserEmbed: {
      mdWasmHtml: string;
      applyFoundryThemePack(): Promise<void>;
    };
  }
}

async function main() {
  const result = await renderHtml(MARKDOWN, {
    filename: "browser-embed.mdx",
    pipeline: {
      features: {
        directives: DIRECTIVES,
        githubAlerts: true,
      },
    },
  });
  if (result.html === null || result.diagnostics.some(({ severity }) => severity === "error")) {
    throw new Error(`md-wasm render failed: ${JSON.stringify(result.diagnostics)}`);
  }

  const mdWasmHtml = result.html;
  const entry = {
    id: "browser-embed",
    slug: "browser-embed",
    collection: "docs",
    module_specifier: "browser-embed.mdx",
    data: {
      title: "Browser embed integration",
      description: "Rendered entirely in a browser bundle",
    },
    Content: ({ components }: { components: Record<string, unknown> }) =>
      htmlToDescription(mdWasmHtml, components),
  } as unknown as DocPageEntry;

  const payload = createRouteContextPayload({
    siteTitle: "Browser Embed Docs",
    settings: {
      colorMode: false,
      designTokenPanel: false,
      docHistory: false,
      headerRightItems: [],
      packageOwnedRoutes: false,
    },
  });
  const routeContext = createRouteContext(payload, { stableDocs: () => [entry] });
  const chrome = createChrome(routeContext);
  const page = chrome.renderDocPage(
    {
      kind: "entry",
      entry,
      breadcrumbs: [{ label: "Browser embed integration" }],
      prev: null,
      next: null,
      headings: [],
    },
    { locale: "en" },
  );

  const html = withIslandTestContext(
    {
      // These are the two Island children in this feature-disabled document:
      // the header's mobile drawer and the desktop documentation sidebar.
      components: [SidebarToggle, SidebarTree],
      build: ISLAND_BUILD,
    },
    () => renderToString(page),
  );

  // The helper must restore the prior scanner context after the callback.
  // A second public SDK render without a context fails when its first Island is
  // reached; this checks restoration without inspecting the SDK's private global.
  let contextRestored = false;
  try {
    renderToString(page);
  } catch (error) {
    contextRestored =
      error instanceof TypeError && error.message.startsWith("ZR_ISLAND_IDENTITY:");
    if (!contextRestored) throw error;
  }
  if (!contextRestored) {
    throw new Error("withIslandTestContext did not restore the prior scanner context");
  }

  document.querySelector("#browser-embed-root")!.innerHTML = html;
  document.documentElement.dataset.browserEmbedReady = "";

  window.browserEmbed = {
    mdWasmHtml,
    async applyFoundryThemePack() {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/browser-embed/theme-packs/foundry/pack.css";
      link.dataset.zdThemePackCss = "";
      await new Promise<void>((resolve, reject) => {
        link.addEventListener("load", () => resolve(), { once: true });
        link.addEventListener("error", () => reject(new Error("Foundry pack failed to load")), {
          once: true,
        });
        document.head.append(link);
      });
      document.documentElement.dataset.themePack = "foundry";
    },
  };
}

main().catch((error) => {
  document.documentElement.dataset.browserEmbedError = String(error);
  throw error;
});
