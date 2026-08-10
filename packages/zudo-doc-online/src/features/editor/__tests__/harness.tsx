/**
 * Mounting harness for the jsdom component specs.
 *
 * `EditorWorkspace` treats the ROUTE as the source of truth for the active
 * tab, so a spec that stubbed `onNavigate` with a no-op spy would never see a
 * tab actually activate. This harness closes that loop the way `route.tsx`
 * does — navigation updates the page id the workspace is re-rendered with —
 * so every spec exercises the real round trip instead of a half of it.
 */

import { render } from "preact";
import { act } from "preact/test-utils";
import { useState } from "preact/hooks";
import type {
  MemoryProjectStore,
  ProjectEventsClient,
  ProjectSnapshot,
} from "../../../store/index";
import { EditorWorkspace } from "../workspace";
import { createFakeStorage, type FakeStorage } from "./support";

export interface HarnessOptions {
  store: MemoryProjectStore;
  snapshot: ProjectSnapshot;
  routePageId: string;
  storage?: FakeStorage;
  saveDebounceMs?: number;
  events?: ProjectEventsClient;
}

export interface MountedWorkspace {
  container: HTMLElement;
  storage: FakeStorage;
  /** Page ids the workspace asked to navigate to, oldest first. */
  navigations: Array<string | null>;
  unmount: () => void;
}

function WorkspaceHarness({
  store,
  snapshot,
  routePageId,
  storage,
  saveDebounceMs,
  events,
  navigations,
}: HarnessOptions & { storage: FakeStorage; navigations: Array<string | null> }) {
  const [pageId, setPageId] = useState(routePageId);
  const [current, setCurrent] = useState(snapshot);
  const [left, setLeft] = useState(false);

  // `onNavigate(null)` means "no page left to show"; the real router leaves
  // the editor route entirely, so the harness unmounts the workspace rather
  // than re-rendering it on a route that would just reopen the tab.
  if (left) return <p data-testid="left-editor">left the editor</p>;

  return (
    <EditorWorkspace
      snapshot={current}
      store={store}
      routePageId={pageId}
      onNavigate={(next) => {
        navigations.push(next);
        if (next === null) setLeft(true);
        else setPageId(next);
      }}
      onSnapshotChanged={setCurrent}
      storage={storage}
      {...(events === undefined ? {} : { events })}
      {...(saveDebounceMs === undefined ? {} : { saveDebounceMs })}
    />
  );
}

export async function mountWorkspace(
  options: HarnessOptions,
): Promise<MountedWorkspace> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const storage = options.storage ?? createFakeStorage();
  const navigations: Array<string | null> = [];

  await act(async () => {
    render(
      <WorkspaceHarness {...options} storage={storage} navigations={navigations} />,
      container,
    );
  });
  await settle();

  return {
    container,
    storage,
    navigations,
    unmount: () => {
      render(null, container);
      container.remove();
    },
  };
}

/** Lets pending store promises resolve and the effects they trigger run. */
export async function settle(ticks = 3): Promise<void> {
  for (let index = 0; index < ticks; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

export function queryByText<T extends Element = HTMLElement>(
  container: Element,
  selector: string,
  text: string,
): T | undefined {
  return [...container.querySelectorAll<T>(selector)].find(
    (element) => element.textContent?.trim() === text,
  );
}

export function requireElement<T extends Element = HTMLElement>(
  container: Element,
  selector: string,
): T {
  const element = container.querySelector<T>(selector);
  if (!element) throw new Error(`No element matched "${selector}".`);
  return element;
}
