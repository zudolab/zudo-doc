/**
 * Subscribable auth session state, shared by the auth client (`client.ts`)
 * and the account UI (`account-menu.tsx`).
 *
 * `unknown` is the state before `resumeSession()` has settled — and is also
 * where the store stays parked when a resume attempt can't determine an
 * answer (a transient network failure, or a non-401 error). The account UI
 * must render nothing (or a neutral placeholder) for `unknown`, never
 * "signed out" chrome, since the session may still turn out to be valid.
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export type AuthState =
  | { status: "unknown" }
  | { status: "signed-out" }
  | { status: "signed-in"; user: AuthUser };

export type AuthStateListener = (state: AuthState) => void;

export interface AuthStore {
  getState(): AuthState;
  subscribe(listener: AuthStateListener): () => void;
  setSignedIn(user: AuthUser): void;
  setSignedOut(): void;
}

export function createAuthStore(): AuthStore {
  let state: AuthState = { status: "unknown" };
  const listeners = new Set<AuthStateListener>();

  function commit(next: AuthState): void {
    state = next;
    for (const listener of listeners) listener(state);
  }

  return {
    getState() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setSignedIn(user) {
      commit({ status: "signed-in", user });
    },
    setSignedOut() {
      commit({ status: "signed-out" });
    },
  };
}

/** App-wide singleton — `main.tsx`'s boot wiring and the account UI share this instance. */
export const authStore = createAuthStore();
