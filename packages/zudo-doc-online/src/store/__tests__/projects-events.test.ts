import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeEventSourceFactory, type FakeEventSourceHandle } from "./support";
import { ProjectsEventsClient, subscribeProjectsChanged } from "../projects-events";

let handle: FakeEventSourceHandle;

beforeEach(() => {
  vi.useFakeTimers();
  handle = createFakeEventSourceFactory();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ProjectsEventsClient — connection", () => {
  it("connects to /api/projects/_events", () => {
    const client = new ProjectsEventsClient({ clientId: "tab-a", createEventSource: handle.factory });
    client.connect();

    expect(handle.instances).toHaveLength(1);
  });

  it("respects a custom baseUrl", () => {
    let requestedUrl = "";
    const client = new ProjectsEventsClient({
      clientId: "tab-a",
      baseUrl: "http://localhost:4324/api",
      createEventSource: (url) => {
        requestedUrl = url;
        return handle.factory(url);
      },
    });
    client.connect();

    expect(requestedUrl).toBe("http://localhost:4324/api/projects/_events");
  });
});

describe("ProjectsEventsClient — onOpen signal", () => {
  it("fires on the first successful open", () => {
    const client = new ProjectsEventsClient({ clientId: "tab-a", createEventSource: handle.factory });
    const onOpen = vi.fn();
    client.onOpen(onOpen);

    client.connect();
    handle.instances[0]?.emitOpen();

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(client.connectionState).toBe("open");
  });

  it("fires again on every reconnect", () => {
    const client = new ProjectsEventsClient({
      clientId: "tab-a",
      createEventSource: handle.factory,
      reconnectBaseMs: 100,
    });
    const onOpen = vi.fn();
    client.onOpen(onOpen);

    client.connect();
    handle.instances[0]?.emitOpen();
    handle.instances[0]?.emitError();
    vi.advanceTimersByTime(100);
    handle.instances[1]?.emitOpen();

    expect(onOpen).toHaveBeenCalledTimes(2);
  });
});

describe("ProjectsEventsClient — onReconnect signal", () => {
  it("does not fire on the first connect", () => {
    const client = new ProjectsEventsClient({ clientId: "tab-a", createEventSource: handle.factory });
    const onReconnect = vi.fn();
    client.onReconnect(onReconnect);

    client.connect();
    handle.instances[0]?.emitOpen();

    expect(onReconnect).not.toHaveBeenCalled();
  });

  it("fires after a reconnect following an error", () => {
    const client = new ProjectsEventsClient({
      clientId: "tab-a",
      createEventSource: handle.factory,
      reconnectBaseMs: 100,
    });
    const onReconnect = vi.fn();
    client.onReconnect(onReconnect);

    client.connect();
    handle.instances[0]?.emitOpen();
    handle.instances[0]?.emitError();
    vi.advanceTimersByTime(100);
    handle.instances[1]?.emitOpen();

    expect(onReconnect).toHaveBeenCalledTimes(1);
  });
});

describe("ProjectsEventsClient — event parsing and origin classification", () => {
  it("classifies an event with a matching origin as own", () => {
    const client = new ProjectsEventsClient({ clientId: "tab-a", createEventSource: handle.factory });
    const received: string[] = [];
    client.onEvent(({ origin }) => received.push(origin));

    client.connect();
    handle.instances[0]?.emitMessage({
      type: "projects-changed",
      slug: "aurora-docs",
      action: "created",
      origin: "tab-a",
    });

    expect(received).toEqual(["own"]);
  });

  it("classifies an event with a different origin as remote", () => {
    const client = new ProjectsEventsClient({ clientId: "tab-a", createEventSource: handle.factory });
    const received: string[] = [];
    client.onEvent(({ origin }) => received.push(origin));

    client.connect();
    handle.instances[0]?.emitMessage({
      type: "projects-changed",
      slug: "aurora-docs",
      action: "deleted",
      origin: "mcp-agent-1",
    });

    expect(received).toEqual(["remote"]);
  });

  it("classifies an event with no origin as remote", () => {
    const client = new ProjectsEventsClient({ clientId: "tab-a", createEventSource: handle.factory });
    const received: string[] = [];
    client.onEvent(({ origin }) => received.push(origin));

    client.connect();
    handle.instances[0]?.emitMessage({ type: "projects-changed", slug: "aurora-docs", action: "duplicated" });

    expect(received).toEqual(["remote"]);
  });

  it("passes through slug and action for a duplicated event, where slug is the NEW project's slug", () => {
    const client = new ProjectsEventsClient({ clientId: "tab-a", createEventSource: handle.factory });
    const events: unknown[] = [];
    client.onEvent(({ event }) => events.push(event));

    client.connect();
    handle.instances[0]?.emitMessage({
      type: "projects-changed",
      slug: "aurora-docs-copy",
      action: "duplicated",
      origin: "tab-a",
    });

    expect(events).toEqual([
      { type: "projects-changed", slug: "aurora-docs-copy", action: "duplicated", origin: "tab-a" },
    ]);
  });

  it("tolerates an unknown event type instead of crashing the connection", () => {
    const client = new ProjectsEventsClient({ clientId: "tab-a", createEventSource: handle.factory });
    const received: unknown[] = [];
    client.onEvent((envelope) => received.push(envelope));

    client.connect();
    handle.instances[0]?.emitMessage({ type: "some-future-event", detail: "unrecognized" });
    handle.instances[0]?.emitMessage({
      type: "projects-changed",
      slug: "aurora-docs",
      action: "created",
      origin: "tab-a",
    });

    expect(received).toHaveLength(1);
    expect(client.connectionState).not.toBe("closed");
  });

  it("tolerates a malformed action instead of dispatching a bad event", () => {
    const client = new ProjectsEventsClient({ clientId: "tab-a", createEventSource: handle.factory });
    const received: unknown[] = [];
    client.onEvent((envelope) => received.push(envelope));

    client.connect();
    handle.instances[0]?.emitMessage({ type: "projects-changed", slug: "aurora-docs", action: "renamed" });

    expect(received).toHaveLength(0);
  });

  it("ignores an unparseable message", () => {
    const client = new ProjectsEventsClient({ clientId: "tab-a", createEventSource: handle.factory });
    const received: unknown[] = [];
    client.onEvent((envelope) => received.push(envelope));

    client.connect();
    handle.instances[0]?.emitRawMessage("not json");

    expect(received).toHaveLength(0);
  });
});

describe("subscribeProjectsChanged", () => {
  it("wires onEvent and onOpen, and connects immediately", () => {
    const onEvent = vi.fn();
    const onOpen = vi.fn();

    subscribeProjectsChanged(
      { onEvent, onOpen },
      { clientId: "tab-a", createEventSource: handle.factory },
    );

    expect(handle.instances).toHaveLength(1);
    handle.instances[0]?.emitOpen();
    expect(onOpen).toHaveBeenCalledTimes(1);

    handle.instances[0]?.emitMessage({
      type: "projects-changed",
      slug: "aurora-docs",
      action: "created",
      origin: "tab-a",
    });
    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it("returns an unsubscribe function that closes the connection", () => {
    const onEvent = vi.fn();

    const unsubscribe = subscribeProjectsChanged(
      { onEvent },
      { clientId: "tab-a", createEventSource: handle.factory },
    );
    unsubscribe();

    expect(handle.instances[0]?.closed).toBe(true);

    handle.instances[0]?.emitMessage({
      type: "projects-changed",
      slug: "aurora-docs",
      action: "created",
      origin: "tab-a",
    });
    expect(onEvent).not.toHaveBeenCalled();
  });
});
