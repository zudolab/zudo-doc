/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
import { describe, expect, it } from "vitest";
import { h } from "@takazudo/zfb/zudo-react";
import { renderSsr } from "../../__tests__/helpers/zudo-react.js";
import { DocLayout } from "../doc-layout.js";

describe("DocLayout static head serialization", () => {
  it("keeps the full head valid and preserves ClientRouter then prepaint order", () => {
    const title = `Docs <Shell> & \"quotes\"`;
    const prepaint = `(function(){window.headReady=true;})();`;
    const html = renderSsr(
      <DocLayout
        title={title}
        description={`Description <with> & \"delimiters\"`}
        head={
          <>
            <script rawHtml={prepaint} />
            {h("meta", {
              property: "og:site_name",
              content: `Site \"name\" & <example>`,
            })}
          </>
        }
        header={<header>Header</header>}
        main={<p>Body</p>}
      />,
    );
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const head = parsed.head;

    expect(parsed.title).toBe(title);
    expect(head.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
      `Description <with> & \"delimiters\"`,
    );
    expect(head.querySelector('meta[property="og:site_name"]')?.getAttribute("content")).toBe(
      `Site \"name\" & <example>`,
    );
    expect(head.querySelector('meta[name="zfb-view-transitions-enabled"]')).not.toBeNull();
    expect(head.querySelector('meta[name="zfb-preserve-html-attrs"]')?.getAttribute("content")).toBe(
      "data-sidebar-hidden data-theme data-theme-pack style data-toc-hidden data-asset-details-hidden",
    );
    expect(head.querySelector("script")?.textContent).toBe(prepaint);
    expect(parsed.body.querySelector("script")).toBeNull();

    const routerStyle = html.indexOf(".zfb-route-announcer");
    const prepaintIndex = html.indexOf(prepaint);
    const ogIndex = html.indexOf('property="og:site_name"');
    expect(routerStyle).toBeGreaterThan(-1);
    expect(prepaintIndex).toBeGreaterThan(routerStyle);
    expect(ogIndex).toBeGreaterThan(prepaintIndex);
  });

  it("keeps the persisted desktop sidebar on its existing aside wrapper", () => {
    const html = renderSsr(
      <DocLayout
        title="Persisted sidebar"
        header={<header>Header</header>}
        sidebarPersistKey="sidebar-en-guides"
        sidebar={<nav>Guides</nav>}
        main={<p>Body</p>}
      />,
    );
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const aside = parsed.querySelector("aside#desktop-sidebar");

    expect(aside?.getAttribute("aria-label")).toBe("Documentation sidebar");
    expect(aside?.getAttribute("data-zfb-transition-persist")).toBe("sidebar-en-guides");
    expect(aside?.classList.contains("lg:block")).toBe(true);
    expect(parsed.querySelector(".zd-sidebar-content-wrapper")).not.toBeNull();
  });
});
