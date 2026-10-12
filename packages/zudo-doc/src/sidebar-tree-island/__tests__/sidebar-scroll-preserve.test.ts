/** @vitest-environment happy-dom */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AFTER_NAVIGATE_EVENT, BEFORE_NAVIGATE_EVENT } from "../../transitions/index.js";
import {
  disposeSidebarScrollPreserve,
  ensureSidebarScrollPreserve,
  installSidebarScrollPreserve,
  notifySidebarScrollReady,
} from "../sidebar-scroll-preserve.js";

interface ControlledScrollTop {
  element: HTMLElement;
  getValue: () => number;
  setValue: (value: number) => void;
  getWrites: () => number;
  setScrollHeight: (value: number) => void;
  setClientHeight: (value: number) => void;
}

function createSidebar(initialScrollTop: number, id = "desktop-sidebar"): ControlledScrollTop {
  const element = document.createElement("aside");
  element.id = id;
  const row = document.createElement("a");
  row.href = "/docs/guides/tag-governance/";
  row.textContent = "Tag Governance";
  row.setAttribute("data-sidebar-focus-scope", "guides/tag");
  element.append(row);
  let value = initialScrollTop;
  let writes = 0;
  let scrollHeight = 800;
  let clientHeight = 120;
  const clamp = (next: number) => Math.min(Math.max(0, next), Math.max(0, scrollHeight - clientHeight));
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    get: () => value,
    set: (next: number) => {
      writes += 1;
      value = clamp(next);
    },
  });
  Object.defineProperty(element, "scrollHeight", { configurable: true, get: () => scrollHeight });
  Object.defineProperty(element, "clientHeight", { configurable: true, get: () => clientHeight });
  document.body.append(element);
  return {
    element,
    getValue: () => value,
    setValue: (next) => {
      value = clamp(next);
    },
    getWrites: () => writes,
    setScrollHeight: (next) => {
      scrollHeight = next;
      value = clamp(value);
    },
    setClientHeight: (next) => {
      clientHeight = next;
    },
  };
}

