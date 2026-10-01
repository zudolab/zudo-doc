/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { h } from "@takazudo/zfb/zudo-react";
import { renderIsland, renderSsr, flushAll } from "../../__tests__/helpers/zudo-react.js";
import { PreviewBase } from "../preview-base.js";

const props = {
  title: "Example",
  srcdoc: "<!doctype html><html><body><p>Trusted author preview</p></body></html>",
  sandbox: "allow-same-origin",
  syncDelay: 0,
  codeBlocks: [{ language: "html", title: "HTML", code: "<p>Trusted author preview</p>" }],
};

class TrackingResizeObserver {
  static instances: TrackingResizeObserver[] = [];
  disconnected = false;
  constructor(_callback: ResizeObserverCallback) { TrackingResizeObserver.instances.push(this); }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void { this.disconnected = true; }
}

afterEach(() => {
  TrackingResizeObserver.instances = [];
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("HtmlPreview v3 smoke", () => {
  it("server renders the host, hydrates one iframe, switches viewport and toggles code", async () => {
    const server = renderSsr(h(PreviewBase, props));
    expect(server).toContain("data-zd-html-preview-frame-host");
    expect(server).toContain("min-height:200px");
    expect(server).not.toContain("<iframe");

    const body = document.createElement("body");
    Object.defineProperty(body, "scrollHeight", { value: 240 });
    vi.spyOn(HTMLIFrameElement.prototype, "contentDocument", "get").mockReturnValue({
      body,
      readyState: "complete",
    } as unknown as Document);
    vi.spyOn(HTMLIFrameElement.prototype, "contentWindow", "get").mockReturnValue({
      ResizeObserver: TrackingResizeObserver,
    } as unknown as Window);

    const view = await renderIsland(PreviewBase, props, {
      identity: { component: "PreviewBase", build: "html-preview-smoke" },
    });
    try {
      expect(view.diagnostics).toEqual([]);
      const host = view.root.querySelector("[data-zd-html-preview-frame-host]")!;
      const iframe = host.querySelector("iframe")!;
      expect(host.querySelectorAll("iframe")).toHaveLength(1);
      expect(iframe.getAttribute("sandbox")).toBe("allow-same-origin");
      expect(iframe.srcdoc).toBe(props.srcdoc);
      expect(iframe.style.height).toBe("256px");
      expect(TrackingResizeObserver.instances).toHaveLength(1);

      const buttons = view.root.querySelectorAll<HTMLButtonElement>('[role="group"] button');
      buttons[0]!.click();
      await flushAll();
      expect(buttons[0]!.getAttribute("aria-pressed")).toBe("true");
      expect(buttons[2]!.getAttribute("aria-pressed")).toBe("false");
      expect((host.parentElement as HTMLElement).style.width).toBe("320px");

      const toggle = view.root.querySelector<HTMLButtonElement>('[aria-expanded]')!;
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      toggle.click();
      await flushAll();
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      expect(view.root.textContent).toContain("<p>Trusted author preview</p>");
      toggle.click();
      await flushAll();
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
    } finally {
      const observer = TrackingResizeObserver.instances[0];
      const frame = view.root.querySelector("iframe");
      view.dispose();
      expect(observer?.disconnected).toBe(true);
      expect(frame?.isConnected).toBe(false);
    }
  });
});
