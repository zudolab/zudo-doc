/**
 * Key handling for every inline text editor on the outline surface.
 *
 * The whole point of this module is the composition guard. Japanese (and
 * Chinese, and Korean) authoring is first-class here, and an IME converts
 * text with the SAME Enter and Escape keys the editor uses to commit and
 * cancel: pressing Enter to accept a kanji candidate must never also save the
 * row, and Escape to dismiss the candidate list must never also throw the
 * edit away.
 *
 * No single signal detects that reliably across browsers, so all three are
 * checked:
 *
 * 1. `composing` — our own flag, flipped by the field's `compositionstart` /
 *    `compositionend` handlers. Authoritative when we get both events, but
 *    Safari has historically fired `compositionend` BEFORE the `keydown` that
 *    ended the composition, which clears the flag one key too early.
 * 2. `isComposing` — the standard `KeyboardEvent` property. Correct where it
 *    is implemented, absent in older engines.
 * 3. `keyCode === 229` — the legacy "this keystroke belongs to the IME"
 *    sentinel. Deprecated, and precisely because of that it is still the one
 *    signal every engine has emitted for two decades.
 *
 * Any one of them being true means the keystroke is the IME's, not ours.
 */

/** The slice of a keyboard event this module reads. */
export interface InlineEditKeyEvent {
  key: string;
  isComposing?: boolean | undefined;
  keyCode?: number | undefined;
}

export type InlineEditIntent = "commit" | "cancel" | "none";

/** The legacy sentinel every engine emits while an IME owns the keystroke. */
export const IME_KEY_CODE = 229;

/**
 * True when this keystroke belongs to an active input-method composition and
 * must not be read as a commit or a cancel.
 */
export function isCompositionKey(
  event: InlineEditKeyEvent,
  composing: boolean,
): boolean {
  return composing || event.isComposing === true || event.keyCode === IME_KEY_CODE;
}

/**
 * Enter commits, Escape cancels, everything else (and anything the IME owns)
 * is left alone.
 */
export function inlineEditIntent(
  event: InlineEditKeyEvent,
  composing: boolean,
): InlineEditIntent {
  if (isCompositionKey(event, composing)) return "none";
  if (event.key === "Enter") return "commit";
  if (event.key === "Escape") return "cancel";
  return "none";
}

/**
 * The value an inline editor should actually send: trimmed, or null when the
 * field holds nothing worth committing. Callers treat null as "ignore this
 * commit and keep editing" rather than sending an empty title the outline
 * core would reject anyway.
 */
export function normalizeInlineValue(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** True when committing `raw` would be a no-op against `current`. */
export function isUnchangedValue(raw: string, current: string): boolean {
  return raw.trim() === current.trim();
}
