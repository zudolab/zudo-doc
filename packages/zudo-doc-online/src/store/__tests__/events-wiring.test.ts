/**
 * End-to-end wiring: memory provider + revision coordinator + save machine +
 * a mocked `EventSource`, exercising the three SSE behaviors the epic calls
 * out explicitly — own-origin suppression, the dirty guard, and
 * reconnect-refetch — the way a real page would actually assemble them.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bindCoordinatorToEvents, ProjectEventsClient } from "../events";
import { createCoordinatedStore } from "../revision-coordinator";
import { bindPageSaveMachine, PageSaveMachine } from "../save-machine";
import { createFakeEventSourceFactory, createTestStore, type FakeEventSourceHandle } from "./support";

let handle: FakeEventSourceHandle;

beforeEach(() => {
  vi.useFakeTimers();
  handle = createFakeEventSourceFactory();
});

afterEach(() => {
  vi.useRealTimers();
});

function setup() {
  const inner = createTestStore();
  const { store, coordinator } = createCoordinatedStore(inner, 1);
  const events = new ProjectEventsClient({
    projectSlug: "docs",
    clientId: "tab-a",
    createEventSource: handle.factory,
    reconnectBaseMs: 500,
  });
  bindCoordinatorToEvents(coordinator, events);
  return { inner, store, coordinator, events };
}

describe("own-origin suppression", () => {
  it("an own-origin event only advances the coordinator's revision — no page refetch", async () => {
    const { inner, store, coordinator, events } = setup();
    const page1 = await store.loadPage("page-1");
    const machine = new PageSaveMachine({ pageId: "page-1", store, initial: page1 });
    bindPageSaveMachine(machine, events);
    events.connect();

    // Stand-in for "this tab already committed this outline change."
    inner.applyExternalOutlineCommand({ type: "add-category", title: "New" });
    handle.instances[0]?.emitMessage({ type: "outline-changed", revision: 2, origin: "tab-a" });

    expect(coordinator.currentRevision).toBe(2);
    expect(machine.getSnapshot().content.markdown).toBe(page1.markdown);
    expect(machine.getSnapshot().status).toBe("idle");
  });
});

describe("dirty guard", () => {
  it("a remote page-changed while dirty enters conflict, disarming autosave, and leaves content untouched", async () => {
    const { inner, store, coordinator, events } = setup();
    const page1 = await store.loadPage("page-1");
    const machine = new PageSaveMachine({ pageId: "page-1", store, initial: page1 });
    bindPageSaveMachine(machine, events);
    events.connect();

    machine.edit({ markdown: "My unsaved draft\n" });
    inner.applyExternalPageWrite("page-1", { markdown: "Someone else's edit\n" });
    handle.instances[0]?.emitMessage({
      type: "page-changed",
      pageId: "page-1",
      revision: inner.getRevision(),
      origin: "tab-b",
    });

    // The coordinator adopted this same event's revision — proving why an
    // unguarded autosave here would have been accepted by the server and
    // silently overwritten the remote edit.
    expect(coordinator.currentRevision).toBe(inner.getRevision());

    const snapshot = machine.getSnapshot();
    expect(snapshot.status).toBe("conflict");
    expect(snapshot.remoteChanged).toBe(true);
    expect(snapshot.content.markdown).toBe("My unsaved draft\n");

    // The autosave debounce armed by edit() must not fire and clobber the
    // remote edit; only an explicit retry()/discard() may act now.
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await store.loadPage("page-1")).toMatchObject({ markdown: "Someone else's edit\n" });
  });

  it("a remote page-changed while clean silently refetches the page", async () => {
    const { inner, store, events } = setup();
    const page1 = await store.loadPage("page-1");
    const machine = new PageSaveMachine({ pageId: "page-1", store, initial: page1 });
    bindPageSaveMachine(machine, events);
    events.connect();

    inner.applyExternalPageWrite("page-1", { markdown: "Refreshed elsewhere\n" });
    handle.instances[0]?.emitMessage({
      type: "page-changed",
      pageId: "page-1",
      revision: inner.getRevision(),
      origin: "tab-b",
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(machine.getSnapshot().content.markdown).toBe("Refreshed elsewhere\n");
    expect(machine.getSnapshot().status).toBe("idle");
  });

  it("a page-changed for a different page id is ignored by this machine", async () => {
    const { store, events } = setup();
    const page1 = await store.loadPage("page-1");
    const machine = new PageSaveMachine({ pageId: "page-1", store, initial: page1 });
    bindPageSaveMachine(machine, events);
    events.connect();

    machine.edit({ markdown: "Mine\n" });
    handle.instances[0]?.emitMessage({
      type: "page-changed",
      pageId: "page-2",
      revision: 9,
      origin: "tab-b",
    });

    expect(machine.getSnapshot().remoteChanged).toBe(false);
    expect(machine.getSnapshot().content.markdown).toBe("Mine\n");
  });
});

describe("reconnect → refetch", () => {
  it("a clean machine refetches its page after a reconnect", async () => {
    const { inner, store, events } = setup();
    const page1 = await store.loadPage("page-1");
    const machine = new PageSaveMachine({ pageId: "page-1", store, initial: page1 });
    bindPageSaveMachine(machine, events);
    events.connect();
    handle.instances[0]?.emitOpen(); // initial open — no reconnect signal yet

    // The change happens while this tab is disconnected, so no event for it
    // is ever delivered — the refetch is the only way this tab learns of it.
    inner.applyExternalPageWrite("page-1", { markdown: "Changed while disconnected\n" });

    handle.instances[0]?.emitError();
    await vi.advanceTimersByTimeAsync(500);
    handle.instances[1]?.emitOpen();
    await vi.advanceTimersByTimeAsync(0);

    expect(machine.getSnapshot().content.markdown).toBe("Changed while disconnected\n");
    expect(machine.getSnapshot().status).toBe("idle");
  });

  it("a dirty machine only flags remoteChanged on reconnect, keeping its draft", async () => {
    const { store, events } = setup();
    const page1 = await store.loadPage("page-1");
    // A debounce window longer than the reconnect delay below, so the
    // machine's own autosave cannot fire (and land in "saved") before the
    // reconnect assertion runs — this test is about the reconnect signal,
    // not a race against the autosave timer.
    const machine = new PageSaveMachine({ pageId: "page-1", store, initial: page1, debounceMs: 100_000 });
    bindPageSaveMachine(machine, events);
    events.connect();
    handle.instances[0]?.emitOpen();

    machine.edit({ markdown: "My unsaved draft\n" });

    handle.instances[0]?.emitError();
    await vi.advanceTimersByTimeAsync(500);
    handle.instances[1]?.emitOpen();

    const snapshot = machine.getSnapshot();
    expect(snapshot.remoteChanged).toBe(true);
    expect(snapshot.content.markdown).toBe("My unsaved draft\n");
  });
});
