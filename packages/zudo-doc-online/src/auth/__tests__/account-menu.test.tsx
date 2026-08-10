// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "preact";
import { act } from "preact/test-utils";
import type { AuthClient } from "../client";
import { createAuthStore, type AuthStore } from "../store";
import { AccountMenu } from "../account-menu";

const USER = { id: "u1", email: "a@example.com", name: "A" };

let container: HTMLElement | undefined;

afterEach(() => {
  if (container) {
    act(() => render(null, container!));
    container.remove();
    container = undefined;
  }
});

function fakeClient(overrides: Partial<AuthClient> = {}): AuthClient {
  return {
    signUp: vi.fn(async () => USER),
    signIn: vi.fn(async () => USER),
    signOut: vi.fn(async () => {}),
    resumeSession: vi.fn(async () => null),
    ...overrides,
  };
}

function mount(client: AuthClient, store = createAuthStore()) {
  const root = document.createElement("div");
  container = root;
  document.body.appendChild(root);
  act(() => {
    render(<AccountMenu client={client} store={store} />, root);
  });
  return { root, store };
}

function input(element: HTMLInputElement, value: string): void {
  element.value = value;
  act(() => {
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("AccountMenu — unknown state", () => {
  it("renders nothing while the session hasn't resolved", () => {
    const store = createAuthStore();
    const { root } = mount(fakeClient(), store);

    expect(root.textContent).toBe("");
  });
});

describe("AccountMenu — subscription gap", () => {
  it("catches up to a transition that lands before the effect subscribes", () => {
    const inner = createAuthStore();
    // Simulates `resumeSession()` settling in the window between the initial
    // `useState` snapshot read and the effect's subscribe: the transition
    // happens first, so the listener registered after it is never notified.
    const store: AuthStore = {
      ...inner,
      subscribe(listener) {
        inner.setSignedIn(USER);
        return inner.subscribe(listener);
      },
    };

    const { root } = mount(fakeClient(), store);

    expect(root.textContent).toContain(USER.email);
  });
});

describe("AccountMenu — signed-out state", () => {
  it("renders a Sign in trigger and opens a sign-in panel on click", () => {
    const store = createAuthStore();
    store.setSignedOut();
    const { root } = mount(fakeClient(), store);

    const trigger = [...root.querySelectorAll("button")].find(
      (btn) => btn.textContent === "Sign in",
    )!;
    expect(trigger).toBeTruthy();
    expect(root.querySelector('[role="dialog"]')).toBeNull();

    act(() => trigger.click());

    const dialog = root.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog!.querySelector("#account-panel-email")).toBeTruthy();
    expect(dialog!.querySelector("#account-panel-name")).toBeNull();
  });

  it("submits sign-in with the entered credentials and closes the panel on success", async () => {
    const store = createAuthStore();
    store.setSignedOut();
    const signIn = vi.fn(async () => USER);
    const { root } = mount(fakeClient({ signIn }), store);

    act(() => root.querySelector("button")!.click());
    input(root.querySelector<HTMLInputElement>("#account-panel-email")!, "a@example.com");
    input(root.querySelector<HTMLInputElement>("#account-panel-password")!, "secret");

    await act(async () => {
      root.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(signIn).toHaveBeenCalledWith("a@example.com", "secret");
    expect(root.querySelector('[role="dialog"]')).toBeNull();
  });

  it("switches to the sign-up form (with a Name field) and submits signUp", async () => {
    const store = createAuthStore();
    store.setSignedOut();
    const signUp = vi.fn(async () => USER);
    const { root } = mount(fakeClient({ signUp }), store);

    act(() => root.querySelector("button")!.click());
    const switchLink = [...root.querySelectorAll("button")].find((btn) =>
      (btn.textContent ?? "").includes("Sign up"),
    )!;
    act(() => switchLink.click());

    expect(root.querySelector("#account-panel-name")).toBeTruthy();

    input(root.querySelector<HTMLInputElement>("#account-panel-name")!, "A");
    input(root.querySelector<HTMLInputElement>("#account-panel-email")!, "a@example.com");
    input(root.querySelector<HTMLInputElement>("#account-panel-password")!, "secret");

    await act(async () => {
      root.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(signUp).toHaveBeenCalledWith("a@example.com", "secret", "A");
  });

  it("shows an error message and keeps the panel open when sign-in fails", async () => {
    const store = createAuthStore();
    store.setSignedOut();
    const signIn = vi.fn(async () => {
      throw new Error("Invalid credentials");
    });
    const { root } = mount(fakeClient({ signIn }), store);

    act(() => root.querySelector("button")!.click());
    input(root.querySelector<HTMLInputElement>("#account-panel-email")!, "a@example.com");
    input(root.querySelector<HTMLInputElement>("#account-panel-password")!, "wrong");

    await act(async () => {
      root.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(root.querySelector('[role="alert"]')?.textContent).toBe("Invalid credentials");
    expect(root.querySelector('[role="dialog"]')).toBeTruthy();
  });

  it("dismisses the panel via the Cancel control without submitting", () => {
    const store = createAuthStore();
    store.setSignedOut();
    const { root } = mount(fakeClient(), store);

    act(() => root.querySelector("button")!.click());
    const cancel = [...root.querySelectorAll("button")].find(
      (btn) => btn.textContent === "Cancel",
    )!;
    act(() => cancel.click());

    expect(root.querySelector('[role="dialog"]')).toBeNull();
  });
});

describe("AccountMenu — signed-in state", () => {
  it("shows the email and a Sign out control that calls client.signOut", () => {
    const store = createAuthStore();
    store.setSignedIn(USER);
    const signOut = vi.fn(async () => {});
    const { root } = mount(fakeClient({ signOut }), store);

    expect(root.textContent).toContain(USER.email);
    const signOutButton = [...root.querySelectorAll("button")].find(
      (btn) => btn.textContent === "Sign out",
    )!;

    act(() => signOutButton.click());

    expect(signOut).toHaveBeenCalled();
  });
});
