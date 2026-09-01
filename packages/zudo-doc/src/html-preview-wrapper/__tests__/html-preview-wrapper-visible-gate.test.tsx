/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "preact";
import { act } from "preact/test-utils";

import { HtmlPreviewWrapperInner } from "../index.js";

type ObserverCallback = (
  entries: IntersectionObserverEntry[],
  observer: IntersectionObserver,
) => void;

let observerCallback: ObserverCallback | undefined;
let activeObserver: FakeIntersectionObserver | undefined;

class FakeIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];
  readonly disconnect = vi.fn();
  readonly observe = vi.fn();
  readonly takeRecords = vi.fn(() => []);
  readonly unobserve = vi.fn();

  constructor(callback: ObserverCallback) {
    observerCallback = callback;
    activeObserver = this;
  }
}

function deferredProps() {
  return {
    html: "<p>deferred</p>",
    height: 360,
    // Private runtime data serialized by HtmlPreviewWrapper. Deliberately cast
    // through unknown: the public inner declaration must not expose this gate.
    __zudoDocVisibleMount: true,
  } as unknown as Parameters<typeof HtmlPreviewWrapperInner>[0];
}

function intersect(isIntersecting: boolean): void {
  const callback = observerCallback;
  const observer = activeObserver;
  if (!callback || !observer) throw new Error("observer was not installed");
  callback(
    [{ isIntersecting } as IntersectionObserverEntry],
    observer,
  );
}

afterEach(() => {
  act(() => render(null, document.body));
  document.body.replaceChildren();
  observerCallback = undefined;
  activeObserver = undefined;
  vi.unstubAllGlobals();
});

describe("HtmlPreviewWrapperInner visible mount gate", () => {
  it("keeps only the inert reservation until intersection, then mounts once", () => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);

    act(() => {
      render(<HtmlPreviewWrapperInner {...deferredProps()} />, document.body);
    });

    expect(document.querySelector("iframe")).toBeNull();
    const reservation = document.querySelector(
      "[data-zd-html-preview-reservation]",
    );
    expect(reservation?.getAttribute("aria-hidden")).toBe("true");
    expect((reservation as HTMLElement).style.height).toBe("360px");
    expect(activeObserver?.observe).toHaveBeenCalledTimes(1);
    expect(activeObserver?.observe).toHaveBeenCalledWith(reservation);

    act(() => intersect(false));
    expect(document.querySelector("iframe")).toBeNull();

    act(() => intersect(true));
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
    expect(document.querySelector("iframe")?.hasAttribute("loading")).toBe(
      false,
    );
    expect(
      document.querySelector("[data-zd-html-preview-reservation]"),
    ).toBeNull();
    expect(activeObserver?.disconnect).toHaveBeenCalled();

    act(() => intersect(true));
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
  });

  it("fails open immediately when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);

    act(() => {
      render(<HtmlPreviewWrapperInner {...deferredProps()} />, document.body);
    });

    expect(document.querySelectorAll("iframe")).toHaveLength(1);
    expect(
      document.querySelector("[data-zd-html-preview-reservation]"),
    ).toBeNull();
  });

  it("disconnects a pending observer when the inner component unmounts", () => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    act(() => {
      render(<HtmlPreviewWrapperInner {...deferredProps()} />, document.body);
    });
    const observer = activeObserver;

    act(() => render(null, document.body));

    expect(observer?.disconnect).toHaveBeenCalledTimes(1);
    act(() => intersect(true));
    expect(document.querySelector("iframe")).toBeNull();
  });
});
