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
 * ## The duplicate-tab claim (Web Locks)
 *
 * A browser's "duplicate tab" action copies `sessionStorage` verbatim into
 * the new tab, so the stored id alone cannot stay unique. `initClientId()`
 * therefore claims a Web Lock named `zdo-client-id:{id}` at boot and holds it
 * for the tab's lifetime: a duplicate finds the lock already held, mints a
 * fresh id, and re-claims — looping until a claim actually succeeds, since
 * two duplicates can race for the same name.
 *
 * KNOWN LIMITATION: an environment without `navigator.locks` (jsdom, older
 * engines) keeps the pre-fix behavior — two duplicated tabs share one id
 * until one is closed and reopened, and a mutation from either is
 * misclassified as the other's own SSE event, momentarily weakening the
 * dirty-guard between exactly those two tabs. The claim degrades to today's
 * synchronous read rather than failing, so boot never blocks on it.
 *
 * ## Web Locks semantics that shape the code below
 *
 * `navigator.locks.request()`'s returned promise resolves only when the
 * CALLBACK settles — holding a lock for the tab's lifetime means that outer
 * promise NEVER resolves, so it must never be awaited. `claimLock()` instead
 * resolves a separate handshake promise from inside the callback the moment
 * the grant result is known, and returns a never-resolving promise from the
 * callback to keep the lock held.
 */

const STORAGE_KEY = "zdo-client-id";
const LOCK_PREFIX = "zdo-client-id:";

export interface ClientIdStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The single `Lock` field this module reads; structurally satisfied by the real DOM `Lock`. */
export interface ClientIdLockGrant {
  readonly name: string;
}

/** The `navigator.locks` subset this module uses; injectable so tests need no real LockManager. */
export interface ClientIdLockManager {
  request(
    name: string,
    options: { mode: "exclusive"; ifAvailable: true },
    callback: (lock: ClientIdLockGrant | null) => Promise<unknown>,
  ): Promise<unknown>;
}

export interface ClientIdOptions {
  /** Injectable for tests; defaults to `sessionStorage`. */
  storage?: ClientIdStorage;
  /** Injectable for tests; defaults to `crypto.randomUUID`. */
  createId?: () => string;
}

export interface InitClientIdOptions extends ClientIdOptions {
  /**
   * Injectable for tests; defaults to `navigator.locks`. Pass `null` to
   * exercise the no-Web-Locks fallback explicitly.
   */
  lockManager?: ClientIdLockManager | null;
}

/**
 * Cached only for the zero-argument (real-browser) call path, so a page that
 * calls `getClientId()` many times does not round-trip `sessionStorage` every
 * time. A call that supplies an explicit `storage` (a test) always reads
 * fresh and never populates or consults the cache — otherwise the first test
 * to call this in a process would poison every later test with its id.
 */
let cachedId: string | undefined;

/**
 * The in-flight (or settled) claim, so repeated `initClientId()` calls share
 * one result. Without this, a second call would find the tab's OWN held lock
 * and needlessly re-mint.
 */
let initPromise: Promise<string> | undefined;

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

/**
 * Claims this tab's id under a Web Lock, minting a fresh one for as long as
 * the claim keeps losing to a duplicate tab. Idempotent and concurrency-safe:
 * every call after the first returns the same promise. Never rejects — any
 * failure (no `navigator.locks`, a rejected request, unavailable storage)
 * degrades to the synchronous behavior rather than leaving a blank SPA.
 */
export function initClientId(options: InitClientIdOptions = {}): Promise<string> {
  if (initPromise === undefined) {
    initPromise = runInit(options).then((id) => {
      if (options.storage === undefined) cachedId = id;
      return id;
    });
  }
  return initPromise;
}

async function runInit(options: InitClientIdOptions): Promise<string> {
  const createId = options.createId ?? (() => crypto.randomUUID());
  let id: string | undefined;

  try {
    const storage = options.storage ?? resolveDefaultStorage();
    const existing = storage.getItem(STORAGE_KEY);
    id = existing ?? createId();
    if (existing === null) storage.setItem(STORAGE_KEY, id);

    const locks = resolveLockManager(options);
    if (locks === null) return id;

    // Loop rather than mint-once: two duplicated tabs can lose the same race,
    // and the freshly minted id could itself already be claimed.
    for (;;) {
      const granted = await claimLock(locks, LOCK_PREFIX + id);
      if (granted) return id;
      id = createId();
      storage.setItem(STORAGE_KEY, id);
    }
  } catch {
    return id ?? createId();
  }
}

/**
 * Resolves `true` once the lock is held (kept for the tab's lifetime) or
 * `false` when a duplicate tab already holds it. The `request()` promise is
 * deliberately never awaited — see the file header.
 */
function claimLock(locks: ClientIdLockManager, name: string): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    let granted = false;

    const outcome = locks.request(name, { mode: "exclusive", ifAvailable: true }, (lock) => {
      if (lock === null) {
        resolve(false);
        return Promise.resolve();
      }
      granted = true;
      resolve(true);
      return new Promise<never>(() => {});
    });

    // `request()` can reject before the callback ever runs (bad name,
    // unsupported engine). Once the lock is granted the outer promise stays
    // pending forever by design, so a late rejection cannot arrive there.
    Promise.resolve(outcome).catch((error: unknown) => {
      if (!granted) reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

/** Test-only: clears the module-level id cache and any completed/in-flight claim. */
export function resetClientIdState(): void {
  cachedId = undefined;
  initPromise = undefined;
}

function resolveLockManager(options: InitClientIdOptions): ClientIdLockManager | null {
  if (options.lockManager !== undefined) return options.lockManager;
  if (typeof navigator === "undefined") return null;
  return (navigator as Navigator & { locks?: ClientIdLockManager }).locks ?? null;
}

function resolveDefaultStorage(): ClientIdStorage {
  if (typeof sessionStorage === "undefined") {
    throw new Error(
      "getClientId: sessionStorage is unavailable in this environment; pass an explicit storage.",
    );
  }
  return sessionStorage;
}
