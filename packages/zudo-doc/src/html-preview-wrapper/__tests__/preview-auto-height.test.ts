import { describe, expect, it } from "vitest";

import { createPreviewAutoHeightController } from "../preview-auto-height.js";

class FakeRuntime {
  nextId = 1;
  timers = new Map<number, () => void>();
  frames = new Map<number, FrameRequestCallback>();
  cancelledTimers: number[] = [];
  cancelledFrames: number[] = [];

  setTimeout(callback: () => void): number {
    const id = this.nextId++;
    this.timers.set(id, callback);
    return id;
  }

  clearTimeout(id: number): void {
    this.cancelledTimers.push(id);
    this.timers.delete(id);
  }

  requestAnimationFrame(callback: FrameRequestCallback): number {
    const id = this.nextId++;
    this.frames.set(id, callback);
    return id;
  }

  cancelAnimationFrame(id: number): void {
    this.cancelledFrames.push(id);
    this.frames.delete(id);
  }

  flushTimers(): void {
    const pending = [...this.timers.values()];
    this.timers.clear();
    for (const callback of pending) callback();
  }

  flushFrames(): void {
    const pending = [...this.frames.values()];
    this.frames.clear();
    for (const callback of pending) callback(0);
  }
}

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];

  readonly observed: Element[] = [];
  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  unobserve(): void {}

  disconnect(): void {
    this.disconnected = true;
  }

  fire(): void {
    this.callback([], this as unknown as ResizeObserver);
  }
}

interface FakeDocumentState {
  bodyHeight: number;
  inaccessible?: boolean;
}

function makeHarness({
  syncDelay = 0,
  resizeObserver = true,
}: {
  syncDelay?: number;
  resizeObserver?: boolean;
} = {}) {
  FakeResizeObserver.instances = [];
  const runtime = new FakeRuntime();
  let currentHeight = 200;
  const writes: number[] = [];
  let state: FakeDocumentState = { bodyHeight: 100 };
  const body = {} as HTMLElement;
  const root = {} as HTMLElement;
  Object.defineProperty(body, "scrollHeight", {
    configurable: true,
    get: () => {
      if (state.inaccessible) throw new DOMException("opaque", "SecurityError");
      return state.bodyHeight;
    },
  });
  // The root remains viewport-sized after a tall frame; the controller must
  // continue reading body.scrollHeight so a shorter body can reduce it.
  Object.defineProperty(root, "scrollHeight", {
    configurable: true,
    get: () => currentHeight,
  });
  const document = { body, documentElement: root } as unknown as Document;
  const iframe = {
    get contentDocument() {
      if (state.inaccessible) throw new DOMException("opaque", "SecurityError");
      return document;
    },
    contentWindow: resizeObserver
      ? { ResizeObserver: FakeResizeObserver }
      : {},
  } as unknown as HTMLIFrameElement;
  const controller = createPreviewAutoHeightController({
    iframe,
    syncDelay,
    getCurrentHeight: () => currentHeight,
    setHeight: (height) => {
      currentHeight = height;
      writes.push(height);
    },
    runtime,
  });

  return {
    controller,
    runtime,
    writes,
    setBodyHeight: (bodyHeight: number) => {
      state = { bodyHeight };
    },
    setInaccessible: () => {
      state = { bodyHeight: 0, inaccessible: true };
    },
  };
}

