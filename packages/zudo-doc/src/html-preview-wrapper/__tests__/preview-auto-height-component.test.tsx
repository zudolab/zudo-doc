/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { act } from "preact/test-utils";
import { render } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HtmlPreview } from "../html-preview.js";

class TrackingResizeObserver {
  static instances: TrackingResizeObserver[] = [];

  disconnected = false;

  constructor(_callback: ResizeObserverCallback) {
    TrackingResizeObserver.instances.push(this);
  }

  observe(): void {}
  unobserve(): void {}

  disconnect(): void {
    this.disconnected = true;
  }
}

function mount(props: Parameters<typeof HtmlPreview>[0]): HTMLIFrameElement {
  act(() => render(<HtmlPreview {...props} />, document.body));
  return document.querySelector("iframe") as HTMLIFrameElement;
}

function installReadableFrame(iframe: HTMLIFrameElement, bodyHeight: number) {
  Object.defineProperty(iframe.contentDocument!.body, "scrollHeight", {
    configurable: true,
    value: bodyHeight,
  });
  Object.defineProperty(iframe.contentWindow!, "ResizeObserver", {
    configurable: true,
    value: TrackingResizeObserver,
  });
}

afterEach(() => {
  act(() => render(null, document.body));
  document.body.innerHTML = "";
  TrackingResizeObserver.instances = [];
  vi.restoreAllMocks();
});

describe("HtmlPreview auto-height component lifecycle", () => {
  it("binds a readable iframe whose load completed before the effect", () => {
    const body = document.createElement("body");
    const root = document.createElement("html");
    Object.defineProperty(body, "scrollHeight", { value: 240 });
    const loadedDocument = {
      body,
      documentElement: root,
      readyState: "complete",
    } as unknown as Document;
    const iframeWindow = {
      ResizeObserver: TrackingResizeObserver,
    } as unknown as Window;
    vi.spyOn(HTMLIFrameElement.prototype, "contentDocument", "get").mockReturnValue(
      loadedDocument,
    );
    vi.spyOn(HTMLIFrameElement.prototype, "contentWindow", "get").mockReturnValue(
      iframeWindow,
    );

    const iframe = mount({ html: "<p>already loaded</p>" });

    expect(iframe.style.height).toBe("256px");
    expect(TrackingResizeObserver.instances).toHaveLength(1);
  });

  it("starts auto-height when a fixed height is removed without another load", () => {
    const body = document.createElement("body");
    const root = document.createElement("html");
    Object.defineProperty(body, "scrollHeight", { value: 240 });
    vi.spyOn(HTMLIFrameElement.prototype, "contentDocument", "get").mockReturnValue(
      {
        body,
        documentElement: root,
        readyState: "complete",
      } as unknown as Document,
    );
    vi.spyOn(HTMLIFrameElement.prototype, "contentWindow", "get").mockReturnValue(
      { ResizeObserver: TrackingResizeObserver } as unknown as Window,
    );
    const iframe = mount({ html: "<p>same srcdoc</p>", height: 333 });
    expect(iframe.style.height).toBe("333px");

    act(() => render(<HtmlPreview html="<p>same srcdoc</p>" />, document.body));

    expect(iframe.style.height).toBe("256px");
    expect(TrackingResizeObserver.instances).toHaveLength(1);
  });

  it("keeps a fixed height exact and never installs an observer", () => {
    const iframe = mount({ html: "<p>hello</p>", height: 333 });
    installReadableFrame(iframe, 500);

    act(() => {
      iframe.dispatchEvent(new Event("load"));
    });

    expect(iframe.style.height).toBe("333px");
    expect(TrackingResizeObserver.instances).toHaveLength(0);
  });

  it("keeps fullHeight without fixed height observer-free", () => {
    const iframe = mount({ html: "<main>hello</main>", fullHeight: true });
    installReadableFrame(iframe, 500);

    act(() => {
      iframe.dispatchEvent(new Event("load"));
    });

    expect(iframe.style.height).toBe("200px");
    expect(TrackingResizeObserver.instances).toHaveLength(0);
  });

  it("disconnects the active observer when the component unmounts", () => {
    const iframe = mount({ html: "<p>hello</p>" });
    installReadableFrame(iframe, 240);
    act(() => {
      iframe.dispatchEvent(new Event("load"));
    });
    const observer = TrackingResizeObserver.instances[0]!;

    act(() => render(null, document.body));

    expect(observer.disconnected).toBe(true);
  });
});
