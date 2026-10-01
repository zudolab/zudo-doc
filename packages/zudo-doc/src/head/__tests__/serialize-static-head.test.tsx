/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
import { describe, expect, it } from "vitest";
import { h } from "@takazudo/zfb/zudo-react";
import { serializeStaticHead } from "../serialize-static-head.js";

describe("serializeStaticHead", () => {
  it("escapes delimiter text and attributes while preserving head order", () => {
    const title = `A <title> & \"quoted\" 'text'`;
    const attribute = `x\" onload=\"alert(1)\" <tag> & 'value'`;
    const html = serializeStaticHead([
      <title>{title}</title>,
      h("meta", { property: "og:description", content: attribute }),
      h("link", {
        rel: "preload",
        as: "font",
        href: "/font.woff2",
        integrity: "sha384-test&value",
        crossorigin: "anonymous",
      }),
    ]);
    const parsed = new DOMParser().parseFromString(`<html><head>${html}</head><body></body></html>`, "text/html");

    expect(parsed.head.querySelector("title")?.textContent).toBe(title);
    expect(parsed.head.querySelector("meta")?.content).toBe(attribute);
    expect(parsed.head.querySelector("meta")?.getAttribute("property")).toBe("og:description");
    expect(parsed.head.querySelector("link")?.getAttribute("as")).toBe("font");
    expect(parsed.head.querySelector("link")?.getAttribute("integrity")).toBe("sha384-test&value");
    expect(html.indexOf("<title>")).toBeLessThan(html.indexOf("<meta "));
    expect(html.indexOf("<meta ")).toBeLessThan(html.indexOf("<link "));
    expect(parsed.head.querySelector("script")).toBeNull();
  });

  it("accepts guarded static script and style payloads", () => {
    const html = serializeStaticHead([
      <style rawHtml={"body{color:var(--zd-fg)}"} />,
      <script rawHtml={"window.ready=true;"} />,
    ]);
    expect(html).toBe("<style>body{color:var(--zd-fg)}</style><script>window.ready=true;</script>");
  });

  it.each([
    ["script close tag", <script rawHtml={'window.x="</ScRiPt><script>";'} />],
    ["style close tag", <style rawHtml={"a{content:'</style>'}"} />],
    ["reserved island marker", <script rawHtml={'window.x="data-zfb-island=\"x\"";'} />],
    ["event handler", h("link", { rel: "preload", as: "font", href: "/a.woff2", onerror: "alert(1)" })],
  ])("rejects %s", (_label, node) => {
    expect(() => serializeStaticHead(node)).toThrow();
  });
});
