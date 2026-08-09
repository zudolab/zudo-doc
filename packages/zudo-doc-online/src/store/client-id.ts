/**
 * A stable per-tab client identifier.
 *
 * Every mutation the HTTP provider sends carries this id; the server echoes
 * it back as `origin` on the SSE event the mutation causes (epic #3327). The
 * events client (`events.ts`) compares an incoming event's `origin` against
 * this id to tell "a change I just made" from "a change another tab or
 * client made" without any server-side session concept.
 *
 * `sessionStorage` (not `localStorage`) is deliberate: the id survives a
 * reload of the same tab but is never shared with a genuinely new tab.
 *
 * KNOWN LIMITATION: a browser's "duplicate tab" action copies `sessionStorage`
 * verbatim into the new tab, so two tabs opened that way share one id until
 * one of them is closed and reopened — a mutation from either would be
 * misclassified as the other's own event, momentarily weakening the SSE
 * dirty-guard between exactly those two tabs. Detecting that reliably needs
 * live cross-tab coordination (e.g. the Web Locks API or a BroadcastChannel
 * handshake at startup), which is an async, wider-reaching change than this
 * synchronous accessor should carry — left for a follow-up rather than
 * fixed here.
 */

const STORAGE_KEY = "zdo-client-id";

export interface ClientIdStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ClientIdOptions {
  /** Injectable for tests; defaults to `sessionStorage`. */
  storage?: ClientIdStorage;
  /** Injectable for tests; defaults to `crypto.randomUUID`. */
  createId?: () => string;
}

/**
 * Cached only for the zero-argument (real-browser) call path, so a page that
 * calls `getClientId()` many times does not round-trip `sessionStorage` every
 * time. A call that supplies an explicit `storage` (a test) always reads
 * fresh and never populates or consults the cache — otherwise the first test
 * to call this in a process would poison every later test with its id.
 */
let cachedId: string | undefined;

export function getClientId(options: ClientIdOptions = {}): string {
  if (options.storage === undefined && cachedId !== undefined) return cachedId;

  const storage = options.storage ?? resolveDefaultStorage();
  const createId = options.createId ?? (() => crypto.randomUUID());

  const existing = storage.getItem(STORAGE_KEY);
  const id = existing ?? createId();
  if (existing === null) storage.setItem(STORAGE_KEY, id);

  if (options.storage === undefined) cachedId = id;
  return id;
}

/** Test-only: clears the module-level cache used by the zero-argument path. */
export function resetClientIdCache(): void {
  cachedId = undefined;
}

function resolveDefaultStorage(): ClientIdStorage {
  if (typeof sessionStorage === "undefined") {
    throw new Error(
      "getClientId: sessionStorage is unavailable in this environment; pass an explicit storage.",
    );
  }
  return sessionStorage;
}
