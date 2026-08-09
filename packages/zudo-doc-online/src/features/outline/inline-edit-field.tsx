/**
 * The one inline text editor every rename / add / slug affordance on this
 * surface uses.
 *
 * Two decisions carry the IME requirement:
 *
 * - **The input is uncontrolled.** A controlled `value` re-renders on every
 *   keystroke, and re-rendering an input mid-composition is what makes IME
 *   text drop or duplicate characters in virtual-DOM libraries. The committed
 *   value is read off the DOM node instead, at the moment it is committed.
 * - **Enter and Escape go through `inlineEditIntent`**, which drops any
 *   keystroke an input method owns (see `inline-edit.ts` for why one signal
 *   is not enough). Committing on an IME's confirm-candidate Enter is the
 *   single most common way a rename UI breaks for Japanese authors.
 *
 * Blur intentionally does nothing: an IME dropdown can steal focus, and
 * committing (or cancelling) on blur would fire mid-conversion. The Save and
 * Cancel buttons are the pointer path.
 */

import { useEffect, useRef } from "preact/hooks";
import { inlineEditIntent, normalizeInlineValue } from "./inline-edit.js";

export interface InlineEditFieldProps {
  /** Accessible name for the field — rows have no visible label. */
  label: string;
  initialValue: string;
  placeholder?: string;
  saveLabel?: string;
  /** Never called with an empty value. */
  onCommit(value: string): void;
  onCancel(): void;
  /** Holds the surface's live-refresh guard for as long as this is mounted. */
  beginEditing?: (() => () => void) | undefined;
  /** Renders the value in the monospace slug style. */
  mono?: boolean;
}

const BUTTON_BASE =
  "shrink-0 rounded-sm px-hsp-sm py-vsp-2xs text-caption font-medium focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

export function InlineEditField({
  label,
  initialValue,
  placeholder,
  saveLabel = "Save",
  onCommit,
  onCancel,
  beginEditing,
  mono = false,
}: InlineEditFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const composingRef = useRef(false);

  useEffect(() => beginEditing?.(), [beginEditing]);

  useEffect(() => {
    const input = inputRef.current;
    if (input === null) return;
    input.focus();
    input.select();
  }, []);

  function commit(): void {
    const value = normalizeInlineValue(inputRef.current?.value ?? "");
    // An empty field is not a delete — keep the editor open rather than
    // sending a title the outline core would reject anyway.
    if (value === null) return;
    onCommit(value);
  }

  return (
    <span className="flex min-w-[0px] flex-1 items-center gap-hsp-xs">
      <input
        ref={inputRef}
        type="text"
        aria-label={label}
        defaultValue={initialValue}
        placeholder={placeholder}
        autocomplete="off"
        spellcheck={false}
        className={`min-w-[0px] flex-1 rounded-sm border border-border-strong bg-bg px-hsp-sm py-vsp-2xs text-small text-fg focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 ${
          mono ? "font-mono text-caption" : ""
        }`}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
        }}
        onKeyDown={(event) => {
          const intent = inlineEditIntent(event, composingRef.current);
          if (intent === "none") return;
          event.preventDefault();
          event.stopPropagation();
          if (intent === "commit") {
            commit();
          } else {
            onCancel();
          }
        }}
      />
      <button
        type="button"
        onClick={commit}
        className={`${BUTTON_BASE} bg-accent text-accent-fg hover:bg-accent-hover`}
      >
        {saveLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className={`${BUTTON_BASE} border border-border-strong text-fg-mild hover:text-fg`}
      >
        Cancel
      </button>
    </span>
  );
}
