"use client";

// useModalDialog — shared hook for <dialog>-based modal components.
//
// Covers the four patterns every modal in this codebase hand-rolls:
//   1. Sync the dialog's showModal/close state with a boolean isOpen prop.
//   2. Fire a callback when the dialog is closed natively (Escape key or
//      dialog.close()) so the host can reset its own state.
//   3. Close on backdrop click (e.target === the <dialog> element itself).
//   4. Close on SPA navigation events.
//
// Extracted from doc-history.tsx, preset-generator.tsx, image-enlarge.tsx,
// and ai-chat-modal.tsx which each hand-rolled the same set of effects.

import { useEffect, useRef } from "preact/compat";

interface UseModalDialogOptions {
  /** True when the dialog should be open. */
  isOpen: boolean;
  /** Called when the dialog is closed for any reason (Escape, backdrop, navigation). */
  onClose: () => void;
  /**
   * DOM event name that triggers a close-and-reset. Defaults to
   * `AFTER_NAVIGATE_EVENT` when provided via `navigateEvent`; pass
   * `undefined` to skip navigation-close wiring entirely.
   */
  navigateEvent?: string;
  /**
   * When `true`, enable backdrop-click-to-close. The caller must forward the
   * click handler returned by this hook to the `<dialog>` element's `onClick`.
   * Defaults to `false` so opt-in only.
   */
  backdropClickClose?: boolean;
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
}: UseModalDialogOptions): UseModalDialogResult {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Sync dialog open/close with React state.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Close React state when dialog is closed natively (Escape key or
  // dialog.close() called externally).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function onDialogClose() {
      if (isOpen) onClose();
    }
    dialog.addEventListener("close", onDialogClose);
    return () => dialog.removeEventListener("close", onDialogClose);
  }, [isOpen, onClose]);

  // Close on SPA navigation events.
  useEffect(() => {
    if (!navigateEvent) return;
    function handleNavigation() {
      const dialog = dialogRef.current;
      if (dialog?.open) dialog.close();
      onClose();
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
