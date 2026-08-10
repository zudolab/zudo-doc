/**
 * The main window's in-pane placeholder for a popped-out preview
 * (popout-pattern.md recipe, "Main-window UX details"), plus the
 * `usePopoutOpen` hook `workspace.tsx` uses to decide whether to render
 * this placeholder or the real `PreviewPaneSlot`.
 *
 * Both actions route through the shared `popoutRegistry` singleton so
 * neither this component nor its caller needs to hold a window reference:
 *
 * - **Focus** re-opens by name — the named window makes this idempotent
 *   (browsers reuse rather than duplicate an already-open window), so it
 *   just brings the popout forward.
 * - **Bring back** closes the popout via the registry's own reference and
 *   unregisters it. `usePopoutOpen` picks up that unregistration through
 *   the registry's subscribe/notify path, so the caller re-renders back to
 *   the real preview with no extra plumbing here.
 */

import { useCallback } from "preact/hooks";
import { useSyncExternalStore } from "preact/compat";
import { popoutRegistry } from "./popout-registry";

const ACTION_BUTTON_CLASSES =
  "rounded-sm border border-border-strong px-hsp-sm py-vsp-2xs text-caption font-semibold text-fg-mild hover:bg-(--zdo-wash-hover) focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

/** Reactive read of `popoutRegistry.isOpen(projectSlug, pageId)` — re-renders the caller on open, focus (no-op re-render), and close. */
export function usePopoutOpen(projectSlug: string, pageId: string): boolean {
  const subscribe = useCallback(
    (listener: () => void) => popoutRegistry.subscribe(listener),
    [],
  );
  const getSnapshot = useCallback(
    () => popoutRegistry.isOpen(projectSlug, pageId),
    [projectSlug, pageId],
  );
  return useSyncExternalStore(subscribe, getSnapshot);
}

export interface PopoutBarProps {
  projectSlug: string;
  pageId: string;
}

export default function PopoutBar({ projectSlug, pageId }: PopoutBarProps) {
  return (
    <div className="flex size-full min-h-[0px] flex-col items-center justify-center gap-vsp-sm px-hsp-xl text-center">
      <p className="text-small text-muted">Previewing in another window</p>
      <div className="flex items-center gap-hsp-sm">
        <button
          type="button"
          className={ACTION_BUTTON_CLASSES}
          onClick={() => popoutRegistry.focus(projectSlug, pageId)}
        >
          Focus
        </button>
        <button
          type="button"
          className={ACTION_BUTTON_CLASSES}
          onClick={() => popoutRegistry.bringBack(projectSlug, pageId)}
        >
          Bring back
        </button>
      </div>
    </div>
  );
}
