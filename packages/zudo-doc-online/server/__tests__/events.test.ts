import { describe, expect, it, vi } from "vitest";

import {
  EventBus,
  MAX_SUBSCRIBERS_PER_PROJECT,
  SubscriberLimitError,
  type ChangeEvent,
} from "../events";

const outlineChanged: ChangeEvent = { type: "outline-changed", revision: 4 };

describe("EventBus", () => {
  it("delivers only to subscribers of the named project", () => {
    const bus = new EventBus();
    const mine = vi.fn();
    const other = vi.fn();
    bus.subscribe("aurora-docs", mine);
    bus.subscribe("other", other);

    bus.publish("aurora-docs", outlineChanged);

    expect(mine).toHaveBeenCalledWith(outlineChanged);
    expect(other).not.toHaveBeenCalled();
  });

  it("stops delivering after unsubscribe, and tolerates a second call", () => {
    const bus = new EventBus();
    const listener = vi.fn();
    const unsubscribe = bus.subscribe("p", listener);

    unsubscribe();
    unsubscribe();
    bus.publish("p", outlineChanged);

    expect(listener).not.toHaveBeenCalled();
    expect(bus.subscriberCount("p")).toBe(0);
  });

  it("drops its per-project bookkeeping once the last subscriber leaves", () => {
    const bus = new EventBus();
    const unsubscribe = bus.subscribe("p", () => undefined);
    expect(bus.trackedProjects).toBe(1);
    unsubscribe();
    expect(bus.trackedProjects).toBe(0);
  });

  it("keeps notifying the rest when one subscriber throws", () => {
    const bus = new EventBus();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const survivor = vi.fn();
    bus.subscribe("p", () => {
      throw new Error("listener exploded");
    });
    bus.subscribe("p", survivor);

    bus.publish("p", outlineChanged);

    expect(survivor).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it("refuses a subscriber past the per-project cap", () => {
    const bus = new EventBus();
    for (let index = 0; index < MAX_SUBSCRIBERS_PER_PROJECT; index += 1) {
      bus.subscribe("p", () => undefined);
    }
    expect(() => bus.subscribe("p", () => undefined)).toThrow(SubscriberLimitError);
    expect(bus.subscriberCount("p")).toBe(MAX_SUBSCRIBERS_PER_PROJECT);
  });

  it("carries the mutation's origin through to the listener", () => {
    const bus = new EventBus();
    const listener = vi.fn();
    bus.subscribe("p", listener);

    bus.publish("p", { type: "page-changed", pageId: "page-1", revision: 9, origin: "tab-a" });

    expect(listener).toHaveBeenCalledWith({
      type: "page-changed",
      pageId: "page-1",
      revision: 9,
      origin: "tab-a",
    });
  });
});
