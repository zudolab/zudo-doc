"use client";

// useModalDialog — shared hook for <dialog>-based modal components.
//
// Covers the patterns every modal in zudo-doc hand-rolls:
//   1. Sync the dialog's showModal/close state with a boolean isOpen prop.
//   2. Fire a callback when the dialog is closed natively (Escape key or
//      dialog.close()) so the host can reset its own state.
//   3. Close on backdrop click (e.target === the <dialog> element itself).
//   4. Close on SPA navigation events.
//   5. (opt-in) Focus management: capture the trigger element on open,
//      move focus into the dialog, restore focus to trigger on close.
//
// Shipped from the package (epic #2344, S1a) so the relocated island components
// (image-enlarge / mermaid-enlarge / ai-chat-modal / doc-history) import it
// from `@takazudo/zudo-doc/use-modal-dialog` instead of each hand-rolling the
// same set of effects.
//
// Uses `preact/compat` so the bundle resolves to Preact's React-shim at runtime
// (zfb's esbuild step doesn't alias bare `react` to `preact/compat`). Mirrors
// the same workaround in `theme-toggle`. preact/compat re-exports the hooks plus
// the `React.*` type namespace used for event handlers and refs.

import { useEffect, useRef } from "preact/compat";

interface UseModalDialogOptions {
  /** True when the dialog should be open. */
  isOpen: boolean;
  /** Called when the dialog is closed for any reason (Escape, backdrop, navigation). */
  onClose: () => void;
  /**
   * DOM event name that triggers a close-and-reset. Pass the host's SPA
   * after-navigate event name (e.g. `AFTER_NAVIGATE_EVENT`); pass `undefined`
   * to skip navigation-close wiring entirely.
   */
  navigateEvent?: string;
  /**
   * When `true`, enable backdrop-click-to-close. The caller must forward the
   * click handler returned by this hook to the `<dialog>` element's `onClick`.
   * Defaults to `false` so opt-in only.
   */
  backdropClickClose?: boolean;
  /**
   * When `true`, enable focus management:
   *  - On open: capture `document.activeElement` as the return target (unless
   *    `returnFocusRef` is provided), then move focus to the first focusable
   *    element inside the dialog (or the dialog itself as a fallback).
   *  - On close: restore focus to the captured element.
   *
   * When a caller already manages focus internally (e.g. ai-chat-modal focuses
   * its input in its own effect), pass `restoreFocusOnly: true` instead to get
   * trigger-capture + restore without the "move into dialog" step.
   */
  manageFocus?: boolean;
  /**
   * Like `manageFocus` but skips the "focus first element in dialog" step —
   * use when the caller has its own focus-on-open logic and only needs
   * trigger-capture + focus restore on close.
   */
  restoreFocusOnly?: boolean;
  /**
   * Optional ref holding the element to return focus to on close. When
   * provided and non-null, this takes precedence over the internally captured
   * `document.activeElement`. Useful when the trigger element is conditionally
   * rendered and therefore removed from the DOM before the open effect fires
   * (e.g. the doc-history trigger button, which is unmounted when `isOpen`
   * is true). The caller should set `returnFocusRef.current` to the trigger
   * element in its click handler, before calling `setState`.
   */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

interface UseModalDialogResult {
  dialogRef: React.RefObject<HTMLDialogElement>;
  /**
   * Pass this to `<dialog onClick={handleBackdropClick}>`.
   * Only wired when `backdropClickClose` is true; otherwise a no-op.
   */
  handleBackdropClick: (e: React.MouseEvent<HTMLDialogElement>) => void;
}

/**
 * Shared hook for `<dialog>`-based modal components.
 *
 * Usage:
 * ```tsx
 * const { dialogRef, handleBackdropClick } = useModalDialog({
 *   isOpen,
 *   onClose: handleClose,
 *   navigateEvent: AFTER_NAVIGATE_EVENT,
 *   backdropClickClose: true,
 * });
 * return <dialog ref={dialogRef} onClick={handleBackdropClick} ... />;
 * ```
 */
export function useModalDialog({
  isOpen,
  onClose,
  navigateEvent,
  backdropClickClose = false,
  manageFocus = false,
  restoreFocusOnly = false,
  returnFocusRef,
}: UseModalDialogOptions): UseModalDialogResult {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Internally captured trigger element — the element that was focused when
  // the dialog opened. Only used when `returnFocusRef` is not provided.
  // Stored as a ref so it persists across renders without triggering re-renders.
  const internalTriggerRef = useRef<Element | null>(null);

  // Sync dialog open/close with React state; handle focus on open.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      // Capture the current focus target BEFORE showModal() steals focus.
      // Skip when the caller provides returnFocusRef (they capture it earlier,
      // in the click handler, before the trigger element is unmounted).
      if ((manageFocus || restoreFocusOnly) && !returnFocusRef) {
        internalTriggerRef.current = document.activeElement;
      }
      dialog.showModal();
      // Move focus into the dialog unless the caller handles it internally.
      if (manageFocus && !restoreFocusOnly) {
        // Focus the first keyboard-reachable element, falling back to the
        // dialog itself (which becomes focusable as a top-layer element).
        const FOCUSABLE =
          'button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])';
        const first = dialog.querySelector<HTMLElement>(FOCUSABLE);
        if (first) {
          first.focus();
        } else {
          dialog.focus();
        }
      }
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen, manageFocus, restoreFocusOnly, returnFocusRef]);

  // Close React state when dialog is closed natively (Escape key or
  // dialog.close() called externally); restore focus to trigger on any close.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function onDialogClose() {
      if (manageFocus || restoreFocusOnly) {
        // Prefer the caller-supplied ref (for conditionally-rendered triggers);
        // fall back to the internally captured active element.
        const trigger =
          (returnFocusRef ? returnFocusRef.current : internalTriggerRef.current);
        if (trigger instanceof HTMLElement) {
          trigger.focus();
        }
        internalTriggerRef.current = null;
      }
      if (isOpen) onClose();
    }
    dialog.addEventListener("close", onDialogClose);
    return () => dialog.removeEventListener("close", onDialogClose);
  }, [isOpen, onClose, manageFocus, restoreFocusOnly, returnFocusRef]);

  // Close on SPA navigation events — only when the dialog is actually open.
  // The sibling native-close effect already guards with the open state; calling
  // onClose() unconditionally here churned state on every navigation even for
  // closed/persisted modals (fixes #2136 H1).
  useEffect(() => {
    if (!navigateEvent) return;
    function handleNavigation() {
      const dialog = dialogRef.current;
      if (dialog?.open) {
        // dialog.close() fires the "close" event, which already handles focus
        // restore in the effect above — no duplicate restore needed here.
        dialog.close();
        onClose();
      }
    }
    document.addEventListener(navigateEvent, handleNavigation);
    return () => document.removeEventListener(navigateEvent, handleNavigation);
  }, [navigateEvent, onClose]);

  // Backdrop-click handler — closes when the click target is the dialog
  // itself (not a child element).
  // Native <dialog> backdrop clicks fire with e.target === the dialog
  // itself; child element clicks bubble with target set to that child.
  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>): void {
    if (!backdropClickClose) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (e.target === dialog) dialog.close();
  }

  return { dialogRef, handleBackdropClick };
}
