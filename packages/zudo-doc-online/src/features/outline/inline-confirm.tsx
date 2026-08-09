/**
 * The destructive-action pattern for this surface: no modal dialog, no
 * `window.confirm` — the question replaces the row it is about, so the thing
 * being deleted stays visible while the decision is made.
 *
 * Initial focus deliberately lands on **Cancel**. A delete confirm that opens
 * with the destructive button focused turns a stray Enter (or a second click
 * from an impatient user) into the very deletion the confirm exists to
 * prevent, and Escape cancels for the same reason.
 */

import { useEffect, useRef } from "preact/hooks";

export interface InlineConfirmProps {
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` colors the confirm button; anything else stays neutral. */
  tone?: "danger" | "neutral";
  onConfirm(): void;
  onCancel(): void;
  /** Holds the surface's live-refresh guard while the question is open. */
  beginEditing?: (() => () => void) | undefined;
}

const BUTTON_BASE =
  "rounded-sm px-hsp-sm py-vsp-2xs text-caption font-medium focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

export function InlineConfirm({
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "neutral",
  onConfirm,
  onCancel,
  beginEditing,
}: InlineConfirmProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => beginEditing?.(), [beginEditing]);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div
      role="group"
      aria-label={message}
      className="flex min-w-[0px] flex-1 flex-wrap items-center gap-hsp-sm rounded-md border border-border-strong bg-surface px-hsp-sm py-vsp-2xs"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }}
    >
      <span className="min-w-[0px] flex-1 text-caption text-fg-mild">{message}</span>
      <button
        ref={cancelRef}
        type="button"
        onClick={onCancel}
        className={`${BUTTON_BASE} border border-border-strong text-fg-mild hover:text-fg`}
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className={
          tone === "danger"
            ? // The token set has no `danger-fg`; `accent-fg` is the text-on-fill
              // role and its light/dark flip matches danger's own lightness flip,
              // so it stays readable in both modes.
              `${BUTTON_BASE} bg-danger text-accent-fg`
            : `${BUTTON_BASE} bg-accent text-accent-fg hover:bg-accent-hover`
        }
      >
        {confirmLabel}
      </button>
    </div>
  );
}
