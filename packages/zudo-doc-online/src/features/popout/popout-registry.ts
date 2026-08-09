/**
 * The module-level pop-out window registry (popout-pattern.md recipe items
 * 2 and 5): tracks `{windowName, pageId, winRef}` for every page currently
 * popped out. Survives route changes in the main window (module scope, not
 * component state) but deliberately NOT app restarts — a fresh page load
 * starts with no known popouts, even if a stale window from a previous
 * session is still open (it keeps rendering from the API regardless; see
 * the recipe's "main window closing simply orphans the popout" note).
 *
 * Two close-detection paths, either of which unregisters an entry and
 * notifies subscribers:
 *
 * 1. **Poll.** Every registered pageId gets its own 1s `winRef.closed`
 *    check. This is the ONLY path that survives a popout crashing, being
 *    force-quit, or navigating away before its `pagehide` handler can run —
 *    browsers give no reliable external destroy event, so polling is the
 *    guaranteed fallback.
 * 2. **BroadcastChannel.** The popout's own best-effort `pagehide`
 *    announcement (`popout-bus.ts`) arrives faster than the next poll tick
 *    in the common "user closed the window normally" case — purely a
 *    latency improvement over path 1, never a substitute for it.
 *
 * `open()`/`focus()` are the same idempotent operation: calling
 * `windowOpener` again with a name that already has an open window returns
 * a reference to THAT window (the browser reuses it — no duplicate) rather
 * than creating a new one, which is exactly what makes a re-click "focus"
 * instead of "open a second copy."
 */

import {
  POPOUT_CHANNEL_NAME,
  POPOUT_PAGEHIDE_EVENT,
  parsePopoutEnvelope,
  type PopoutChannelLike,
} from "./popout-bus";

/** The slice of `Window` this registry actually uses — kept structural so tests never need a real `Window`. */
export interface PopoutWindowLike {
  readonly closed: boolean;
  close(): void;
}

export type PopoutWindowOpener = (
  url: string,
  windowName: string,
  windowFeatures: string,
) => PopoutWindowLike | null;

/** `900x600` per the spec's fixed pop-out size — a preview window, not a resizable app surface. */
const POPOUT_WINDOW_FEATURES = "width=900,height=600,popup";
const CLOSE_POLL_MS = 1000;

export function popoutWindowName(pageId: string): string {
  return `zdo-popout-${pageId}`;
}

/** Hash-only — resolves against the opener's own document location, i.e. the same origin/path as the main app. */
export function popoutHashUrl(pageId: string): string {
  return `#/popped-out/preview/${encodeURIComponent(pageId)}`;
}

interface PopoutEntry {
  windowName: string;
  pageId: string;
  winRef: PopoutWindowLike;
}

export interface PopoutRegistryOptions {
  /** Defaults to the real `window.open`. Injectable so tests never open a real window. */
  windowOpener?: PopoutWindowOpener;
  /** Defaults to `createPopoutChannel()` from popout-bus.ts. Injectable so tests can drive a fake channel; `null` disables the fast path (poll-only). */
  channel?: PopoutChannelLike | null;
  setIntervalImpl?: typeof setInterval;
  clearIntervalImpl?: typeof clearInterval;
}

function defaultWindowOpener(
  url: string,
  windowName: string,
  windowFeatures: string,
): PopoutWindowLike | null {
  return window.open(url, windowName, windowFeatures);
}

export class PopoutRegistry {
  private readonly windowOpener: PopoutWindowOpener;
  private readonly setIntervalImpl: typeof setInterval;
  private readonly clearIntervalImpl: typeof clearInterval;

  private readonly entries = new Map<string, PopoutEntry>();
  private readonly pollTimers = new Map<string, ReturnType<typeof setInterval>>();
  private readonly listeners = new Set<() => void>();

  constructor(options: PopoutRegistryOptions = {}) {
    this.windowOpener = options.windowOpener ?? defaultWindowOpener;
    this.setIntervalImpl = options.setIntervalImpl ?? setInterval;
    this.clearIntervalImpl = options.clearIntervalImpl ?? clearInterval;

    const channel = options.channel === undefined ? this.createDefaultChannel() : options.channel;
    if (channel !== null) {
      channel.onmessage = (event: MessageEvent) => {
        const envelope = parsePopoutEnvelope(event.data);
        if (envelope?.event !== POPOUT_PAGEHIDE_EVENT || !envelope.windowName) return;
        this.unregisterByWindowName(envelope.windowName);
      };
    }
  }

  private createDefaultChannel(): PopoutChannelLike | null {
    if (typeof BroadcastChannel === "undefined") return null;
    return new BroadcastChannel(POPOUT_CHANNEL_NAME);
  }

  isOpen(pageId: string): boolean {
    return this.entries.has(pageId);
  }

  /**
   * Opens (or, for an already-registered pageId, focuses) the pop-out for
   * `pageId`. A popup-blocked call (`windowOpener` returns `null`) is a
   * silent no-op — nothing to register, and there is no reliable way to
   * distinguish "blocked" from "user dismissed the permission prompt" to
   * report back.
   */
  open(pageId: string): void {
    const windowName = popoutWindowName(pageId);
    const url = popoutHashUrl(pageId);
    const winRef = this.windowOpener(url, windowName, POPOUT_WINDOW_FEATURES);
    if (winRef === null) return;

    const alreadyOpen = this.entries.has(pageId);
    this.entries.set(pageId, { windowName, pageId, winRef });
    if (!alreadyOpen) {
      this.startPolling(pageId);
      this.emit();
    }
  }

  /** Alias for `open` — "Focus" re-opens by name, which is what makes an already-open popout come forward instead of duplicating. */
  focus(pageId: string): void {
    this.open(pageId);
  }

  /** Closes the pop-out window via the registry's own reference and unregisters it. */
  bringBack(pageId: string): void {
    const entry = this.entries.get(pageId);
    if (!entry) return;
    try {
      entry.winRef.close();
    } catch {
      // The window may already be gone — unregistering below is what matters.
    }
    this.unregister(pageId);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Test/teardown seam: stops every poll timer and closes the channel. Does not close any open popout windows. */
  dispose(): void {
    for (const timer of this.pollTimers.values()) this.clearIntervalImpl(timer);
    this.pollTimers.clear();
  }

  private startPolling(pageId: string): void {
    const timer = this.setIntervalImpl(() => {
      const entry = this.entries.get(pageId);
      if (!entry) {
        this.clearIntervalImpl(timer);
        return;
      }
      if (entry.winRef.closed) this.unregister(pageId);
    }, CLOSE_POLL_MS);
    this.pollTimers.set(pageId, timer);
  }

  private unregisterByWindowName(windowName: string): void {
    for (const entry of this.entries.values()) {
      if (entry.windowName === windowName) {
        this.unregister(entry.pageId);
        return;
      }
    }
  }

  private unregister(pageId: string): void {
    const timer = this.pollTimers.get(pageId);
    if (timer !== undefined) {
      this.clearIntervalImpl(timer);
      this.pollTimers.delete(pageId);
    }
    if (this.entries.delete(pageId)) this.emit();
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }
}

/** The production singleton — the main window's one registry, shared by the pop-out button and the in-pane placeholder regardless of which page's pane mounted it. */
export const popoutRegistry = new PopoutRegistry();
