import { describe, expect, it, vi } from "vitest";
import { createAuthStore } from "../store";

const USER = { id: "u1", email: "a@example.com", name: "A" };

describe("createAuthStore", () => {
  it("starts unknown", () => {
    const store = createAuthStore();
    expect(store.getState()).toEqual({ status: "unknown" });
  });

  it("transitions to signed-in with the user and notifies subscribers", () => {
    const store = createAuthStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.setSignedIn(USER);

    expect(store.getState()).toEqual({ status: "signed-in", user: USER });
    expect(listener).toHaveBeenCalledWith({ status: "signed-in", user: USER });
  });

  it("transitions to signed-out and notifies subscribers", () => {
    const store = createAuthStore();
    store.setSignedIn(USER);
    const listener = vi.fn();
    store.subscribe(listener);

    store.setSignedOut();

    expect(store.getState()).toEqual({ status: "signed-out" });
    expect(listener).toHaveBeenCalledWith({ status: "signed-out" });
  });

  it("stops notifying an unsubscribed listener", () => {
    const store = createAuthStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();

    store.setSignedIn(USER);

    expect(listener).not.toHaveBeenCalled();
  });
});