describe("preview auto-height controller", () => {
  it("measures immediately and again after the compatible script delay", () => {
    const harness = makeHarness({ syncDelay: 300 });
    harness.setBodyHeight(240);

    harness.controller.handleLoad();
    expect(harness.writes).toEqual([256]);
    expect(harness.runtime.timers.size).toBe(1);

    harness.setBodyHeight(300);
    harness.runtime.flushTimers();
    expect(harness.runtime.frames.size).toBe(1);
    harness.runtime.flushFrames();
    expect(harness.writes).toEqual([256, 316]);
  });

  it("observes body and root, coalesces events, and handles size changes", () => {
    const harness = makeHarness();
    harness.controller.handleLoad();
    const observer = FakeResizeObserver.instances[0]!;
    expect(observer.observed).toHaveLength(2);

    harness.setBodyHeight(400);
    observer.fire();
    observer.fire();
    expect(harness.runtime.frames.size).toBe(1);
    harness.runtime.flushFrames();
    expect(harness.writes).toEqual([416]);

    harness.setBodyHeight(120);
    observer.fire();
    harness.runtime.flushFrames();
    expect(harness.writes).toEqual([416, 200]);
  });

  it("suppresses unchanged writes and a body that self-sizes from the iframe", () => {
    const harness = makeHarness();
    harness.setBodyHeight(300);
    harness.controller.handleLoad();
    const observer = FakeResizeObserver.instances[0]!;
    expect(harness.writes).toEqual([316]);

    harness.setBodyHeight(300);
    observer.fire();
    harness.runtime.flushFrames();
    harness.setBodyHeight(316);
    observer.fire();
    harness.runtime.flushFrames();

    expect(harness.writes).toEqual([316]);
  });

  it("stops a self-sizing loop even when content keeps a constant offset", () => {
    const harness = makeHarness();
    harness.setBodyHeight(216);
    harness.controller.handleLoad();
    const observer = FakeResizeObserver.instances[0]!;
    expect(harness.writes).toEqual([232]);

    harness.setBodyHeight(248);
    observer.fire();
    harness.runtime.flushFrames();
    observer.fire();
    harness.runtime.flushFrames();

    expect(harness.writes).toEqual([232]);
  });

  it("schedules viewport reflow through the same single animation frame", () => {
    const harness = makeHarness();
    harness.controller.handleLoad();
    harness.setBodyHeight(260);

    harness.controller.schedule();
    harness.controller.schedule();
    expect(harness.runtime.frames.size).toBe(1);
    harness.runtime.flushFrames();
    expect(harness.writes).toEqual([276]);
  });

  it("rebinds per load and makes prior generation callbacks inert", () => {
    const harness = makeHarness({ syncDelay: 300 });
    harness.setBodyHeight(240);
    harness.controller.handleLoad();
    const oldObserver = FakeResizeObserver.instances[0]!;
    const oldTimer = [...harness.runtime.timers.values()][0]!;

    harness.setBodyHeight(300);
    harness.controller.handleLoad();
    expect(oldObserver.disconnected).toBe(true);
    expect(harness.writes).toEqual([256, 316]);

    oldObserver.fire();
    oldTimer();
    harness.runtime.flushFrames();
    expect(harness.writes).toEqual([256, 316]);
    expect(FakeResizeObserver.instances).toHaveLength(2);
  });

  it("resets the self-sizing sample for a newly loaded document", () => {
    const harness = makeHarness();
    harness.setBodyHeight(216);
    harness.controller.handleLoad();
    harness.setBodyHeight(248);

    harness.controller.handleLoad();

    expect(harness.writes).toEqual([232, 264]);
  });

  it("cancels observer, timer, frame, and stale writes on destroy", () => {
    const harness = makeHarness({ syncDelay: 300 });
    harness.controller.handleLoad();
    const observer = FakeResizeObserver.instances[0]!;
    harness.setBodyHeight(400);
    observer.fire();

    harness.controller.destroy();
    expect(observer.disconnected).toBe(true);
    expect(harness.runtime.cancelledTimers).toHaveLength(1);
    expect(harness.runtime.cancelledFrames).toHaveLength(1);
    harness.runtime.flushTimers();
    harness.runtime.flushFrames();
    observer.fire();
    harness.runtime.flushFrames();
    expect(harness.writes).toEqual([]);
  });

  it("safely no-ops for opaque documents", () => {
    const harness = makeHarness({ syncDelay: 300 });
    harness.setInaccessible();

    expect(() => harness.controller.handleLoad()).not.toThrow();
    expect(harness.writes).toEqual([]);
    expect(FakeResizeObserver.instances).toHaveLength(0);
    expect(harness.runtime.timers.size).toBe(0);
  });

  it("keeps immediate and delayed one-shot sizing without ResizeObserver", () => {
    const harness = makeHarness({ syncDelay: 300, resizeObserver: false });
    harness.setBodyHeight(240);
    harness.controller.handleLoad();
    harness.setBodyHeight(280);
    harness.runtime.flushTimers();
    harness.runtime.flushFrames();

    expect(harness.writes).toEqual([256, 296]);
    expect(FakeResizeObserver.instances).toHaveLength(0);
  });
});
