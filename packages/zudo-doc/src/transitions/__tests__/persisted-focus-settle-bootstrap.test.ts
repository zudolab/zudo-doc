import { describe, expect, it, vi } from "vitest";
import { Window } from "happy-dom";
import { buildPersistedFocusSettleBootstrap } from "../persisted-focus-settle-bootstrap.js";
import { BEFORE_SWAP_EVENT } from "../page-events.js";

type SwapEvent = Event & { swap?: unknown };

function setup() {
  const window = new Window();
  const document = window.document;
  document.body.innerHTML = `<main><a id="body-link" href="/a">body</a></main><footer data-zfb-transition-persist="footer-en"><a id="footer-link" href="/b">footer</a></footer>`;
  const install = new Function("document", buildPersistedFocusSettleBootstrap()) as (doc: unknown) => void;
  install(document);
  return { window, document, install };
}

function focus(document: Window["document"], id: string) {
  const el = document.getElementById(id) as unknown as HTMLElement;
  el.focus();
  return el;
}

// Counts the bootstrap's forced layout read (documentElement.offsetHeight).
function spyLayoutReads(document: Window["document"]) {
  const read = vi.fn(() => 0);
  Object.defineProperty(document.documentElement, "offsetHeight", { configurable: true, get: read });
  return read;
}

function dispatchSwap(window: Window, swap: unknown): SwapEvent {
  const event = new window.Event(BEFORE_SWAP_EVENT) as unknown as SwapEvent;
  event.swap = swap;
  window.document.dispatchEvent(event as never);
  return event;
}

describe("persisted focus settle bootstrap", () => {
  it("wraps the swap once, preserving receiver, arguments and return value, then reads layout", () => {
    const { window, document } = setup();
    focus(document, "footer-link");
    const reads = spyLayoutReads(document);
    const calls: Array<{ self: unknown; args: unknown[] }> = [];
    const original = function (this: unknown, ...args: unknown[]) {
      calls.push({ self: this, args });
      expect(reads).not.toHaveBeenCalled();
      return "swapped";
    };
    const event = dispatchSwap(window, original);
    expect(event.swap).not.toBe(original);
    const result = (event.swap as (...a: unknown[]) => unknown).call(event, 1, 2);
    expect(result).toBe("swapped");
    expect(calls).toEqual([{ self: event, args: [1, 2] }]);
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it("installs one listener across script re-execution", () => {
    const { window, document, install } = setup();
    install(document);
    install(document);
    focus(document, "footer-link");
    const reads = spyLayoutReads(document);
    const original = vi.fn();
    const event = dispatchSwap(window, original);
    (event.swap as () => void).call(event);
    expect(original).toHaveBeenCalledTimes(1);
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it("propagates swap errors without a layout read", () => {
    const { window, document } = setup();
    focus(document, "footer-link");
    const reads = spyLayoutReads(document);
    const failure = new Error("swap failed");
    const event = dispatchSwap(window, () => {
      throw failure;
    });
    expect(() => (event.swap as () => void).call(event)).toThrow(failure);
    expect(reads).not.toHaveBeenCalled();
  });

  it("skips the layout read when focus is outside persisted chrome", () => {
    const { window, document } = setup();
    focus(document, "body-link");
    const reads = spyLayoutReads(document);
    const original = vi.fn();
    const event = dispatchSwap(window, original);
    (event.swap as () => void).call(event);
    expect(original).toHaveBeenCalledTimes(1);
    expect(reads).not.toHaveBeenCalled();
  });

  it("skips the layout read when nothing is focused", () => {
    const { window, document } = setup();
    const reads = spyLayoutReads(document);
    const original = vi.fn();
    const event = dispatchSwap(window, original);
    (event.swap as () => void).call(event);
    expect(original).toHaveBeenCalledTimes(1);
    expect(reads).not.toHaveBeenCalled();
  });

  it("reads focus when the swap runs, not when before-swap is dispatched", () => {
    const { window, document } = setup();
    focus(document, "body-link");
    const reads = spyLayoutReads(document);
    const event = dispatchSwap(window, vi.fn());
    // e.g. focus moves into the footer during the fallback old-page animation
    focus(document, "footer-link");
    (event.swap as () => void).call(event);
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it("ignores events without a callable swap", () => {
    const { window, document } = setup();
    focus(document, "footer-link");
    expect(dispatchSwap(window, undefined).swap).toBeUndefined();
  });

  it("skips the layout read when the focused element was replaced or disconnected", () => {
    const { window, document } = setup();
    const link = focus(document, "footer-link");
    const reads = spyLayoutReads(document);
    const event = dispatchSwap(window, () => {
      link.remove();
    });
    (event.swap as () => void).call(event);
    expect(reads).not.toHaveBeenCalled();
  });

  it("skips the layout read when focus moved to another element during the swap", () => {
    const { window, document } = setup();
    focus(document, "footer-link");
    const reads = spyLayoutReads(document);
    const event = dispatchSwap(window, () => {
      focus(document, "body-link");
    });
    (event.swap as () => void).call(event);
    expect(reads).not.toHaveBeenCalled();
  });

  it("does nothing for a navigation cancelled before its swap", () => {
    const { window, document } = setup();
    focus(document, "footer-link");
    const reads = spyLayoutReads(document);
    const original = vi.fn();
    dispatchSwap(window, original);
    expect(original).not.toHaveBeenCalled();
    expect(reads).not.toHaveBeenCalled();
  });

  it("keeps a later listener's custom swap in charge", () => {
    const { window, document } = setup();
    focus(document, "footer-link");
    const reads = spyLayoutReads(document);
    const custom = vi.fn();
    document.addEventListener(BEFORE_SWAP_EVENT, (ev) => {
      (ev as unknown as SwapEvent).swap = custom;
    });
    const original = vi.fn();
    const event = dispatchSwap(window, original);
    expect(event.swap).toBe(custom);
    (event.swap as () => void).call(event);
    expect(original).not.toHaveBeenCalled();
    expect(reads).not.toHaveBeenCalled();
  });
});
