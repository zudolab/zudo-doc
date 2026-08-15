import { AFTER_NAVIGATE_EVENT, BEFORE_NAVIGATE_EVENT } from "../transitions/index.js";

interface SidebarScrollPreserveOptions {
  document: Document;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (handle: number) => void;
}

const installedControllers = new WeakMap<Document, () => void>();

/**
 * Install the scroll-preservation state machine on a document.
 *
 * This low-level entrypoint owns an explicit cleanup for focused tests and
 * non-singleton hosts. The sidebar's browser module uses the durable,
 * duplicate-safe `ensureSidebarScrollPreserve` wrapper below instead.
 */
export function installSidebarScrollPreserve({
  document,
  requestAnimationFrame,
  cancelAnimationFrame,
}: SidebarScrollPreserveOptions): () => void {
  let snapshot: { element: HTMLElement; scrollTop: number } | undefined;
  let restoreFrame: number | undefined;

  const cancelPendingRestore = () => {
    if (restoreFrame === undefined) return;
    cancelAnimationFrame(restoreFrame);
    restoreFrame = undefined;
  };

  const onBefore = () => {
    cancelPendingRestore();
    const element = document.querySelector<HTMLElement>("#desktop-sidebar");
    snapshot = element ? { element, scrollTop: element.scrollTop } : undefined;
  };

  const onAfter = () => {
    if (!snapshot) return;
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

  return () => {
    document.removeEventListener(BEFORE_NAVIGATE_EVENT, onBefore);
    document.removeEventListener(AFTER_NAVIGATE_EVENT, onAfter);
    cancelPendingRestore();
    snapshot = undefined;
  };
}

/**
 * Install exactly one module-lifetime controller for a browser document.
 * Repeated calls from component renders or duplicate boot paths are no-ops.
 */
export function ensureSidebarScrollPreserve(
  options?: SidebarScrollPreserveOptions,
): void {
  const resolved = options ?? resolveBrowserOptions();
  if (!resolved || installedControllers.has(resolved.document)) return;
  installedControllers.set(
    resolved.document,
    installSidebarScrollPreserve(resolved),
  );
}

function resolveBrowserOptions(): SidebarScrollPreserveOptions | undefined {
  if (typeof document === "undefined" || typeof window === "undefined") return undefined;
  return {
    document,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  };
}

/** Test/HMR teardown for a controller installed through the singleton wrapper. */
export function disposeSidebarScrollPreserve(document: Document): void {
  installedControllers.get(document)?.();
  installedControllers.delete(document);
}
