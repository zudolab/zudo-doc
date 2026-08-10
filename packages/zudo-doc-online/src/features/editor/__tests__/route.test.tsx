// @vitest-environment jsdom
/**
 * Bootstrap specs for the editor route — the wiring `workspace.test.tsx` is
 * handed ready-made (store, snapshot, event stream) and therefore cannot
 * cover.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "preact";
import { act } from "preact/test-utils";
import {
  ProjectEventsClient,
  type ProjectStore,
} from "../../../store/index";
import { createFakeEventSourceFactory } from "../../../store/__tests__/support";
import EditorRoute from "../route";
import { settle } from "./harness";
import { INSTALLATION_ID, createEditorTestStore } from "./support";

let container: HTMLElement | undefined;

afterEach(() => {
  if (container) {
    render(null, container);
    container.remove();
    container = undefined;
  }
  document.body.innerHTML = "";
});

describe("EditorRoute — snapshot freshness", () => {
  it("refreshes the snapshot when the event stream opens", async () => {
    const memory = createEditorTestStore();
    const loadSnapshot = vi.fn(() => memory.loadSnapshot());
    const store: ProjectStore = {
      loadSnapshot,
      applyOutlineCommand: (revision, command) =>
        memory.applyOutlineCommand(revision, command),
      loadPage: (id) => memory.loadPage(id),
      savePage: (id, revision, input) => memory.savePage(id, revision, input),
    };
    const sources = createFakeEventSourceFactory();
    const events = new ProjectEventsClient({
      projectSlug: "aurora-docs",
      clientId: "this-tab",
      createEventSource: sources.factory,
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      render(
        <EditorRoute
          pageId={INSTALLATION_ID}
          createStore={() => store}
          createEvents={() => events}
        />,
        container as HTMLElement,
      );
    });
    await settle();

    const beforeOpen = loadSnapshot.mock.calls.length;
    expect(beforeOpen).toBeGreaterThan(0);

    // The bootstrap read happened before the stream existed, and SSE replays
    // nothing — subscribing the refresh to reconnects alone left a commit in
    // that gap invisible forever.
    sources.instances[0]?.emitOpen();
    await settle();

    expect(loadSnapshot.mock.calls.length).toBeGreaterThan(beforeOpen);
  });

  it("refreshes once per reconnect, not twice", async () => {
    const memory = createEditorTestStore();
    const loadSnapshot = vi.fn(() => memory.loadSnapshot());
    const store: ProjectStore = {
      loadSnapshot,
      applyOutlineCommand: (revision, command) =>
        memory.applyOutlineCommand(revision, command),
      loadPage: (id) => memory.loadPage(id),
      savePage: (id, revision, input) => memory.savePage(id, revision, input),
    };
    const sources = createFakeEventSourceFactory();
    const events = new ProjectEventsClient({
      projectSlug: "aurora-docs",
      clientId: "this-tab",
      createEventSource: sources.factory,
      reconnectBaseMs: 1,
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      render(
        <EditorRoute
          pageId={INSTALLATION_ID}
          createStore={() => store}
          createEvents={() => events}
        />,
        container as HTMLElement,
      );
    });
    await settle();

    sources.instances[0]?.emitOpen();
    await settle();
    const beforeReconnect = loadSnapshot.mock.calls.length;

    // Drop the connection, let the backoff elapse, and open the new source.
    sources.instances[0]?.emitError();
    await settle();
    sources.instances[1]?.emitOpen();
    await settle();

    // `onOpen` fires on every successful connection, so subscribing
    // `onReconnect` as well would queue a second full snapshot GET here.
    expect(loadSnapshot.mock.calls.length).toBe(beforeReconnect + 1);
  });
});
