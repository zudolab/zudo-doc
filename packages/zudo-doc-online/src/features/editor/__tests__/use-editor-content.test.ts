/**
 * The two pure pieces the editor pane's correctness rests on: the token that
 * decides whether queued work still belongs to the page on screen, and the
 * debounced broadcast that carries it.
 *
 * These are unit-testable precisely because the pane keeps them out of the
 * CodeMirror lifecycle — the cross-page write they prevent is otherwise only
 * reproducible by racing a real page load.
 */

import { describe, expect, it, vi } from "vitest";
import {
  EditorContentTicker,
  PageSwitchCounter,
  countWords,
  type EditorContentTick,
} from "../use-editor-content";

function tickOf(pageId: string, markdown: string, token: number): EditorContentTick {
  return { pageId, markdown, token };
}

describe("PageSwitchCounter", () => {
  it("issues a new token only when the page actually changes", () => {
    const counter = new PageSwitchCounter();

    expect(counter.switchTo("page-a")).toBe(1);
    expect(counter.switchTo("page-a")).toBe(1);
    expect(counter.switchTo("page-b")).toBe(2);
    expect(counter.token).toBe(2);
    expect(counter.pageId).toBe("page-b");
  });

  it("treats a token from an earlier visit to the same page as stale", () => {
    const counter = new PageSwitchCounter();
    const firstVisit = counter.switchTo("page-a");
    counter.switchTo("page-b");
    const secondVisit = counter.switchTo("page-a");

    // Re-opening a page does NOT resurrect the old token: the page may have
    // been reloaded or edited elsewhere in between, so work queued during the
    // first visit is just as wrong to apply as another page's would be.
    expect(secondVisit).toBeGreaterThan(firstVisit);
    expect(counter.isCurrent(firstVisit)).toBe(false);
    expect(counter.isCurrent(secondVisit)).toBe(true);
  });

  it("never hands out a token before the first switch", () => {
    const counter = new PageSwitchCounter();
    expect(counter.token).toBe(0);
    expect(counter.pageId).toBeNull();
  });
});

describe("EditorContentTicker", () => {
  it("coalesces a burst of publishes into one delivery of the newest text", () => {
    vi.useFakeTimers();
    try {
      const ticker = new EditorContentTicker({ delayMs: 100 });
      const listener = vi.fn();
      ticker.subscribe(listener);

      ticker.publish(tickOf("page-a", "h", 1));
      ticker.publish(tickOf("page-a", "he", 1));
      ticker.publish(tickOf("page-a", "hello", 1));
      expect(listener).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(ticker.getSnapshot()).toEqual(tickOf("page-a", "hello", 1));
    } finally {
      vi.useRealTimers();
    }
  });

  it("drops a pending tick that a newer page switch has superseded", () => {
    vi.useFakeTimers();
    try {
      const ticker = new EditorContentTicker({ delayMs: 100 });
      const seen: Array<EditorContentTick | null> = [];
      ticker.subscribe(() => seen.push(ticker.getSnapshot()));

      ticker.publish(tickOf("page-a", "text typed into A", 1));
      ticker.publishNow(tickOf("page-b", "body of B", 2));
      vi.advanceTimersByTime(1000);

      // Page A's text must never arrive after the switch — that is exactly
      // how one page's body ends up displayed under another page's title.
      expect(seen).toEqual([tickOf("page-b", "body of B", 2)]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses a stale token even when nothing cancelled its timer", () => {
    const ticker = new EditorContentTicker({
      // A scheduler that never fires, so the only way a tick can be emitted
      // is the explicit flush below — isolating the token check itself.
      scheduleTimeout: () => 0 as unknown as ReturnType<typeof setTimeout>,
      clearTimeoutImpl: () => {},
    });
    const listener = vi.fn();
    ticker.subscribe(listener);

    ticker.publishNow(tickOf("page-b", "body of B", 7));
    listener.mockClear();
    ticker.publish(tickOf("page-a", "late text from A", 3));
    ticker.flush();

    expect(listener).not.toHaveBeenCalled();
    expect(ticker.getSnapshot()).toEqual(tickOf("page-b", "body of B", 7));
  });

  it("delivers a pending tick early on flush, and is a no-op when idle", () => {
    vi.useFakeTimers();
    try {
      const ticker = new EditorContentTicker({ delayMs: 10_000 });
      const listener = vi.fn();
      ticker.subscribe(listener);

      ticker.publish(tickOf("page-a", "typed", 1));
      ticker.flush();
      expect(listener).toHaveBeenCalledTimes(1);

      ticker.flush();
      expect(listener).toHaveBeenCalledTimes(1);

      // The cancelled timer must not fire a second delivery afterwards.
      vi.advanceTimersByTime(20_000);
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the snapshot reference stable between deliveries", () => {
    const ticker = new EditorContentTicker({ delayMs: 0 });
    ticker.publishNow(tickOf("page-a", "one", 1));

    // useSyncExternalStore re-renders whenever getSnapshot returns a new
    // reference, so an unchanged tick must return the identical object.
    expect(ticker.getSnapshot()).toBe(ticker.getSnapshot());
  });

  it("stops notifying an unsubscribed listener", () => {
    const ticker = new EditorContentTicker({ delayMs: 0 });
    const listener = vi.fn();
    ticker.subscribe(listener)();

    ticker.publishNow(tickOf("page-a", "one", 1));
    expect(listener).not.toHaveBeenCalled();
  });

  it("forgets everything on reset", () => {
    const ticker = new EditorContentTicker({ delayMs: 0 });
    ticker.publishNow(tickOf("page-a", "one", 5));
    ticker.reset();

    expect(ticker.getSnapshot()).toBeNull();
    // The watermark resets too, so a fresh editor starting at token 1 is not
    // treated as stale against the previous editor's high-water mark.
    ticker.publishNow(tickOf("page-b", "two", 1));
    expect(ticker.getSnapshot()).toEqual(tickOf("page-b", "two", 1));
  });
});

describe("countWords", () => {
  it("counts whitespace-delimited runs and treats blank input as zero", () => {
    expect(countWords("one two three")).toBe(3);
    expect(countWords("  spaced \n out\tacross lines ")).toBe(4);
    expect(countWords("")).toBe(0);
    expect(countWords("   \n\t ")).toBe(0);
  });
});
