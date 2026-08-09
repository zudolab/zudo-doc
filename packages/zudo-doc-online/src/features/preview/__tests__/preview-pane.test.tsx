// @vitest-environment jsdom
/**
 * `<PreviewPane>` mounted for real. Render timing is driven by an injected
 * `PreviewRenderLoop` (fake `render` + fake timers) so specs stay
 * deterministic without waiting on a real wasm call — the wasm's own
 * behavior is covered end-to-end in render-runtime.test.ts.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "preact";
import { act } from "preact/test-utils";
import PreviewPane, { type PreviewPaneProps } from "../preview-pane";
import { PreviewRenderLoop } from "../render-runtime";
import { EditorContentTicker } from "../../editor/use-editor-content";

const mountedContainers: HTMLElement[] = [];

function mount(props: PreviewPaneProps): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    render(<PreviewPane {...props} />, container);
  });
  mountedContainers.push(container);
  return container;
}

afterEach(() => {
  for (const container of mountedContainers.splice(0)) {
    render(null, container);
    container.remove();
  }
});

describe("PreviewPane", () => {
  it("shows the loading skeleton before the first render settles", () => {
    const loop = new PreviewRenderLoop({ render: vi.fn(() => new Promise<string>(() => {})) });
    const container = mount({
      pageId: "page-a",
      title: "Installation",
      path: "getting-started/installation",
      markdown: "# Hello",
      renderLoop: loop,
    });

    expect(container.textContent).toContain("Loading preview engine…");
  });

  it("renders the produced HTML into .zdo-prose once the render settles", async () => {
    vi.useFakeTimers();
    try {
      const loop = new PreviewRenderLoop({
        delayMs: 10,
        render: vi.fn().mockResolvedValue('<h1>Hi</h1><div class="zdo-admonition zdo-admonition-tip">…</div>'),
      });
      const container = mount({
        pageId: "page-a",
        title: "Installation",
        path: "getting-started/installation",
        markdown: "# Hi",
        renderLoop: loop,
      });

      await act(async () => {
        vi.advanceTimersByTime(10);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(container.textContent).not.toContain("Loading preview engine…");
      const prose = container.querySelector(".zdo-prose");
      expect(prose?.innerHTML).toContain("<h1>Hi</h1>");
      expect(container.querySelector(".zdo-admonition-tip")).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("intercepts a same-page hash-link click instead of letting it change location.hash (SPA router guard)", async () => {
    vi.useFakeTimers();
    const originalHash = window.location.hash;
    try {
      const loop = new PreviewRenderLoop({
        delayMs: 10,
        render: vi
          .fn()
          .mockResolvedValue(
            '<h2 id="prerequisites">Prerequisites<a href="#prerequisites" class="hash-link"></a></h2>',
          ),
      });
      const container = mount({
        pageId: "page-a",
        title: "Installation",
        path: "getting-started/installation",
        markdown: "## Prerequisites",
        renderLoop: loop,
      });

      await act(async () => {
        vi.advanceTimersByTime(10);
        await Promise.resolve();
        await Promise.resolve();
      });

      const anchor = container.querySelector<HTMLAnchorElement>("a.hash-link");
      expect(anchor).not.toBeNull();
      // jsdom does not implement scrollIntoView at all (a known gap, not a
      // stubbed no-op), so vi.spyOn has nothing to wrap -- install a plain
      // mock function directly.
      const scrollMock = vi.fn();
      HTMLElement.prototype.scrollIntoView = scrollMock;

      act(() => {
        anchor?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });

      // The click must never reach the browser's default hash-navigation --
      // the app's global hashchange listener treats an unknown hash as the
      // outline route, which would silently abandon the editor.
      expect(window.location.hash).toBe(originalHash);
      expect(scrollMock).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      window.location.hash = originalHash;
      // @ts-expect-error -- undo the direct prototype assignment above so it
      // doesn't leak into other tests in this file (jsdom has no original
      // implementation to fall back to).
      delete HTMLElement.prototype.scrollIntoView;
    }
  });

  it("shows a quiet error strip while keeping the last good preview visible", async () => {
    vi.useFakeTimers();
    try {
      const render1 = vi
        .fn()
        .mockResolvedValueOnce("<p>good content</p>")
        .mockRejectedValueOnce(new Error("The preview renderer reported a failure."));
      const loop = new PreviewRenderLoop({ delayMs: 10, render: render1 });
      const container = mount({
        pageId: "page-a",
        title: "Installation",
        path: "getting-started/installation",
        markdown: "v1",
        renderLoop: loop,
      });

      await act(async () => {
        vi.advanceTimersByTime(10);
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(container.textContent).toContain("good content");

      // A second, broken render must not blank out the still-good preview.
      loop.schedule("v2, broken");
      await act(async () => {
        vi.advanceTimersByTime(10);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(container.textContent).toContain("good content");
      const alert = container.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain("The preview renderer reported a failure.");
    } finally {
      vi.useRealTimers();
    }
  });

  it("prefers a matching editor content tick over the markdown prop", async () => {
    vi.useFakeTimers();
    try {
      const ticker = new EditorContentTicker({ delayMs: 0 });
      const render1 = vi.fn().mockResolvedValue("<p>rendered</p>");
      const loop = new PreviewRenderLoop({ delayMs: 10, render: render1 });

      ticker.publishNow({ pageId: "page-a", markdown: "text from the ticker", token: 1 });

      mount({
        pageId: "page-a",
        title: "Installation",
        path: "getting-started/installation",
        markdown: "stale prop text",
        ticker,
        renderLoop: loop,
      });

      await act(async () => {
        vi.advanceTimersByTime(10);
        await Promise.resolve();
      });

      expect(render1).toHaveBeenCalledWith("text from the ticker");
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to the markdown prop when the tick belongs to a different page", async () => {
    vi.useFakeTimers();
    try {
      const ticker = new EditorContentTicker({ delayMs: 0 });
      const render1 = vi.fn().mockResolvedValue("<p>rendered</p>");
      const loop = new PreviewRenderLoop({ delayMs: 10, render: render1 });

      // A tick from a page the user has already navigated away from.
      ticker.publishNow({ pageId: "page-b", markdown: "belongs to page b", token: 1 });

      mount({
        pageId: "page-a",
        title: "Installation",
        path: "getting-started/installation",
        markdown: "page a's own body",
        ticker,
        renderLoop: loop,
      });

      await act(async () => {
        vi.advanceTimersByTime(10);
        await Promise.resolve();
      });

      expect(render1).toHaveBeenCalledWith("page a's own body");
    } finally {
      vi.useRealTimers();
    }
  });
});
