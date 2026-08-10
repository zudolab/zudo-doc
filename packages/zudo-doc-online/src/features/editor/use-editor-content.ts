/**
 * The editor buffer's content plumbing — everything about "what text is in
 * the pane right now" that must NOT live in framework state.
 *
 * Two rules drive this file, and both exist because the obvious
 * implementation is subtly wrong:
 *
 * 1. **The document lives in a ref, never in per-keystroke component state.**
 *    A CodeMirror pane whose document round-trips through a `useState` on
 *    every keystroke re-renders the host, which re-runs the sync effect,
 *    which writes the doc back into the view — and CodeMirror's measure loop
 *    then fights the caret for the rest of the session. The pane therefore
 *    keeps the document in refs and publishes a *debounced tick* for the
 *    consumers that genuinely need the text (the word count here, the live
 *    preview in #3338). Nothing subscribes per keystroke.
 * 2. **Every tick carries the page it came from, plus a monotonic switch
 *    token.** A debounced tick scheduled while page A was open must never be
 *    delivered after the user has moved to page B — that is how a preview
 *    ends up showing one page's body under another page's title, and how an
 *    autosave could be handed the wrong document. `PageSwitchCounter` issues
 *    the token; `EditorContentTicker` refuses to emit one that a newer
 *    switch has already superseded.
 */

import { useCallback } from "preact/hooks";
import { useSyncExternalStore } from "preact/compat";

/** How long the pane coalesces keystrokes before telling anyone the text moved. */
export const CONTENT_TICK_MS = 100;

export interface EditorContentTick {
  /** The page the text belongs to. Consumers MUST check this. */
  pageId: string;
  markdown: string;
  /** The `PageSwitchCounter` token the text was captured under. */
  token: number;
}

/**
 * Issues a strictly increasing token every time the pane switches to a
 * different page, so any work started under an older token can be recognised
 * as stale and dropped.
 *
 * Re-selecting a page that was open earlier issues a NEW token rather than
 * reusing the old one: by then the page may have been reloaded or edited
 * elsewhere, so work queued during the first visit is just as stale as work
 * queued for a different page.
 */
export class PageSwitchCounter {
  private currentToken = 0;
  private currentPageId: string | null = null;

  /** The token in force right now. */
  get token(): number {
    return this.currentToken;
  }

  /** The page in force right now, or `null` before the first switch. */
  get pageId(): string | null {
    return this.currentPageId;
  }

  /** Bumps the token when (and only when) the page actually changes. */
  switchTo(pageId: string): number {
    if (pageId === this.currentPageId) return this.currentToken;
    this.currentPageId = pageId;
    this.currentToken += 1;
    return this.currentToken;
  }

  isCurrent(token: number): boolean {
    return token === this.currentToken;
  }
}

export type ContentTickListener = () => void;

export interface EditorContentTickerOptions {
  /** Trailing debounce window. Defaults to `CONTENT_TICK_MS`. */
  delayMs?: number;
  /** Injectable so specs can drive the debounce without global timer patching. */
  scheduleTimeout?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeoutImpl?: (handle: ReturnType<typeof setTimeout>) => void;
}

/**
 * A trailing-debounced broadcast of the editor's current document.
 *
 * Shaped for `useSyncExternalStore`: `getSnapshot()` returns the same object
 * reference until a new tick is actually emitted, so a subscriber never
 * re-renders on an unchanged value.
 */
export class EditorContentTicker {
  private readonly delayMs: number;
  private readonly scheduleTimeout: NonNullable<
    EditorContentTickerOptions["scheduleTimeout"]
  >;
  private readonly clearTimeoutImpl: NonNullable<
    EditorContentTickerOptions["clearTimeoutImpl"]
  >;

  private readonly listeners = new Set<ContentTickListener>();
  private snapshot: EditorContentTick | null = null;
  private pending: EditorContentTick | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** The highest token ever handed to this ticker — the staleness watermark. */
  private newestToken = 0;

  constructor(options: EditorContentTickerOptions = {}) {
    this.delayMs = options.delayMs ?? CONTENT_TICK_MS;
    // Wrapped, never a bare `?? setTimeout`. A bare global stored on a field is
    // later invoked as `this.scheduleTimeout(...)`, which hands the browser's
    // `setTimeout` a `this` of this instance — Chrome's Web IDL binding rejects
    // that with `TypeError: Illegal invocation`, and because this runs inside
    // CodeMirror's update listener the throw aborts the update, so the ticker
    // never publishes. Node and jsdom don't check `this`, so the suite stays
    // green while the real browser is broken. Do not "simplify" these away.
    this.scheduleTimeout =
      options.scheduleTimeout ?? ((callback, ms) => setTimeout(callback, ms));
    this.clearTimeoutImpl =
      options.clearTimeoutImpl ?? ((handle) => clearTimeout(handle));
  }

  subscribe(listener: ContentTickListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): EditorContentTick | null {
    return this.snapshot;
  }

  /** Debounced publish. A newer call supersedes an unfired older one. */
  publish(tick: EditorContentTick): void {
    this.newestToken = Math.max(this.newestToken, tick.token);
    this.pending = tick;
    this.cancelTimer();
    this.timer = this.scheduleTimeout(() => {
      this.timer = undefined;
      this.emitPending();
    }, this.delayMs);
  }

  /**
   * Immediate publish, cancelling anything pending. Used on a page switch:
   * the new page's body must reach subscribers now, and the old page's
   * queued tick must never arrive after it.
   */
  publishNow(tick: EditorContentTick): void {
    this.newestToken = Math.max(this.newestToken, tick.token);
    this.pending = tick;
    this.cancelTimer();
    this.emitPending();
  }

  /** Emits a pending tick early. A no-op when nothing is pending. */
  flush(): void {
    if (this.pending === null) return;
    this.cancelTimer();
    this.emitPending();
  }

  /** Drops pending work and the published snapshot (unmount, spec teardown). */
  reset(): void {
    this.cancelTimer();
    this.pending = null;
    this.snapshot = null;
    this.newestToken = 0;
  }

  private emitPending(): void {
    const tick = this.pending;
    this.pending = null;
    // A tick issued before a newer page switch is not merely late, it is
    // wrong: delivering it would attribute one page's body to another.
    if (tick === null || tick.token < this.newestToken) return;
    this.snapshot = tick;
    for (const listener of this.listeners) listener();
  }

  private cancelTimer(): void {
    if (this.timer === undefined) return;
    this.clearTimeoutImpl(this.timer);
    this.timer = undefined;
  }
}

/**
 * The tick the editor pane publishes to. It is a module singleton because
 * exactly one editor buffer is on screen per window, and the consumers that
 * need it (the status bar's word count, #3338's preview) are rendered by a
 * different subtree than the pane — threading a provider through the chrome
 * for a single value would buy nothing. A pop-out window (#3339) loads its
 * own module instance and therefore gets its own ticker, which is correct:
 * it has its own editor.
 */
export const editorContentTicker = new EditorContentTicker();

/** Subscribes a component to the editor's debounced content tick. */
export function useEditorContentTick(
  ticker: EditorContentTicker = editorContentTicker,
): EditorContentTick | null {
  return useSyncExternalStore(
    useCallback((listener: () => void) => ticker.subscribe(listener), [ticker]),
    useCallback(() => ticker.getSnapshot(), [ticker]),
  );
}

/**
 * Whitespace-delimited word count. Deliberately naive — it is a writing-pace
 * indicator, not a billing metric — but it runs over the whole document, so
 * it is driven by the debounced tick rather than by every keystroke.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}
