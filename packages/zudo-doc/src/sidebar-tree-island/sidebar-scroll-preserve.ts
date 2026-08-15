import { AFTER_NAVIGATE_EVENT, BEFORE_NAVIGATE_EVENT } from "../transitions/index.js";

interface SidebarScrollPreserveOptions {
  document: Document;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (handle: number) => void;
}

interface SidebarScrollPreserveController {
  retain: () => void;
  release: () => void;
}

const controllers = new WeakMap<Document, SidebarScrollPreserveController>();

function createController({
  document,
  requestAnimationFrame,
  cancelAnimationFrame,
}: SidebarScrollPreserveOptions): SidebarScrollPreserveController {
  let leases = 0;
  let disposalGeneration = 0;
  let snapshot: { element: HTMLElement; scrollTop: number } | undefined;
  let restoreFrame: number | undefined;

  const cancelPendingRestore = () => {
    if (restoreFrame === undefined) return;
    cancelAnimationFrame(restoreFrame);
    restoreFrame = undefined;
  };

  const onBefore = () => {
    if (leases === 0) return;
    cancelPendingRestore();

    const element = document.querySelector<HTMLElement>("#desktop-sidebar");
    snapshot = element ? { element, scrollTop: element.scrollTop } : undefined;
  };

  const onAfter = () => {
    if (leases === 0 || !snapshot) return;

    const saved = snapshot;
    snapshot = undefined;
    restoreFrame = requestAnimationFrame(() => {
      restoreFrame = undefined;
      const current = document.querySelector<HTMLElement>("#desktop-sidebar");
      if (current === saved.element) current.scrollTop = saved.scrollTop;
    });
  };

  document.addEventListener(BEFORE_NAVIGATE_EVENT, onBefore);
  document.addEventListener(AFTER_NAVIGATE_EVENT, onAfter);

  const controller: SidebarScrollPreserveController = {
    retain() {
      leases += 1;
      disposalGeneration += 1;
    },
    release() {
      if (leases === 0) return;
      leases -= 1;
      if (leases !== 0) return;

      // A persisted sidebar island is synchronously unmounted and re-mounted
      // during a body swap. Suspend writes and cancel queued work immediately,
      // but keep the current-navigation snapshot for one microtask so that the
      // replacement effect can retain this controller before after-swap. A true
      // unmount has no matching retain, so its stale state and listeners are
      // still discarded before the next task.
      cancelPendingRestore();
      const generation = ++disposalGeneration;
      queueMicrotask(() => {
        if (leases !== 0 || disposalGeneration !== generation) return;
        snapshot = undefined;
        document.removeEventListener(BEFORE_NAVIGATE_EVENT, onBefore);
        document.removeEventListener(AFTER_NAVIGATE_EVENT, onAfter);
        controllers.delete(document);
      });
    },
  };

  return controller;
}

/**
 * Install navigation-scoped scroll preservation for the persisted desktop
 * sidebar. Exposed separately from the hook so the browser lifecycle itself
 * can be exercised without duplicating this state machine in tests.
 */
export function installSidebarScrollPreserve({
  document,
  requestAnimationFrame,
  cancelAnimationFrame,
}: SidebarScrollPreserveOptions): () => void {
  let controller = controllers.get(document);
  if (!controller) {
    controller = createController({ document, requestAnimationFrame, cancelAnimationFrame });
    controllers.set(document, controller);
  }
  controller.retain();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    controller.release();
  };
}
