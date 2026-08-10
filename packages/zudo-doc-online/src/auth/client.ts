/**
 * Headless auth client against zudo-doc-online-worker's Better Auth mount
 * (epic zudolab/zudo-doc#3361, issue #3365). Framework-free — consumed by
 * `main.tsx`'s boot wiring and `account-menu.tsx`. Fetch and storage are
 * both injectable so tests never touch the network or real `localStorage`.
 *
 * Wire contract (frozen by `packages/zudo-doc-online-worker/src/__tests__/
 * auth-contract.test.ts`): `POST /api/auth/sign-up/email` and
 * `POST /api/auth/sign-in/email` issue a bearer session token via the
 * `set-auth-token` response header; `GET /api/me` is the app-owned
 * bearer-gated route that resolves the current user or 401s; `POST
 * /api/auth/sign-out` revokes the token server-side.
 *
 * Invalidation semantics (frozen, see issue #3365 — encoded as tests in
 * `__tests__/client.test.ts`):
 * - Only a 401 from a session/protected request (`GET /api/me`) clears the
 *   stored token.
 * - 403 does NOT clear it (valid-but-forbidden or an origin rejection).
 * - A failed sign-up/sign-in never touches an existing token — nothing is
 *   written until a new token is actually issued.
 * - `signOut()` clears the local token unconditionally; the server revoke
 *   call is best-effort and its failure never blocks the local sign-out.
 * - A transient network failure on `resumeSession()` leaves the store's
 *   current state untouched (the "optimistic session") rather than forcing
 *   a signed-out flash.
 * - When the storage write fails, the token is retained in memory for the
 *   page load, so `signOut()` can still revoke it server-side.
 */
import { authStore, type AuthStore, type AuthUser } from "./store.js";

const STORAGE_KEY = "zdo:auth:token";
const DEFAULT_BASE_URL = "http://localhost:8787";

export interface AuthStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class AuthClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthClientError";
  }
}

export interface AuthClientOptions {
  /** Defaults to `import.meta.env.VITE_AUTH_API_URL`, then `http://localhost:8787`. */
  baseUrl?: string;
  /** Injectable so tests never perform a real network call. */
  fetchImpl?: typeof fetch;
  /** Defaults to `resolveDefaultStorage()`; every access is try/catch-guarded regardless. */
  storage?: AuthStorage;
  /** Defaults to the shared `authStore` singleton. */
  store?: AuthStore;
}

export interface AuthClient {
  signUp(email: string, password: string, name: string): Promise<AuthUser>;
  signIn(email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  resumeSession(): Promise<AuthUser | null>;
}

function resolveDefaultBaseUrl(): string {
  const fromEnv = (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_AUTH_API_URL;
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_BASE_URL;
}

function createMemoryStorage(): AuthStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

/**
 * Reading the `window.localStorage` PROPERTY can itself throw `SecurityError`
 * when storage is disabled by policy or the origin is sandboxed — before any
 * per-call guard below gets a chance to run. `main.tsx` constructs the client
 * during boot, so an unguarded read would abort the whole SPA render.
 */
export function resolveDefaultStorage(): AuthStorage {
  try {
    const fromWindow = globalThis.window?.localStorage;
    if (fromWindow) return fromWindow;
  } catch {
    // Storage access denied outright — fall through to the inert fallback.
  }
  return createMemoryStorage();
}

function readStoredToken(storage: AuthStorage): string | null {
  try {
    return storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function clearStoredToken(storage: AuthStorage): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Losing the clear write is not fatal — the in-memory fallback is
    // cleared alongside it regardless.
  }
}

interface ErrorBody {
  error?: { message?: unknown };
  message?: unknown;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.clone().json()) as ErrorBody;
    const message = body.error?.message ?? body.message;
    if (typeof message === "string" && message.length > 0) return message;
  } catch {
    // Non-JSON or empty body — fall through to the generic message.
  }
  return `Request failed with status ${response.status}.`;
}

export function createAuthClient(options: AuthClientOptions = {}): AuthClient {
  const baseUrl = options.baseUrl ?? resolveDefaultBaseUrl();
  const fetchImpl = options.fetchImpl ?? fetch;
  const storage: AuthStorage = options.storage ?? resolveDefaultStorage();
  const store = options.store ?? authStore;

  /**
   * Holds the session token whenever the storage write failed (private mode,
   * quota). Without it `signOut()` would find no token, skip the server
   * revoke, and leave the server session valid until expiry even though the
   * store says signed-out.
   */
  let memoryToken: string | null = null;

  function persistToken(token: string): void {
    memoryToken = token;
    try {
      storage.setItem(STORAGE_KEY, token);
      memoryToken = null;
    } catch {
      // Storage unavailable — `memoryToken` carries the session for this page
      // load; it just won't survive a reload.
    }
  }

  function readToken(): string | null {
    return readStoredToken(storage) ?? memoryToken;
  }

  function clearToken(): void {
    memoryToken = null;
    clearStoredToken(storage);
  }

  function requestMe(token: string): Promise<Response> {
    return fetchImpl(`${baseUrl}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function emailPasswordRequest(
    path: string,
    body: Record<string, unknown>,
  ): Promise<string> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new AuthClientError(response.status, await readErrorMessage(response));
    }

    const token = response.headers.get("set-auth-token");
    if (!token) {
      throw new AuthClientError(
        response.status,
        "Sign-in succeeded but issued no session token.",
      );
    }
    return token;
  }

  /** Fetches the canonical user for a just-issued token and updates the store. */
  async function establishSession(token: string): Promise<AuthUser> {
    persistToken(token);

    const response = await requestMe(token);
    if (response.status === 401) {
      // A freshly issued token that /api/me immediately rejects — treat it
      // like any other 401 from a protected request.
      clearToken();
      store.setSignedOut();
      throw new AuthClientError(401, "Session was rejected immediately after sign-in.");
    }
    if (!response.ok) {
      throw new AuthClientError(response.status, await readErrorMessage(response));
    }

    const { user } = (await response.json()) as { user: AuthUser };
    store.setSignedIn(user);
    return user;
  }

  return {
    async signUp(email, password, name) {
      const token = await emailPasswordRequest("/api/auth/sign-up/email", {
        email,
        password,
        name,
      });
      return establishSession(token);
    },

    async signIn(email, password) {
      const token = await emailPasswordRequest("/api/auth/sign-in/email", {
        email,
        password,
      });
      return establishSession(token);
    },

    async signOut() {
      const token = readToken();
      clearToken();
      store.setSignedOut();

      if (!token) return;
      try {
        await fetchImpl(`${baseUrl}/api/auth/sign-out`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Best-effort server revoke — the client is already signed out
        // locally regardless of whether this reaches the server.
      }
    },

    async resumeSession() {
      const token = readToken();
      if (!token) {
        store.setSignedOut();
        return null;
      }

      let response: Response;
      try {
        response = await requestMe(token);
      } catch {
        // Transient network failure — keep whatever the store already
        // believes rather than forcing a signed-out flash.
        return null;
      }

      if (response.status === 401) {
        clearToken();
        store.setSignedOut();
        return null;
      }

      if (!response.ok) {
        // e.g. 403 — valid-but-forbidden or an origin rejection, not an
        // invalidation signal. Leave the token and store state alone.
        return null;
      }

      const { user } = (await response.json()) as { user: AuthUser };
      store.setSignedIn(user);
      return user;
    },
  };
}
