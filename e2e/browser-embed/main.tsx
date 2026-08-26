/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { Fragment, h, type ComponentType, type VNode } from "preact";
import { render as renderToString } from "preact-render-to-string";
import { renderHtml } from "@takazudo/zfb-md-wasm/render";
import { createRouteContextPayload } from "@takazudo/zudo-doc/route-context-payload";
import { createRouteContext } from "@takazudo/zudo-doc/route-context";
import { createChrome } from "@takazudo/zudo-doc/chrome";
import type { DocPageEntry } from "@takazudo/zudo-doc/doc-page-props";

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

function htmlToPreact(html: string, components: Record<string, unknown>): VNode {
  const document = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const componentByTag = new Map(
    Object.entries(components).map(([name, component]) => [name.toLowerCase(), component]),
  );

  function convert(node: Node): VNode | string | null {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (!(node instanceof Element)) return null;

    const props = Object.fromEntries(
      Array.from(node.attributes).map(({ name, value }) => [
        name === "class" ? "className" : name,
        value,
      ]),
    );
    const component = componentByTag.get(node.localName) as ComponentType | undefined;
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
      htmlToPreact(mdWasmHtml, components),
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

  document.querySelector("#browser-embed-root")!.innerHTML = renderToString(page);
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
