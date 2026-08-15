/** @vitest-environment happy-dom */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AFTER_NAVIGATE_EVENT, BEFORE_NAVIGATE_EVENT } from "../../transitions/index.js";
import {
  disposeSidebarScrollPreserve,
  ensureSidebarScrollPreserve,
  installSidebarScrollPreserve,
} from "../sidebar-scroll-preserve.js";

interface ControlledScrollTop {
  element: HTMLElement;
  getValue: () => number;
  setValue: (value: number) => void;
  getWrites: () => number;
}

function createSidebar(initialScrollTop: number): ControlledScrollTop {
  const element = document.createElement("aside");
  element.id = "desktop-sidebar";
  let value = initialScrollTop;
  let writes = 0;
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    get: () => value,
    set: (next: number) => {
      writes += 1;
      value = next;
    },
  });
  document.body.append(element);
  return {
    element,
    getValue: () => value,
    setValue: (next) => {
      value = next;
    },
    getWrites: () => writes,
  };
}

function createFrameScheduler() {
  let nextHandle = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  const canceled: number[] = [];

  return {
    requestAnimationFrame(callback: FrameRequestCallback): number {
      const handle = nextHandle++;
      callbacks.set(handle, callback);
      return handle;
    },
    cancelAnimationFrame(handle: number): void {
      canceled.push(handle);
      callbacks.delete(handle);
    },
    flush(): void {
      const pending = [...callbacks.entries()];
      callbacks.clear();
      for (const [, callback] of pending) callback(0);
    },
    pendingCount: () => callbacks.size,
    canceled,
  };
}

function dispatch(type: string): void {
  document.dispatchEvent(new Event(type));
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("desktop sidebar scroll preservation", () => {
  it("does not schedule or write when the navigation had no saved sidebar", () => {
    const frames = createFrameScheduler();
    const staleSidebar = createSidebar(91);
    const cleanup = installSidebarScrollPreserve({ document, ...frames });

    // Seed an older snapshot, then prove that a before-navigation with no
    // live sidebar clears it instead of leaking it into the next swap.
    dispatch(BEFORE_NAVIGATE_EVENT);
    staleSidebar.element.remove();
    dispatch(BEFORE_NAVIGATE_EVENT);
    const sidebar = createSidebar(17);
    dispatch(AFTER_NAVIGATE_EVENT);
    frames.flush();

    expect(frames.pendingCount()).toBe(0);
    expect(sidebar.getWrites()).toBe(0);
    expect(sidebar.getValue()).toBe(17);
    cleanup();
  });

  it("treats zero as a valid saved position and restores it", () => {
    const frames = createFrameScheduler();
    const sidebar = createSidebar(0);
    const cleanup = installSidebarScrollPreserve({ document, ...frames });

    dispatch(BEFORE_NAVIGATE_EVENT);
    sidebar.setValue(42);
    dispatch(AFTER_NAVIGATE_EVENT);
    frames.flush();

    expect(sidebar.getValue()).toBe(0);
    expect(sidebar.getWrites()).toBe(1);
    cleanup();
  });

  it("restores a nonzero position once and consumes the snapshot", () => {
    const frames = createFrameScheduler();
    const sidebar = createSidebar(73);
    const cleanup = installSidebarScrollPreserve({ document, ...frames });

    dispatch(BEFORE_NAVIGATE_EVENT);
    sidebar.setValue(0);
    dispatch(AFTER_NAVIGATE_EVENT);
    dispatch(AFTER_NAVIGATE_EVENT);
    frames.flush();

    expect(sidebar.getValue()).toBe(73);
    expect(sidebar.getWrites()).toBe(1);
    cleanup();
  });

  it("does not write to a replacement sidebar from a stale snapshot", () => {
    const frames = createFrameScheduler();
    const original = createSidebar(61);
    const cleanup = installSidebarScrollPreserve({ document, ...frames });

    dispatch(BEFORE_NAVIGATE_EVENT);
    const replacement = createSidebar(12);
    original.element.remove();
    dispatch(AFTER_NAVIGATE_EVENT);
    frames.flush();

    expect(original.getWrites()).toBe(0);
    expect(replacement.getWrites()).toBe(0);
    expect(replacement.getValue()).toBe(12);
    cleanup();
  });

  it("cancels an overlapping restore and uses only the latest cycle", () => {
    const frames = createFrameScheduler();
    const sidebar = createSidebar(15);
    const cleanup = installSidebarScrollPreserve({ document, ...frames });

    dispatch(BEFORE_NAVIGATE_EVENT);
    dispatch(AFTER_NAVIGATE_EVENT);
    sidebar.setValue(28);
    dispatch(BEFORE_NAVIGATE_EVENT);
    dispatch(AFTER_NAVIGATE_EVENT);
    frames.flush();

    expect(frames.canceled).toEqual([1]);
    expect(sidebar.getValue()).toBe(28);
    expect(sidebar.getWrites()).toBe(1);
    cleanup();
  });

  it("cancels a pending restore and invalidates saved state on cleanup", () => {
    const frames = createFrameScheduler();
    const sidebar = createSidebar(34);
    const cleanup = installSidebarScrollPreserve({ document, ...frames });

    dispatch(BEFORE_NAVIGATE_EVENT);
    dispatch(AFTER_NAVIGATE_EVENT);
    cleanup();
    sidebar.setValue(3);
    frames.flush();
    dispatch(AFTER_NAVIGATE_EVENT);
    frames.flush();

    expect(frames.canceled).toEqual([1]);
    expect(sidebar.getWrites()).toBe(0);
    expect(sidebar.getValue()).toBe(3);
  });

  it("keeps the snapshot in the duplicate-safe document singleton", () => {
    const frames = createFrameScheduler();
    const sidebar = createSidebar(60);
    ensureSidebarScrollPreserve({ document, ...frames });

    dispatch(BEFORE_NAVIGATE_EVENT);
    // Chromium clamps scrollTop while the persisted aside's island content is
    // temporarily gone. A later component/module boot call must neither replace
    // the controller nor lose the snapshot captured before that collapse.
    sidebar.setValue(0);
    ensureSidebarScrollPreserve({ document, ...frames });
    dispatch(AFTER_NAVIGATE_EVENT);
    frames.flush();

    expect(sidebar.getValue()).toBe(60);
    expect(sidebar.getWrites()).toBe(1);
    disposeSidebarScrollPreserve(document);
  });
});