function ready(element: HTMLElement, frames: { flush: () => void }): void {
  notifySidebarScrollReady(element);
  frames.flush();
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
    ready(sidebar.element, frames);

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
    ready(sidebar.element, frames);

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
    ready(sidebar.element, frames);

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
    ready(replacement.element, frames);

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
    notifySidebarScrollReady(sidebar.element);
    sidebar.setValue(28);
    dispatch(BEFORE_NAVIGATE_EVENT);
    sidebar.setValue(0);
    dispatch(AFTER_NAVIGATE_EVENT);
    ready(sidebar.element, frames);

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
    notifySidebarScrollReady(sidebar.element);
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
    ready(sidebar.element, frames);

    expect(sidebar.getValue()).toBe(60);
    expect(sidebar.getWrites()).toBe(1);
    disposeSidebarScrollPreserve(document);
  });

  it("restores a replaced sidebar when the logical context matches", () => {
    const frames = createFrameScheduler();
    const original = createSidebar(180);
    markContext(original.element, "en:guides:1");
    const cleanup = installSidebarScrollPreserve({ document, ...frames });

    dispatch(BEFORE_NAVIGATE_EVENT);
    const replacement = createSidebar(0);
    markContext(replacement.element, "en:guides:1");
    original.element.remove();
    dispatch(AFTER_NAVIGATE_EVENT);
    ready(replacement.element, frames);

    expect(replacement.getValue()).toBe(180);
    expect(replacement.getWrites()).toBe(1);
    cleanup();
  });

  it("does not copy source pixels onto a different context", () => {
    const frames = createFrameScheduler();
    const original = createSidebar(180);
    markContext(original.element, "en:guides:1");
    const cleanup = installSidebarScrollPreserve({ document, ...frames });

    dispatch(BEFORE_NAVIGATE_EVENT);
    const replacement = createSidebar(24);
    markContext(replacement.element, "en:reference:2");
    original.element.remove();
    dispatch(AFTER_NAVIGATE_EVENT);
    ready(replacement.element, frames);

    expect(replacement.getWrites()).toBe(0);
    expect(replacement.getValue()).toBe(24);
    cleanup();
  });

  it("keeps a nonzero offset across an empty-tree zero and waits until the tree can hold it", () => {
    const frames = createFrameScheduler();
    const observers: Array<{ fire: () => void }> = [];
    class FakeResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(): void { observers.push(this); }
      disconnect(): void {}
      fire(): void { this.callback([], this as unknown as ResizeObserver); }
    }
    const sidebar = createSidebar(220);
    const cleanup = installSidebarScrollPreserve({ document, ...frames, ResizeObserver: FakeResizeObserver as unknown as typeof ResizeObserver });

    dispatch(BEFORE_NAVIGATE_EVENT);
    sidebar.element.querySelector("a")?.remove();
    sidebar.setValue(0);
    dispatch(BEFORE_NAVIGATE_EVENT);
    sidebar.element.append(Object.assign(document.createElement("a"), { href: "/docs/guides/tag-governance/", textContent: "Tag Governance" }));
    sidebar.element.querySelector("a")?.setAttribute("data-sidebar-focus-scope", "guides/tag");
    sidebar.setScrollHeight(20);
    dispatch(AFTER_NAVIGATE_EVENT);
    ready(sidebar.element, frames);

    expect(sidebar.getWrites()).toBe(0);
    expect(sidebar.getValue()).toBe(0);
    sidebar.setScrollHeight(800);
    observers.at(-1)?.fire();

    expect(sidebar.getValue()).toBe(220);
    expect(sidebar.getWrites()).toBe(1);
    cleanup();
  });

  it("keeps desktop and mobile offsets independent of a closed drawer", () => {
    const frames = createFrameScheduler();
    const desktop = createSidebar(200);
    const mobile = createSidebar(80, "");
    const aside = document.createElement("aside");
    aside.setAttribute("data-zd-mobile-sidebar");
    aside.append(mobile.element);
    mobile.element.className = "flex-1 overflow-y-auto";
    document.body.append(aside);
    const cleanup = installSidebarScrollPreserve({ document, ...frames });

    dispatch(BEFORE_NAVIGATE_EVENT);
    desktop.setValue(0);
    mobile.setClientHeight(0);
    mobile.setValue(0);
    dispatch(AFTER_NAVIGATE_EVENT);
    ready(desktop.element, frames);

    expect(desktop.getValue()).toBe(200);
    expect(mobile.getWrites()).toBe(0);
    mobile.setClientHeight(120);
    ready(mobile.element, frames);

    expect(mobile.getValue()).toBe(80);
    cleanup();
  });

  it("merges sidebar scroll into the current history entry without dropping router keys", () => {
    const frames = createFrameScheduler();
    const sidebar = createSidebar(150);
    history.replaceState({ index: 4, scrollX: 1, scrollY: 9, extra: "keep" }, "");
    const cleanup = installSidebarScrollPreserve({ document, ...frames });

    dispatch(BEFORE_NAVIGATE_EVENT);
    const state = history.state as { index: number; scrollX: number; scrollY: number; extra: string; zdSidebarScroll: { desktop: { scrollTop: number } } };

    expect(state.index).toBe(4);
    expect(state.scrollX).toBe(1);
    expect(state.scrollY).toBe(9);
    expect(state.extra).toBe("keep");
    expect(state.zdSidebarScroll.desktop.scrollTop).toBe(150);
    cleanup();
  });

  it("restores Back/Forward from the destination entry instead of the leaving sidebar", () => {
    const frames = createFrameScheduler();
    const sidebar = createSidebar(150);
    history.replaceState({ index: 4, scrollX: 0, scrollY: 9 }, "");
    const cleanup = installSidebarScrollPreserve({ document, ...frames });

    dispatch(BEFORE_NAVIGATE_EVENT);
    sidebar.setValue(12);
    window.dispatchEvent(new PopStateEvent("popstate"));
    dispatch(BEFORE_NAVIGATE_EVENT);
    dispatch(AFTER_NAVIGATE_EVENT);
    ready(sidebar.element, frames);

    expect(sidebar.getValue()).toBe(150);
    expect(history.state).toMatchObject({ index: 4, scrollY: 9 });
    cleanup();
  });

  it("cancels a pending restore when the reader scrolls the sidebar", () => {
    const frames = createFrameScheduler();
    const sidebar = createSidebar(90);
    const cleanup = installSidebarScrollPreserve({ document, ...frames });

    dispatch(BEFORE_NAVIGATE_EVENT);
    sidebar.setValue(0);
    dispatch(AFTER_NAVIGATE_EVENT);
    notifySidebarScrollReady(sidebar.element);
    sidebar.element.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    frames.flush();

    expect(sidebar.getWrites()).toBe(0);
    expect(sidebar.getValue()).toBe(0);
    cleanup();
  });

  it("restores a full document load from a matching session snapshot and ignores a bad one", () => {
    const frames = createFrameScheduler();
    const sidebar = createSidebar(180);
    markContext(sidebar.element, "en:guides:1");
    const cleanup = installSidebarScrollPreserve({ document, ...frames });
    const link = sidebar.element.querySelector("a");
    expect(link).not.toBeNull();
    link!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0, cancelable: true }));
    const raw = sessionStorage.getItem("zd-sidebar-scroll-pending");
    expect(raw).toBeTruthy();
    const pending = JSON.parse(raw!) as { to: string; slots: unknown };
    expect(pending.to).toBe("/docs/guides/tag-governance");
    history.pushState({}, "", "/docs/guides/tag-governance/");
    cleanup();

    sidebar.setValue(0);
    const applyFrames = createFrameScheduler();
    const applied = installSidebarScrollPreserve({ document, ...applyFrames });
    ready(sidebar.element, applyFrames);
    expect(sidebar.getValue()).toBe(180);
    expect(sessionStorage.getItem("zd-sidebar-scroll-pending")).toBeNull();
    applied();

    sessionStorage.setItem("zd-sidebar-scroll-pending", "{");
    sidebar.setValue(33);
    const ignored = installSidebarScrollPreserve({ document, ...createFrameScheduler() });
    expect(sidebar.getValue()).toBe(33);
    expect(sessionStorage.getItem("zd-sidebar-scroll-pending")).toBeNull();
    ignored();

    sessionStorage.setItem("zd-sidebar-scroll-pending", JSON.stringify({ to: "/somewhere-else", slots: pending.slots }));
    const missed = installSidebarScrollPreserve({ document, ...createFrameScheduler() });
    expect(sidebar.getValue()).toBe(33);
    expect(sessionStorage.getItem("zd-sidebar-scroll-pending")).toBeNull();
    missed();
  });
});

function markContext(element: HTMLElement, id: string): void {
  const nav = document.createElement("nav");
  nav.setAttribute("data-sidebar-context", id);
  nav.setAttribute("data-sidebar-scope", "");
  element.append(nav);
}
