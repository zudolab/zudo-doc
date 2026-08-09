// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { render } from "preact";
import { Shell } from "../shell.js";

describe("Shell", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the wordmark, project name, nav links, and TZ avatar", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    render(
      <Shell route={{ name: "outline" }}>
        <div>content</div>
      </Shell>,
      container,
    );

    expect(container.textContent).toContain("zudo-doc online");
    expect(container.textContent).toContain("Aurora Docs");
    expect(container.textContent).toContain("Outline");
    expect(container.textContent).toContain("Editor");
    expect(container.textContent).toContain("TZ");
    expect(container.textContent).toContain("content");

    render(null, container);
    container.remove();
  });

  it("marks the nav link matching the current route with aria-current", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    render(
      <Shell route={{ name: "editor", pageId: "installation" }}>
        <div />
      </Shell>,
      container,
    );

    const outlineLink = container.querySelector('a[href="#/outline"]');
    const editorLink = container.querySelector('a[href^="#/editor/"]');

    expect(outlineLink?.getAttribute("aria-current")).toBeNull();
    expect(editorLink?.getAttribute("aria-current")).toBe("page");

    render(null, container);
    container.remove();
  });
});
