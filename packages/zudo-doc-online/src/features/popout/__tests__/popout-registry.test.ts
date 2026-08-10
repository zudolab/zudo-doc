import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PopoutRegistry,
  popoutHashUrl,
  popoutWindowName,
  type PopoutWindowLike,
} from "../popout-registry";
import { POPOUT_PAGEHIDE_EVENT, type PopoutChannelLike } from "../popout-bus";

function makeFakeWindow(): PopoutWindowLike & { setClosed: (value: boolean) => void } {
  let closed = false;
  return {
    get closed() {
      return closed;
    },
    close: vi.fn(() => {
      closed = true;
    }),
    setClosed: (value: boolean) => {
      closed = value;
    },
  };
}

function makeFakeChannel(): PopoutChannelLike & { emit: (data: unknown) => void } {
  let handler: ((event: MessageEvent) => void) | null = null;
  return {
    postMessage: vi.fn(),
    close: vi.fn(),
    get onmessage() {
      return handler;
    },
    set onmessage(value) {
      handler = value;
    },
    emit(data: unknown) {
      handler?.({ data } as MessageEvent);
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("popoutWindowName / popoutHashUrl", () => {
  it("names the window per-project-per-pageId and percent-encodes both", () => {
    expect(popoutWindowName("aurora-docs", "getting-started/installation")).toBe(
      "zdo-popout-aurora-docs-getting-started%2Finstallation",
    );
    expect(popoutHashUrl("aurora-docs", "getting-started/installation")).toBe(
      "#/p/aurora-docs/popped-out/preview/getting-started%2Finstallation",
    );
  });

  it("two different projects never collide on the same pageId", () => {
    expect(popoutWindowName("proj-a", "page-1")).not.toBe(
      popoutWindowName("proj-b", "page-1"),
    );
  });
});

describe("PopoutRegistry.open", () => {
  it("registers the entry, starts polling, and notifies subscribers on first open", () => {
    const win = makeFakeWindow();
    const opener = vi.fn().mockReturnValue(win);
    const registry = new PopoutRegistry({ windowOpener: opener, channel: null });
    const listener = vi.fn();
    registry.subscribe(listener);

    registry.open("proj-a", "page-a");

    expect(opener).toHaveBeenCalledWith(
      "#/p/proj-a/popped-out/preview/page-a",
      "zdo-popout-proj-a-page-a",
      "width=900,height=600,popup",
    );
    expect(registry.isOpen("proj-a", "page-a")).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("re-clicking the same pageId is idempotent — no duplicate registration, no extra notification", () => {
    const win = makeFakeWindow();
    const opener = vi.fn().mockReturnValue(win);
    const registry = new PopoutRegistry({ windowOpener: opener, channel: null });
    const listener = vi.fn();

    registry.open("proj-a", "page-a");
    registry.subscribe(listener);
    registry.open("proj-a", "page-a"); // re-click / Focus

    expect(opener).toHaveBeenCalledTimes(2);
    expect(registry.isOpen("proj-a", "page-a")).toBe(true);
    expect(listener).not.toHaveBeenCalled();
  });

  it("does not register anything when the opener returns null (popup blocked)", () => {
    const opener = vi.fn().mockReturnValue(null);
    const registry = new PopoutRegistry({ windowOpener: opener, channel: null });
    const listener = vi.fn();
    registry.subscribe(listener);

    registry.open("proj-a", "page-a");

    expect(registry.isOpen("proj-a", "page-a")).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it("focus is an alias for open — re-invokes the opener by the same name", () => {
    const win = makeFakeWindow();
    const opener = vi.fn().mockReturnValue(win);
    const registry = new PopoutRegistry({ windowOpener: opener, channel: null });

    registry.open("proj-a", "page-a");
    registry.focus("proj-a", "page-a");

    expect(opener).toHaveBeenCalledTimes(2);
    expect(opener.mock.calls[1]?.[1]).toBe("zdo-popout-proj-a-page-a");
  });
});

describe("PopoutRegistry close detection — poll path", () => {
  it("unregisters and notifies once winRef.closed flips true on the next 1s tick", () => {
    const win = makeFakeWindow();
    const opener = vi.fn().mockReturnValue(win);
    const registry = new PopoutRegistry({ windowOpener: opener, channel: null });
    registry.open("proj-a", "page-a");
    const listener = vi.fn();
    registry.subscribe(listener);

    win.setClosed(true);
    vi.advanceTimersByTime(1000);

    expect(registry.isOpen("proj-a", "page-a")).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps polling (no false unregister) while the window stays open", () => {
    const win = makeFakeWindow();
    const opener = vi.fn().mockReturnValue(win);
    const registry = new PopoutRegistry({ windowOpener: opener, channel: null });
    registry.open("proj-a", "page-a");
    const listener = vi.fn();
    registry.subscribe(listener);

    vi.advanceTimersByTime(5000);

    expect(registry.isOpen("proj-a", "page-a")).toBe(true);
    expect(listener).not.toHaveBeenCalled();
  });

  it("stops polling a pageId once it has been unregistered (bringBack) — no stray timer fires later", () => {
    const win = makeFakeWindow();
    const opener = vi.fn().mockReturnValue(win);
    const registry = new PopoutRegistry({ windowOpener: opener, channel: null });
    registry.open("proj-a", "page-a");
    registry.bringBack("proj-a", "page-a");
    const listener = vi.fn();
    registry.subscribe(listener);

    vi.advanceTimersByTime(5000);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("PopoutRegistry close detection — BroadcastChannel path", () => {
  it("unregisters immediately on a matching popout-pagehide message, ahead of the next poll tick", () => {
    const win = makeFakeWindow();
    const opener = vi.fn().mockReturnValue(win);
    const channel = makeFakeChannel();
    const registry = new PopoutRegistry({ windowOpener: opener, channel });
    registry.open("proj-a", "page-a");
    const listener = vi.fn();
    registry.subscribe(listener);

    channel.emit({ event: POPOUT_PAGEHIDE_EVENT, windowName: "zdo-popout-proj-a-page-a" });

    expect(registry.isOpen("proj-a", "page-a")).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("ignores a pagehide message for a windowName it has no entry for", () => {
    const win = makeFakeWindow();
    const opener = vi.fn().mockReturnValue(win);
    const channel = makeFakeChannel();
    const registry = new PopoutRegistry({ windowOpener: opener, channel });
    registry.open("proj-a", "page-a");
    const listener = vi.fn();
    registry.subscribe(listener);

    channel.emit({ event: POPOUT_PAGEHIDE_EVENT, windowName: "zdo-popout-proj-a-unrelated-page" });

    expect(registry.isOpen("proj-a", "page-a")).toBe(true);
    expect(listener).not.toHaveBeenCalled();
  });

  it("ignores a malformed / unrelated channel message without throwing", () => {
    const win = makeFakeWindow();
    const opener = vi.fn().mockReturnValue(win);
    const channel = makeFakeChannel();
    const registry = new PopoutRegistry({ windowOpener: opener, channel });
    registry.open("proj-a", "page-a");

    expect(() => channel.emit("not an envelope")).not.toThrow();
    expect(() => channel.emit({ event: "some-other-event", windowName: "zdo-popout-proj-a-page-a" })).not.toThrow();
    expect(registry.isOpen("proj-a", "page-a")).toBe(true);
  });
});

describe("PopoutRegistry.bringBack", () => {
  it("closes the window via the registry's own reference and unregisters", () => {
    const win = makeFakeWindow();
    const opener = vi.fn().mockReturnValue(win);
    const registry = new PopoutRegistry({ windowOpener: opener, channel: null });
    registry.open("proj-a", "page-a");
    const listener = vi.fn();
    registry.subscribe(listener);

    registry.bringBack("proj-a", "page-a");

    expect(win.close).toHaveBeenCalledTimes(1);
    expect(registry.isOpen("proj-a", "page-a")).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("is a no-op for a pageId that isn't registered", () => {
    const registry = new PopoutRegistry({ windowOpener: vi.fn(), channel: null });
    expect(() => registry.bringBack("proj-a", "nope")).not.toThrow();
  });

  it("still unregisters even when winRef.close() throws", () => {
    const win = makeFakeWindow();
    win.close = vi.fn(() => {
      throw new Error("already gone");
    });
    const opener = vi.fn().mockReturnValue(win);
    const registry = new PopoutRegistry({ windowOpener: opener, channel: null });
    registry.open("proj-a", "page-a");

    expect(() => registry.bringBack("proj-a", "page-a")).not.toThrow();
    expect(registry.isOpen("proj-a", "page-a")).toBe(false);
  });
});

describe("PopoutRegistry.subscribe", () => {
  it("stops notifying after unsubscribe", () => {
    const win = makeFakeWindow();
    const opener = vi.fn().mockReturnValue(win);
    const registry = new PopoutRegistry({ windowOpener: opener, channel: null });
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);
    unsubscribe();

    registry.open("proj-a", "page-a");

    expect(listener).not.toHaveBeenCalled();
  });
});
