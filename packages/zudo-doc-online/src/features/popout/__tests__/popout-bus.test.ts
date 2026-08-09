import { describe, expect, it, vi } from "vitest";
import {
  POPOUT_PAGEHIDE_EVENT,
  announcePopoutClose,
  createPopoutChannel,
  parsePopoutEnvelope,
} from "../popout-bus";

describe("parsePopoutEnvelope", () => {
  it("parses a well-formed envelope with windowName and payload", () => {
    expect(parsePopoutEnvelope({ event: "popout-pagehide", windowName: "zdo-popout-p1" })).toEqual(
      { event: "popout-pagehide", windowName: "zdo-popout-p1" },
    );
  });

  it("parses an envelope with no windowName/payload, omitting the optional keys", () => {
    expect(parsePopoutEnvelope({ event: "ping" })).toEqual({ event: "ping" });
  });

  it.each([null, undefined, "a string", 42, [], {}, { event: 1 }, { windowName: "x" }])(
    "returns null for malformed input: %j",
    (input) => {
      expect(parsePopoutEnvelope(input)).toBeNull();
    },
  );
});

describe("createPopoutChannel", () => {
  it("returns null when BroadcastChannel is unavailable", () => {
    const original = globalThis.BroadcastChannel;
    // @ts-expect-error -- deliberately removing the global to test the fallback path.
    delete globalThis.BroadcastChannel;
    try {
      expect(createPopoutChannel()).toBeNull();
    } finally {
      globalThis.BroadcastChannel = original;
    }
  });

  it("returns a real BroadcastChannel instance when available", () => {
    const channel = createPopoutChannel();
    expect(channel).not.toBeNull();
    channel?.close();
  });
});

describe("announcePopoutClose", () => {
  it("posts a popout-pagehide envelope and closes the channel", () => {
    const posted: unknown[] = [];
    const receiver = new BroadcastChannel("zdo-popout");
    receiver.onmessage = (event) => posted.push(event.data);

    announcePopoutClose("zdo-popout-page-a");

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(posted).toEqual([{ event: POPOUT_PAGEHIDE_EVENT, windowName: "zdo-popout-page-a" }]);
        receiver.close();
        resolve();
      }, 0);
    });
  });

  it("swallows a postMessage failure instead of throwing", () => {
    const original = globalThis.BroadcastChannel;
    class ThrowingChannel {
      close = vi.fn();
      postMessage(): void {
        throw new Error("channel is closing");
      }
    }
    // @ts-expect-error -- test double, not a full BroadcastChannel.
    globalThis.BroadcastChannel = ThrowingChannel;
    try {
      expect(() => announcePopoutClose("zdo-popout-page-a")).not.toThrow();
    } finally {
      globalThis.BroadcastChannel = original;
    }
  });
});
