/**
 * The IME triple guard used by every inline input in the workspace chrome.
 *
 * A Japanese/Chinese/Korean IME turns one physical Enter into two logically
 * different events: "commit the candidate I am composing" and "submit the
 * field". Treating the first as the second is the classic bug — the field
 * commits half-typed romaji and the composition is lost. Escape has the same
 * shape (cancel the candidate vs. revert the field).
 *
 * All three checks are needed, which is why this is a "triple" guard:
 *
 * 1. `ownFlag` — a `compositionstart`/`compositionend` flag the component
 *    keeps itself. The only signal that is reliable in EVERY browser, but it
 *    is ours to maintain, so it can be stale if a component forgets to reset.
 * 2. `event.isComposing` — the standard property, but Safari has historically
 *    reported it inconsistently on `keydown`, and jsdom does not synthesize it
 *    at all unless a test sets it explicitly.
 * 3. `event.keyCode === 229` — the legacy "IME is processing this key"
 *    sentinel. Deprecated, but it is the only signal some IME/browser pairs
 *    emit, so it stays.
 *
 * Any one of the three being true means "the IME owns this key" — never
 * commit, never revert, never submit.
 */

import { useEffect, useRef } from "preact/hooks";
import type { RefObject } from "preact";

export interface CompositionAwareKeyEvent {
  isComposing?: boolean;
  keyCode?: number;
}

export function isImeKeyEvent(
  event: CompositionAwareKeyEvent,
  ownFlag: boolean,
): boolean {
  return ownFlag || event.isComposing === true || event.keyCode === 229;
}

export type CompositionHost = HTMLInputElement | HTMLTextAreaElement;

/**
 * Maintains guard signal #1 (the component's own composition flag) by
 * listening for `compositionstart`/`compositionend` DIRECTLY on the element,
 * and flushes the finished text through `onCompositionEnd`.
 *
 * The listeners are imperative rather than `onCompositionStart` JSX props on
 * purpose. Preact resolves an event prop's DOM name by testing
 * `"oncompositionstart" in element`; browsers expose that property so the
 * prop works there, but jsdom does not, so Preact falls back to
 * `addEventListener("CompositionStart")` — a name that case-sensitively
 * matches nothing and never fires. The JSX form therefore works in
 * production and is DEAD under test, which is the worst possible arrangement
 * for the one guard whose failure mode is silent data corruption. Attaching
 * by literal event name behaves identically in both.
 */
export function useCompositionGuard<T extends CompositionHost>(
  ref: RefObject<T | null>,
  onCompositionEnd: (value: string) => void,
): () => boolean {
  const composing = useRef(false);
  const latest = useRef(onCompositionEnd);
  latest.current = onCompositionEnd;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const start = () => {
      composing.current = true;
    };
    const end = () => {
      composing.current = false;
      latest.current(element.value);
    };

    element.addEventListener("compositionstart", start);
    element.addEventListener("compositionend", end);
    return () => {
      element.removeEventListener("compositionstart", start);
      element.removeEventListener("compositionend", end);
    };
  }, [ref]);

  return () => composing.current;
}
