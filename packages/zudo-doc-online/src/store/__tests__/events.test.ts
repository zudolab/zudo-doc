import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bindCoordinatorToEvents, ProjectEventsClient, type ChangeEvent } from "../events";
import { RevisionCoordinator } from "../revision-coordinator";
import { createFakeEventSourceFactory, type FakeEventSourceHandle } from "./support";

let handle: FakeEventSourceHandle;
let client: ProjectEventsClient;

beforeEach(() => {
  vi.useFakeTimers();
  handle = createFakeEventSourceFactory();
  client = new ProjectEventsClient({
    projectSlug: "docs",
    clientId: "tab-a",
    createEventSource: handle.factory,
    reconnectBaseMs: 100,
    reconnectMaxMs: 800,
  });
});

afterEach(() => {
  client.close();
  vi.useRealTimers();
});

describe("ProjectEventsClient — own-origin classification", () => {
  it("tags an event whose origin matches this client's id as own", () => {
    client.connect();
    const received: { event: ChangeEvent; origin: string }[] = [];
    client.onEvent((envelope) => received.push(envelope));

    handle.instances[0]?.emitMessage({ type: "outline-changed", revision: 2, origin: "tab-a" });

    expect(received).toEqual([
      { event: { type: "outline-changed", revision: 2, origin: "tab-a" }, origin: "own" },
    ]);
  });

  it("tags an event from a different client id as remote", () => {
    client.connect();
    const received: { event: ChangeEvent; origin: string }[] = [];
    client.onEvent((envelope) => received.push(envelope));

    handle.instances[0]?.emitMessage({ type: "page-changed", pageId: "page-1", revision: 3, origin: "tab-b" });

    expect(received[0]?.origin).toBe("remote");
  });

  it("tags an event with no origin (a non-browser client) as remote", () => {
    client.connect();
    const received: { event: ChangeEvent; origin: string }[] = [];
    client.onEvent((envelope) => received.push(envelope));

    handle.instances[0]?.emitMessage({ type: "outline-changed", revision: 4 });

    expect(received[0]?.origin).toBe("remote");
  });

  it("ignores a malformed message rather than notifying listeners with garbage", () => {
    client.connect();
    const listener = vi.fn();
    client.onEvent(listener);

    handle.instances[0]?.emitRawMessage("not json");
    handle.instances[0]?.emitMessage({ type: "unknown-type", revision: 1 });
    handle.instances[0]?.emitMessage({ type: "outline-changed" }); // missing revision

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("ProjectEventsClient — reconnect", () => {
  it("does not fire onReconnect for the initial connect", () => {
    const reconnectListener = vi.fn();
    client.onReconnect(reconnectListener);

    client.connect();
    handle.instances[0]?.emitOpen();

    expect(reconnectListener).not.toHaveBeenCalled();
  });

  it("closes the failed source and opens a fresh one after the backoff delay", () => {
    client.connect();
    handle.instances[0]?.emitOpen();
    expect(handle.instances).toHaveLength(1);

    handle.instances[0]?.emitError();
    expect(handle.instances[0]?.closed).toBe(true);
    expect(handle.instances).toHaveLength(1); // not yet — still waiting out the backoff

    vi.advanceTimersByTime(100);
    expect(handle.instances).toHaveLength(2);
  });

  it("fires onReconnect once the reconnect actually opens, not when it merely starts", () => {
    const reconnectListener = vi.fn();
    client.onReconnect(reconnectListener);

    client.connect();
    handle.instances[0]?.emitOpen();
    handle.instances[0]?.emitError();
    vi.advanceTimersByTime(100);

    expect(reconnectListener).not.toHaveBeenCalled();
    handle.instances[1]?.emitOpen();
    expect(reconnectListener).toHaveBeenCalledTimes(1);
  });

  it("backs off exponentially, capped at reconnectMaxMs", () => {
    client.connect();
    handle.instances[0]?.emitOpen();

    // 1st error: 100ms
    handle.instances[0]?.emitError();
    vi.advanceTimersByTime(99);
    expect(handle.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(handle.instances).toHaveLength(2);

    // 2nd error (no successful open in between): 200ms
    handle.instances[1]?.emitError();
    vi.advanceTimersByTime(199);
    expect(handle.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(handle.instances).toHaveLength(3);

    // 3rd error: 400ms
    handle.instances[2]?.emitError();
    vi.advanceTimersByTime(399);
    expect(handle.instances).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(handle.instances).toHaveLength(4);

    // 4th error: uncapped doubling would be 800ms, which happens to equal the
    // ceiling here — advance one short of it to prove it is not yet 1600ms.
    handle.instances[3]?.emitError();
    vi.advanceTimersByTime(799);
    expect(handle.instances).toHaveLength(4);
    vi.advanceTimersByTime(1);
    expect(handle.instances).toHaveLength(5);

    // 5th error: uncapped doubling would be 1600ms — proves the 800ms ceiling
    // actually clamps something, not just coincides with it.
    handle.instances[4]?.emitError();
    vi.advanceTimersByTime(800);
    expect(handle.instances).toHaveLength(6);
  });

  it("resets the backoff counter after a successful reconnect", () => {
    client.connect();
    handle.instances[0]?.emitOpen();

    handle.instances[0]?.emitError();
    vi.advanceTimersByTime(100);
    handle.instances[1]?.emitOpen(); // successful reconnect resets attempt counter

    handle.instances[1]?.emitError();
    vi.advanceTimersByTime(99);
    expect(handle.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(handle.instances).toHaveLength(3); // back to the 100ms base delay, not 200ms
  });

  it("close() cancels a pending reconnect", () => {
    client.connect();
    handle.instances[0]?.emitOpen();
    handle.instances[0]?.emitError();

    client.close();
    vi.advanceTimersByTime(10_000);

    expect(handle.instances).toHaveLength(1);
    expect(client.connectionState).toBe("closed");
  });
});

describe("ProjectEventsClient — onOpen", () => {
  it("fires on the initial connect, unlike onReconnect", () => {
    const openListener = vi.fn();
    client.onOpen(openListener);

    client.connect();
    handle.instances[0]?.emitOpen();

    expect(openListener).toHaveBeenCalledTimes(1);
  });

  it("also fires on every reconnect", () => {
    const openListener = vi.fn();
    client.onOpen(openListener);

    client.connect();
    handle.instances[0]?.emitOpen();
    handle.instances[0]?.emitError();
    vi.advanceTimersByTime(100);
    handle.instances[1]?.emitOpen();

    expect(openListener).toHaveBeenCalledTimes(2);
  });

  it("stops notifying after unsubscribe", () => {
    const openListener = vi.fn();
    const unsubscribe = client.onOpen(openListener);
    unsubscribe();

    client.connect();
    handle.instances[0]?.emitOpen();

    expect(openListener).not.toHaveBeenCalled();
  });
});

describe("bindCoordinatorToEvents", () => {
  it("advances the coordinator's revision for every event, own or remote", () => {
    const coordinator = new RevisionCoordinator(1);
    bindCoordinatorToEvents(coordinator, client);
    client.connect();

    handle.instances[0]?.emitMessage({ type: "outline-changed", revision: 4, origin: "tab-a" });
    expect(coordinator.currentRevision).toBe(4);

    handle.instances[0]?.emitMessage({ type: "page-changed", pageId: "page-1", revision: 7, origin: "tab-b" });
    expect(coordinator.currentRevision).toBe(7);
  });

  it("unsubscribes cleanly", () => {
    const coordinator = new RevisionCoordinator(1);
    const unbind = bindCoordinatorToEvents(coordinator, client);
    client.connect();

    unbind();
    handle.instances[0]?.emitMessage({ type: "outline-changed", revision: 9, origin: "tab-a" });

    expect(coordinator.currentRevision).toBe(1);
  });
});
