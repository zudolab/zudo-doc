/**
 * Top-bar account item (#3365): signed-out opens a small sign-in/sign-up
 * panel; signed-in shows the email + a sign-out control. Purely a view over
 * `store.ts`'s `AuthState` plus a `client.ts` `AuthClient` for the actual
 * calls — `main.tsx` boots the shared `authStore` singleton via
 * `resumeSession()`, this component only reacts to it.
 */
import { useEffect, useRef, useState } from "preact/hooks";
import { createAuthClient, type AuthClient } from "./client.js";
import { authStore, type AuthState, type AuthStore } from "./store.js";

const TRIGGER_CLASSES =
  "text-small text-fg-mild hover:text-accent focus-visible:text-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const PANEL_CLASSES =
  "absolute right-0 top-full z-10 mt-vsp-xs w-64 rounded-md border border-border bg-surface p-hsp-md shadow-[var(--shadow-2)]";

const FIELD_LABEL = "mb-vsp-2xs block text-caption text-muted";

const FIELD_INPUT =
  "w-full rounded-sm border border-border-strong bg-bg px-hsp-sm py-vsp-2xs text-small text-fg placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const SUBMIT_BUTTON =
  "mt-vsp-sm inline-flex w-full items-center justify-center rounded-sm bg-accent px-hsp-md py-vsp-2xs text-small font-semibold text-accent-fg hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const SWITCH_LINK =
  "mt-vsp-sm block text-center text-caption text-muted hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

type PanelMode = "sign-in" | "sign-up";
type SubmitStatus = { kind: "idle" } | { kind: "busy" } | { kind: "error"; message: string };

export interface AccountMenuProps {
  /** Test seam — defaults to a real client backed by `window.localStorage`. */
  client?: AuthClient;
  /** Test seam — defaults to the shared `authStore` singleton. */
  store?: AuthStore;
}

function useAuthState(store: AuthStore): AuthState {
  const [state, setState] = useState<AuthState>(() => store.getState());
  useEffect(() => store.subscribe(setState), [store]);
  return state;
}

export function AccountMenu({ client, store = authStore }: AccountMenuProps) {
  const state = useAuthState(store);
  // Built lazily (not at module scope) so a spec that never renders this
  // component never triggers `window.localStorage` access.
  const clientRef = useRef<AuthClient | null>(client ?? null);
  if (clientRef.current === null) {
    clientRef.current = client ?? createAuthClient({ store });
  }
  const authClient = clientRef.current;

  const [panelOpen, setPanelOpen] = useState(false);

  if (state.status === "unknown") {
    // Session resolution hasn't settled yet — render nothing rather than a
    // "signed out" flash that would immediately be replaced.
    return null;
  }

  if (state.status === "signed-in") {
    return (
      <div className="flex items-center gap-hsp-sm">
        <span className="text-small text-fg-mild">{state.user.email}</span>
        <button
          type="button"
          className={TRIGGER_CLASSES}
          onClick={() => {
            void authClient.signOut();
          }}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        className={TRIGGER_CLASSES}
        aria-expanded={panelOpen}
        onClick={() => setPanelOpen((open) => !open)}
      >
        Sign in
      </button>
      {panelOpen ? (
        <AccountPanel
          client={authClient}
          onDone={() => setPanelOpen(false)}
          onDismiss={() => setPanelOpen(false)}
        />
      ) : null}
    </div>
  );
}

interface AccountPanelProps {
  client: AuthClient;
  onDone: () => void;
  onDismiss: () => void;
}

function AccountPanel({ client, onDone, onDismiss }: AccountPanelProps) {
  const [mode, setMode] = useState<PanelMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<SubmitStatus>({ kind: "idle" });

  async function handleSubmit(event: Event) {
    event.preventDefault();
    setStatus({ kind: "busy" });
    try {
      if (mode === "sign-in") {
        await client.signIn(email, password);
      } else {
        await client.signUp(email, password, name);
      }
      onDone();
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong.",
      });
    }
  }

  return (
    <div className={PANEL_CLASSES} role="dialog" aria-label={mode === "sign-in" ? "Sign in" : "Sign up"}>
      <form onSubmit={handleSubmit}>
        {mode === "sign-up" ? (
          <div className="mb-vsp-xs">
            <label className={FIELD_LABEL} htmlFor="account-panel-name">
              Name
            </label>
            <input
              id="account-panel-name"
              className={FIELD_INPUT}
              type="text"
              autoComplete="name"
              required
              value={name}
              onInput={(event) => setName((event.target as HTMLInputElement).value)}
            />
          </div>
        ) : null}
        <div className="mb-vsp-xs">
          <label className={FIELD_LABEL} htmlFor="account-panel-email">
            Email
          </label>
          <input
            id="account-panel-email"
            className={FIELD_INPUT}
            type="email"
            autoComplete="email"
            required
            value={email}
            onInput={(event) => setEmail((event.target as HTMLInputElement).value)}
          />
        </div>
        <div>
          <label className={FIELD_LABEL} htmlFor="account-panel-password">
            Password
          </label>
          <input
            id="account-panel-password"
            className={FIELD_INPUT}
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            required
            value={password}
            onInput={(event) => setPassword((event.target as HTMLInputElement).value)}
          />
        </div>
        {status.kind === "error" ? (
          <p role="alert" className="mt-vsp-xs text-caption text-danger">
            {status.message}
          </p>
        ) : null}
        <button type="submit" className={SUBMIT_BUTTON} disabled={status.kind === "busy"}>
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </button>
      </form>
      <button
        type="button"
        className={SWITCH_LINK}
        onClick={() => {
          setStatus({ kind: "idle" });
          setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"));
        }}
      >
        {mode === "sign-in" ? "Need an account? Sign up" : "Have an account? Sign in"}
      </button>
      <button type="button" className={SWITCH_LINK} onClick={onDismiss}>
        Cancel
      </button>
    </div>
  );
}
