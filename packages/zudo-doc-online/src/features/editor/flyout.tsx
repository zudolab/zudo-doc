/**
 * The collapsed rail's pages flyout (a3's popover), and nothing else — the
 * tree inside it is `PageTree`, shared with the expanded rail.
 *
 * Dismissal is deliberately belt-and-braces: Escape (keyboard users),
 * pointerdown outside (mouse users), and selecting a page (everyone). The
 * outside listener is `pointerdown` rather than `click` so a drag started on
 * the split handle closes the flyout at the moment it begins instead of after
 * it ends.
 *
 * The panel takes focus when it opens and returns it to the trigger when it
 * closes, so a keyboard user is never stranded in a popover with no way back.
 */

import { useEffect, useRef } from "preact/hooks";
import type { RefObject } from "preact";
import { PageTree } from "./page-tree";
import type { EditorTreeCategory } from "./page-index";

export interface PagesFlyoutProps {
  open: boolean;
  tree: readonly EditorTreeCategory[];
  pageCount: number;
  activePageId: string | null;
  dirtyPageIds: ReadonlySet<string>;
  onOpenPage: (pageId: string) => void;
  onClose: () => void;
  /** The rail button that opened it — excluded from outside-dismiss, refocused on close. */
  triggerRef: RefObject<HTMLElement | null>;
}

export function PagesFlyout({
  open,
  tree,
  pageCount,
  activePageId,
  dirtyPageIds,
  onOpenPage,
  onClose,
  triggerRef,
}: PagesFlyoutProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open) {
      // Only pull focus back when THIS component closed it — not on the
      // initial mount, where the trigger never had focus to begin with.
      if (wasOpen.current) triggerRef.current?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onPointerDown = (event: Event) => {
      const target = event.target as Node | null;
      if (target === null) return;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-label="Pages"
      className="absolute top-vsp-xs left-(--zdo-rail-collapsed) z-(--zdo-z-flyout) ml-hsp-sm flex max-h-full min-h-[0px] w-(--zdo-flyout-width) flex-col rounded-md border border-border bg-bg shadow-2"
    >
      <div className="flex flex-none items-center gap-hsp-sm border-b border-border px-hsp-md py-vsp-xs">
        <span className="text-small font-semibold">Pages</span>
        <span className="text-caption text-muted">{pageCount} pages</span>
      </div>

      <PageTree
        tree={tree}
        activePageId={activePageId}
        dirtyPageIds={dirtyPageIds}
        onOpenPage={onOpenPage}
        label="Project pages"
      />

      <div className="flex flex-none items-center gap-hsp-sm border-t border-border px-hsp-md py-vsp-xs text-caption text-muted">
        <span>Esc closes · selecting a page opens its tab</span>
      </div>
    </div>
  );
}
