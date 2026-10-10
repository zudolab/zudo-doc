/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  flushAll,
  renderIsland,
} from "../../__tests__/helpers/zudo-react.js";
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

const disposers: Array<() => void> = [];

function fakeDocument(bodyHeight: number, readyState = "complete"): Document {
  const body = document.createElement("body");
  const root = document.createElement("html");
  Object.defineProperty(body, "scrollHeight", {
    configurable: true,
    value: bodyHeight,
  });
  return { body, documentElement: root, readyState } as unknown as Document;
}

function installReadableFrame(iframe: HTMLIFrameElement, bodyHeight: number) {
  vi.spyOn(HTMLIFrameElement.prototype, "contentDocument", "get").mockReturnValue(
    fakeDocument(bodyHeight),
  );
  vi.spyOn(HTMLIFrameElement.prototype, "contentWindow", "get").mockReturnValue(
    { ResizeObserver: TrackingResizeObserver } as unknown as Window,
  );
  return iframe;
}

async function mount(props: Parameters<typeof HtmlPreview>[0]) {
  const view = await renderIsland(HtmlPreview, props, {
    identity: {
      component: "HtmlPreview",
      build: "preview-auto-height-component",
    },
  });
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    view.dispose();
  };
  disposers.push(dispose);
  expect(view.diagnostics).toEqual([]);
  const iframe = view.root.querySelector("iframe");
  expect(iframe).not.toBeNull();
  return { view, iframe: iframe as HTMLIFrameElement, dispose };
}

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.replaceChildren();
  TrackingResizeObserver.instances = [];
  vi.restoreAllMocks();
});

describe("HtmlPreview auto-height component lifecycle", () => {
  it("binds a readable iframe whose load completed before activation", async () => {
    vi.spyOn(HTMLIFrameElement.prototype, "contentDocument", "get").mockReturnValue(
      fakeDocument(240),
    );
    vi.spyOn(HTMLIFrameElement.prototype, "contentWindow", "get").mockReturnValue(
      { ResizeObserver: TrackingResizeObserver } as unknown as Window,
    );

    const { iframe } = await mount({ html: "<p>already loaded</p>" });

    expect(iframe.style.height).toBe("256px");
    expect(TrackingResizeObserver.instances).toHaveLength(1);
  });

  it("uses auto-height for a fresh island when no fixed height is supplied", async () => {
    vi.spyOn(HTMLIFrameElement.prototype, "contentDocument", "get").mockReturnValue(
      fakeDocument(240),
    );
    vi.spyOn(HTMLIFrameElement.prototype, "contentWindow", "get").mockReturnValue(
      { ResizeObserver: TrackingResizeObserver } as unknown as Window,
    );

    const fixed = await mount({ html: "<p>same srcdoc</p>", height: 333 });
    expect(fixed.iframe.style.height).toBe("333px");
    fixed.dispose();

    const automatic = await mount({ html: "<p>same srcdoc</p>" });

    expect(automatic.iframe.style.height).toBe("256px");
    expect(TrackingResizeObserver.instances).toHaveLength(1);
  });

  it("keeps a fixed height exact and never installs an observer", async () => {
    const { iframe } = await mount({ html: "<p>hello</p>", height: 333 });
    installReadableFrame(iframe, 500);

    iframe.dispatchEvent(new Event("load"));
    await flushAll();

    expect(iframe.style.height).toBe("333px");
    expect(TrackingResizeObserver.instances).toHaveLength(0);
  });

  it("keeps fullHeight without a fixed height observer-free", async () => {
    const { iframe } = await mount({ html: "<main>hello</main>", fullHeight: true });
    installReadableFrame(iframe, 500);

    iframe.dispatchEvent(new Event("load"));
    await flushAll();

    expect(iframe.style.height).toBe("200px");
    expect(TrackingResizeObserver.instances).toHaveLength(0);
  });

  it("disconnects the active observer when the island is disposed", async () => {
    const documentSpy = vi
      .spyOn(HTMLIFrameElement.prototype, "contentDocument", "get")
      .mockReturnValue(fakeDocument(240, "loading"));
    vi.spyOn(HTMLIFrameElement.prototype, "contentWindow", "get").mockReturnValue(
      { ResizeObserver: TrackingResizeObserver } as unknown as Window,
    );
    const { iframe, dispose } = await mount({ html: "<p>hello</p>" });
    documentSpy.mockReturnValue(fakeDocument(240));

    iframe.dispatchEvent(new Event("load"));
    await flushAll();
    const observer = TrackingResizeObserver.instances[0]!;
    expect(observer.disconnected).toBe(false);

    dispose();

    expect(observer.disconnected).toBe(true);
    expect(iframe.isConnected).toBe(false);
  });
});
