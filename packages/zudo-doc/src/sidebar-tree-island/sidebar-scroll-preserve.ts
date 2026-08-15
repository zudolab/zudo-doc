import { AFTER_NAVIGATE_EVENT, BEFORE_NAVIGATE_EVENT } from "../transitions/index.js";

interface SidebarScrollPreserveOptions {
  document: Document;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (handle: number) => void;
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
