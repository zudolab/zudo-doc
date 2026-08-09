/**
 * The board's two "add" affordances (recipe §6): an inline add-page composer
 * at the foot of every column's card list, and a single ghost column for
 * add-category at the end of the row.
 *
 * Board-wide exclusivity is owned by the caller (`board-view.tsx`) via ONE
 * nullable `openComposerKey` scalar — these components are controlled
 * (`isOpen`/`onOpen`/`onClose`), never track their own "am I open" state, so
 * there is nowhere for a second composer to accidentally stay open.
 *
 * Both composers use `useCompositionGuard` (imperative `compositionstart`/
 * `compositionend` listeners) rather than JSX `onCompositionStart`/
 * `onCompositionEnd` props — the design-system skill's field finding: Preact
 * drops those props under jsdom (and any DOM lacking the matching property),
 * which would leave the IME guard silently dead under test while looking
 * fine in a real browser.
 *
 * `data-no-dnd` on both open forms keeps the activation-gating check in
 * `dnd.ts` from ever mistaking a click inside the input for a drag start —
 * belt-and-suspenders alongside the fact that neither element carries dnd
 * listeners in the first place.
 */

import { useEffect, useRef } from "preact/hooks";
import { isImeKeyEvent, useCompositionGuard } from "../../editor/ime.js";
import { normalizeInlineValue } from "../inline-edit.js";
import { PlusIcon } from "../icons.js";
import { BOARD_COLUMN_WIDTH } from "./tokens.js";

const COMPOSER_INPUT_CLASSES =
  "min-w-[0px] flex-1 rounded-[var(--zdo-kb-card-radius,var(--radius-sm))] border border-dashed border-border-strong bg-bg px-hsp-sm py-vsp-2xs text-small text-fg focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const COMPOSER_BUTTON =
  "shrink-0 rounded-sm px-hsp-sm py-vsp-2xs text-caption font-medium focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const GHOST_AFFORDANCE =
  "flex w-full min-w-[0px] items-center justify-center gap-hsp-sm rounded-[var(--zdo-kb-card-radius,var(--radius-sm))] border border-dashed border-border-strong px-hsp-sm py-vsp-xs text-left text-caption text-muted hover:border-accent hover:bg-accent-soft hover:text-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

export interface AddPageComposerProps {
  categoryTitle: string;
  isOpen: boolean;
  onOpen(): void;
  onClose(): void;
  onAdd(title: string): void;
}

/** Inline below a column's card list. Enter submits and the composer STAYS
 * OPEN for rapid entry (recipe §6) — closing is an explicit Cancel/Escape. */
export function AddPageComposer({
  categoryTitle,
  isOpen,
  onOpen,
  onClose,
  onAdd,
}: AddPageComposerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isComposing = useCompositionGuard(inputRef, () => undefined);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  function commit(): void {
    const value = normalizeInlineValue(inputRef.current?.value ?? "");
    if (value === null) return;
    onAdd(value);
    const input = inputRef.current;
    if (input === null) return;
    input.value = "";
    input.focus();
  }

  if (!isOpen) {
    return (
      <button type="button" onClick={onOpen} className={GHOST_AFFORDANCE}>
        <PlusIcon size="xs" />
        Add page
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={`Add a page to ${categoryTitle}`}
      className="flex min-w-[0px] items-center gap-hsp-xs"
      data-no-dnd
      onKeyDown={(event) => {
        if (event.key !== "Escape" || isImeKeyEvent(event, isComposing())) return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <input
        ref={inputRef}
        type="text"
        aria-label={`Title of the new page in ${categoryTitle}`}
        placeholder="Page title"
        autocomplete="off"
        spellcheck={false}
        className={COMPOSER_INPUT_CLASSES}
        onKeyDown={(event) => {
          if (isImeKeyEvent(event, isComposing())) return;
          if (event.key !== "Enter" || event.shiftKey) return;
          event.preventDefault();
          commit();
        }}
      />
      <button
        type="button"
        onClick={commit}
        className={`${COMPOSER_BUTTON} bg-accent text-accent-fg hover:bg-accent-hover`}
      >
        Add
      </button>
      <button
        type="button"
        onClick={onClose}
        className={`${COMPOSER_BUTTON} border border-border-strong text-fg-mild hover:text-fg`}
      >
        Done
      </button>
    </div>
  );
}

export interface AddCategoryComposerProps {
  isOpen: boolean;
  onOpen(): void;
  onClose(): void;
  onAdd(title: string): void;
}

/** The trailing ghost column. A single commit closes it (recipe §6) — unlike
 * the add-page composer, adding a category is a one-off, not rapid entry. */
export function AddCategoryGhostColumn({
  isOpen,
  onOpen,
  onClose,
  onAdd,
}: AddCategoryComposerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isComposing = useCompositionGuard(inputRef, () => undefined);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  function commit(): void {
    const value = normalizeInlineValue(inputRef.current?.value ?? "");
    if (value === null) return;
    onAdd(value);
    // Unlike the add-page composer, a single commit closes this one
    // (recipe §6) — adding a category is a one-off, not rapid entry.
    onClose();
  }

  const columnSize = { width: BOARD_COLUMN_WIDTH, minWidth: BOARD_COLUMN_WIDTH };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label="Add category"
        className="flex shrink-0 flex-col items-center justify-center gap-vsp-xs self-stretch rounded-[var(--zdo-kb-column-radius,var(--radius-md))] border border-dashed border-border-strong text-caption font-medium text-muted hover:border-accent hover:bg-accent-soft hover:text-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
        style={columnSize}
      >
        <PlusIcon size="sm" />
        Add category
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label="New category"
      className="flex shrink-0 flex-col gap-vsp-sm self-stretch rounded-[var(--zdo-kb-column-radius,var(--radius-md))] border border-dashed border-border-strong p-hsp-sm"
      style={columnSize}
      data-no-dnd
      onKeyDown={(event) => {
        if (event.key !== "Escape" || isImeKeyEvent(event, isComposing())) return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <input
        ref={inputRef}
        type="text"
        aria-label="Title of the new category"
        placeholder="Category title"
        autocomplete="off"
        spellcheck={false}
        className={COMPOSER_INPUT_CLASSES}
        onKeyDown={(event) => {
          if (isImeKeyEvent(event, isComposing())) return;
          if (event.key !== "Enter" || event.shiftKey) return;
          event.preventDefault();
          commit();
        }}
      />
      <div className="flex items-center gap-hsp-xs">
        <button
          type="button"
          onClick={commit}
          className={`${COMPOSER_BUTTON} bg-accent text-accent-fg hover:bg-accent-hover`}
        >
          Add category
        </button>
        <button
          type="button"
          onClick={onClose}
          className={`${COMPOSER_BUTTON} border border-border-strong text-fg-mild hover:text-fg`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
