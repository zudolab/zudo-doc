import type { Listener, ReadonlySignal, Ref, Scope } from "@takazudo/zfb/zudo-react";

export interface ModalDialogOptions {
  isOpen: ReadonlySignal<boolean>;
  onClose: () => void;
  navigateEvent?: string;
  backdropClickClose?: boolean;
  manageFocus?: boolean;
  restoreFocusOnly?: boolean;
  returnFocusRef?: Ref<HTMLElement>;
}

export interface ModalDialogResult {
  dialogRef: Ref<HTMLDialogElement>;
  handleBackdropClick: Listener<Event>;
}

/** Call during setup in the scope that owns the dialog element. */
export function modalDialog(scope: Scope, options: ModalDialogOptions): ModalDialogResult {
  const dialogRef: Ref<HTMLDialogElement> = { current: null };
  let capturedTrigger: Element | null = null;
  let closingFromNavigation = false;
  const ownsFocus = options.manageFocus || options.restoreFocusOnly;

  scope.effect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (options.isOpen.value && !dialog.open) {
      closingFromNavigation = false;
      if (ownsFocus && !options.returnFocusRef) capturedTrigger = document.activeElement;
      dialog.showModal();
      if (options.manageFocus && !options.restoreFocusOnly) {
        const focusable = dialog.querySelector<HTMLElement>(
          'button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])',
        );
        (focusable ?? dialog).focus();
      }
    } else if (!options.isOpen.value && dialog.open) {
      dialog.close();
    }
  });

  scope.onActivate(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onDialogClose = () => {
      if (ownsFocus) {
        const trigger = options.returnFocusRef?.current ?? capturedTrigger;
        if (trigger instanceof HTMLElement) trigger.focus();
        capturedTrigger = null;
      }
      if (options.isOpen.value && !closingFromNavigation) options.onClose();
      closingFromNavigation = false;
    };
    const onNavigation = () => {
      if (!dialog.open) return;
      // Native close may dispatch asynchronously. Notify exactly once here.
      closingFromNavigation = true;
      dialog.close();
      options.onClose();
    };
    dialog.addEventListener("close", onDialogClose);
    if (options.navigateEvent) document.addEventListener(options.navigateEvent, onNavigation);
    return () => {
      dialog.removeEventListener("close", onDialogClose);
      if (options.navigateEvent) document.removeEventListener(options.navigateEvent, onNavigation);
    };
  });

  const handleBackdropClick: Listener<Event> = (event) => {
    if (options.backdropClickClose && event.target === dialogRef.current) dialogRef.current?.close();
  };
  return { dialogRef, handleBackdropClick };
}
