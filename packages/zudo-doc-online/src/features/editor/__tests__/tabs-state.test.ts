import { describe, expect, it } from "vitest";
import {
  EMPTY_TABS,
  activateTab,
  closeTab,
  neighbourTab,
  openTab,
  pruneTabs,
  readOpenTabIds,
  restoreTabs,
  syncTabsToRoute,
  writeOpenTabIds,
  type TabsState,
} from "../tabs-state";
import { createFakeStorage, createHostileStorage } from "./support";

const known = new Set(["a", "b", "c"]);

function tabs(openIds: string[], activeId: string | null): TabsState {
  return { openIds, activeId };
}

describe("openTab / activateTab", () => {
  it("appends without stealing focus, and is a no-op for an open tab", () => {
    const opened = openTab(EMPTY_TABS, "a");
    expect(opened).toEqual({ openIds: ["a"], activeId: null });
    expect(openTab(opened, "a")).toBe(opened);
  });

  it("opens a tab that is not yet present when activating it", () => {
    expect(activateTab(tabs(["a"], "a"), "b")).toEqual({
      openIds: ["a", "b"],
      activeId: "b",
    });
  });

  it("returns the same state when the tab is already open and active", () => {
    const state = tabs(["a"], "a");
    expect(activateTab(state, "a")).toBe(state);
  });
});

describe("closeTab", () => {
  it("keeps the active tab when closing a different one", () => {
    expect(closeTab(tabs(["a", "b", "c"], "c"), "a")).toEqual({
      openIds: ["b", "c"],
      activeId: "c",
    });
  });

  it("falls to the tab on the right when the active tab closes", () => {
    expect(closeTab(tabs(["a", "b", "c"], "b"), "b")).toEqual({
      openIds: ["a", "c"],
      activeId: "c",
    });
  });

  it("falls to the left when the rightmost tab closes", () => {
    expect(closeTab(tabs(["a", "b"], "b"), "b")).toEqual({
      openIds: ["a"],
      activeId: "a",
    });
  });

  it("reports no active tab once the last one closes", () => {
    expect(closeTab(tabs(["a"], "a"), "a")).toEqual({ openIds: [], activeId: null });
  });

  it("is a no-op for a tab that is not open", () => {
    const state = tabs(["a"], "a");
    expect(closeTab(state, "zzz")).toBe(state);
  });
});

describe("syncTabsToRoute", () => {
  it("opens and activates the route's page", () => {
    expect(syncTabsToRoute(tabs(["a"], "a"), "b", known)).toEqual({
      openIds: ["a", "b"],
      activeId: "b",
    });
  });

  it("leaves state untouched for a page the snapshot does not have", () => {
    const state = tabs(["a"], "a");
    expect(syncTabsToRoute(state, "ghost", known)).toBe(state);
  });
});

describe("pruneTabs", () => {
  it("drops vanished tabs and keeps a still-valid active one", () => {
    expect(pruneTabs(tabs(["a", "gone", "c"], "c"), known)).toEqual({
      openIds: ["a", "c"],
      activeId: "c",
    });
  });

  it("moves to the next surviving tab when the active one vanished", () => {
    expect(pruneTabs(tabs(["a", "gone", "c"], "gone"), known)).toEqual({
      openIds: ["a", "c"],
      activeId: "c",
    });
  });

  it("falls back to a surviving tab on the left when nothing is to the right", () => {
    expect(pruneTabs(tabs(["a", "gone"], "gone"), known)).toEqual({
      openIds: ["a"],
      activeId: "a",
    });
  });

  it("returns the same state when every tab still exists", () => {
    const state = tabs(["a", "b"], "a");
    expect(pruneTabs(state, known)).toBe(state);
  });
});

describe("neighbourTab", () => {
  it("wraps in both directions", () => {
    expect(neighbourTab(tabs(["a", "b", "c"], "c"), "next")).toBe("a");
    expect(neighbourTab(tabs(["a", "b", "c"], "a"), "previous")).toBe("c");
  });

  it("returns null when nothing is open", () => {
    expect(neighbourTab(EMPTY_TABS, "next")).toBeNull();
  });
});

describe("restoreTabs", () => {
  it("filters unknown and duplicate ids, then honours the route", () => {
    expect(restoreTabs(["a", "gone", "a", "b"], "b", known)).toEqual({
      openIds: ["a", "b"],
      activeId: "b",
    });
  });

  it("opens the route's page even when nothing was persisted", () => {
    expect(restoreTabs([], "c", known)).toEqual({ openIds: ["c"], activeId: "c" });
  });
});

describe("persistence", () => {
  it("round-trips through storage", () => {
    const storage = createFakeStorage();
    writeOpenTabIds(["a", "b"], storage);
    expect(readOpenTabIds(storage)).toEqual(["a", "b"]);
  });

  it("reads an empty list from corrupt, non-array, or throwing storage", () => {
    expect(readOpenTabIds(createFakeStorage({ "zdo-editor-tabs": "{oops" }))).toEqual([]);
    expect(readOpenTabIds(createFakeStorage({ "zdo-editor-tabs": '"a"' }))).toEqual([]);
    expect(readOpenTabIds(createHostileStorage())).toEqual([]);
  });

  it("drops non-string entries rather than trusting the payload", () => {
    const storage = createFakeStorage({ "zdo-editor-tabs": '["a",7,null,"b"]' });
    expect(readOpenTabIds(storage)).toEqual(["a", "b"]);
  });

  it("persists nothing when storage is disabled", () => {
    expect(() => writeOpenTabIds(["a"], null)).not.toThrow();
    expect(readOpenTabIds(null)).toEqual([]);
  });
});
