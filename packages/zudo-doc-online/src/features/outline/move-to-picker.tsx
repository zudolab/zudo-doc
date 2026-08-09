/**
 * Cross-parent page moves without dragging.
 *
 * Dragging a card between columns is the board view's job (#3337); in an
 * indented tree a drag across two collapsed groups is fiddly and unavailable
 * to keyboard users entirely, so the tree offers an explicit picker instead.
 *
 * Targets whose category already holds a page with this slug are LISTED and
 * disabled rather than hidden: `move-page` would reject them with
 * `slug-conflict` (every category tends to own an `index` page), and saying
 * so before the click beats an error banner after it.
 */

import { useEffect, useRef } from "preact/hooks";
import type { MoveTarget } from "./outline-model.js";

export interface MoveToPickerProps {
  targets: MoveTarget[];
  onPick(categoryId: string): void;
  onCancel(): void;
  beginEditing?: (() => () => void) | undefined;
}

export function MoveToPicker({
  targets,
  onPick,
  onCancel,
  beginEditing,
}: MoveToPickerProps) {
  const firstRef = useRef<HTMLButtonElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => beginEditing?.(), [beginEditing]);

  // Falls back to Cancel when every target is blocked, so opening the picker
  // never leaves focus stranded on the row behind it.
  useEffect(() => {
    (firstRef.current ?? cancelRef.current)?.focus();
  }, []);

  const firstEnabledId =
    targets.find((target) => target.disabledReason === null)?.categoryId ?? null;

  return (
    <div
      role="group"
      aria-label="Move page to another category"
      className="flex min-w-[0px] flex-1 flex-col gap-vsp-2xs rounded-md border border-border-strong bg-surface px-hsp-sm py-vsp-xs"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }}
    >
      <span className="text-caption text-muted">Move to…</span>
      {targets.length === 0 ? (
        <span className="text-caption text-fg-mild">
          There is no other category to move this page into.
        </span>
      ) : (
        <ul className="flex flex-col gap-vsp-2xs">
          {targets.map((target) => (
            <li key={target.categoryId} className="flex min-w-[0px]">
              <button
                ref={target.categoryId === firstEnabledId ? firstRef : undefined}
                type="button"
                disabled={target.disabledReason !== null}
                onClick={() => onPick(target.categoryId)}
                className="flex min-w-[0px] flex-1 items-center gap-hsp-sm rounded-sm px-hsp-sm py-vsp-2xs text-left text-small text-fg hover:bg-surface-2 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
              >
                <span className="min-w-[0px] truncate">{target.title}</span>
                <span className="shrink-0 font-mono text-caption text-muted">
                  {target.slug}/
                </span>
                {target.disabledReason === null ? null : (
                  <span className="ml-auto shrink-0 text-caption text-warning">
                    {target.disabledReason}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        ref={cancelRef}
        type="button"
        onClick={onCancel}
        className="self-start rounded-sm px-hsp-sm py-vsp-2xs text-caption font-medium text-fg-mild hover:text-fg focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      >
        Cancel
      </button>
    </div>
  );
}
