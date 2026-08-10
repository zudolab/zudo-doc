/**
 * The control-plane message bus between a pop-out window and its opener,
 * over `BroadcastChannel("zdo-popout")` (popout-pattern.md recipe item 6).
 *
 * Only ONE message kind exists in v1: the popout announces its own
 * `window.name` on `pagehide` so the opener can unregister it immediately
 * instead of waiting for the next 1s close-detection poll
 * (`popout-registry.ts`). Nothing content-related crosses this bus —
 * per the recipe, the popout always re-reads content from the API/SSE
 * stream itself.
 *
 * Kept as a pre-serialized JSON envelope `{event, windowName?, payload?}`
 * per the recipe's bus-discipline rule, so a second message kind (should one
 * ever be needed) slots into the same shape without a breaking change. The
 * parser never throws: malformed input becomes `null` and is dropped by the
 * caller, since a channel is shared by every same-origin tab/window and a
 * message from an unrelated sender must not crash this one.
 */

export const POPOUT_CHANNEL_NAME = "zdo-popout";

export const POPOUT_PAGEHIDE_EVENT = "popout-pagehide";

export interface PopoutEnvelope {
  event: string;
  /** Present on `popout-pagehide` — the closing window's own `window.name`. */
  windowName?: string;
  payload?: unknown;
}

/** The slice of the DOM `BroadcastChannel` this module actually uses. */
export interface PopoutChannelLike {
  postMessage(data: unknown): void;
  close(): void;
  onmessage: ((event: MessageEvent) => void) | null;
}

/**
 * `null` outside a browser (no `BroadcastChannel` global, e.g. a non-jsdom
 * unit test) — every call site treats a `null` channel as "close detection
 * degrades to polling only," never as a hard failure.
 */
export function createPopoutChannel(): PopoutChannelLike | null {
  if (typeof BroadcastChannel === "undefined") return null;
  return new BroadcastChannel(POPOUT_CHANNEL_NAME);
}

/** Parses a `BroadcastChannel` message's `data` into a `PopoutEnvelope`, or `null` if it isn't one. */
export function parsePopoutEnvelope(data: unknown): PopoutEnvelope | null {
  if (typeof data !== "object" || data === null) return null;
  const candidate = data as Partial<PopoutEnvelope>;
  if (typeof candidate.event !== "string") return null;
  return {
    event: candidate.event,
    ...(typeof candidate.windowName === "string" ? { windowName: candidate.windowName } : {}),
    ...(candidate.payload !== undefined ? { payload: candidate.payload } : {}),
  };
}

/**
 * Called from the pop-out window's own `pagehide` handler. Best-effort: a
 * missing `BroadcastChannel` (or the post itself throwing, e.g. the channel
 * closing mid-navigation) is swallowed — the opener's poll-based detection
 * (`popout-registry.ts`) is the guaranteed fallback, so this path only ever
 * makes the restore feel faster, never more correct.
 */
export function announcePopoutClose(windowName: string): void {
  const channel = createPopoutChannel();
  if (channel === null) return;
  try {
    channel.postMessage({ event: POPOUT_PAGEHIDE_EVENT, windowName } satisfies PopoutEnvelope);
  } catch {
    // Best-effort — see header comment.
  } finally {
    channel.close();
  }
}
