// @vitest-environment jsdom
/**
 * Exhaustive tests for the board's pure drag-plan functions — the
 * "load-bearing part" per the kanban recipe (§4). Most of these are plain
 * data-in/data-out functions with no dnd-kit types and no DOM; jsdom is only
 * needed for the `isActivatingElement` cases at the bottom, which build real
 * elements to walk `.closest()` against.
 */
import { describe, expect, it } from "vitest";
import {
  buildColumnMap,
  findCardColumn,
  isActivatingElement,
  relocateActiveCardToColumn,
  resolveColumnMoveIndex,
  resolveDropBeforeId,
  resolveFinalColumnId,
  resolveMoveIndex,
  resolveSameColumnDropIndex,
  type ColumnMap,
} from "../dnd.js";

interface Card {
  id: string;
}

function card(id: string): Card {
  return { id };
}

function mapOf(entries: Array<[string, Card[]]>): ColumnMap<Card> {
  return new Map(entries);
}

describe("buildColumnMap", () => {
  it("keys categories by id and preserves their page order", () => {
    const categories = [
      { id: "cat-a", pages: [card("p1"), card("p2")] },
      { id: "cat-b", pages: [] },
    ];
    const map = buildColumnMap(categories);
    expect([...map.keys()]).toEqual(["cat-a", "cat-b"]);
    expect(map.get("cat-a")).toEqual([card("p1"), card("p2")]);
    expect(map.get("cat-b")).toEqual([]);
  });
});

describe("findCardColumn", () => {
  it("finds the column holding a card", () => {
    const map = mapOf([
      ["cat-a", [card("p1"), card("p2")]],
      ["cat-b", [card("p3")]],
    ]);
    expect(findCardColumn(map, "p3")).toBe("cat-b");
    expect(findCardColumn(map, "p1")).toBe("cat-a");
  });

  it("returns null when the card is nowhere in the map", () => {
    const map = mapOf([["cat-a", [card("p1")]]]);
    expect(findCardColumn(map, "missing")).toBeNull();
  });
});

describe("relocateActiveCardToColumn", () => {
  it("returns null on same-column hover — leaves the gap to the sortable strategy", () => {
    const map = mapOf([
      ["cat-a", [card("p1"), card("p2")]],
      ["cat-b", [card("p3")]],
    ]);
    expect(relocateActiveCardToColumn(map, "p1", "cat-a", "p2")).toBeNull();
  });

  it("appends to the target column when overCardId is null", () => {
    const map = mapOf([
      ["cat-a", [card("p1"), card("p2")]],
      ["cat-b", [card("p3")]],
    ]);
    const next = relocateActiveCardToColumn(map, "p1", "cat-b", null);
    expect(next).not.toBeNull();
    expect(next?.get("cat-a")).toEqual([card("p2")]);
    expect(next?.get("cat-b")).toEqual([card("p3"), card("p1")]);
  });

  it("inserts BEFORE the given card in the target column", () => {
    const map = mapOf([
      ["cat-a", [card("p1")]],
      ["cat-b", [card("p2"), card("p3")]],
    ]);
    const next = relocateActiveCardToColumn(map, "p1", "cat-b", "p3");
    expect(next?.get("cat-a")).toEqual([]);
    expect(next?.get("cat-b")).toEqual([card("p2"), card("p1"), card("p3")]);
  });

  it("moves into a column that had zero cards (empty-column drop)", () => {
    const map = mapOf([
      ["cat-a", [card("p1")]],
      ["cat-b", []],
    ]);
    const next = relocateActiveCardToColumn(map, "p1", "cat-b", null);
    expect(next?.get("cat-a")).toEqual([]);
    expect(next?.get("cat-b")).toEqual([card("p1")]);
  });

  it("moves into a column absent from the map entirely", () => {
    const map = mapOf([["cat-a", [card("p1")]]]);
    const next = relocateActiveCardToColumn(map, "p1", "cat-new", null);
    expect(next?.get("cat-a")).toEqual([]);
    expect(next?.get("cat-new")).toEqual([card("p1")]);
  });

  it("returns null when the active card cannot be found anywhere", () => {
    const map = mapOf([["cat-a", [card("p1")]]]);
    expect(relocateActiveCardToColumn(map, "ghost", "cat-a", null)).toBeNull();
  });

  it("falls back to append when the given overCardId does not exist in the target", () => {
    const map = mapOf([
      ["cat-a", [card("p1")]],
      ["cat-b", [card("p2")]],
    ]);
    const next = relocateActiveCardToColumn(map, "p1", "cat-b", "not-there");
    expect(next?.get("cat-b")).toEqual([card("p2"), card("p1")]);
  });

  it("composes across two successive relocations (re-hover into a third column)", () => {
    const map = mapOf([
      ["cat-a", [card("p1")]],
      ["cat-b", []],
      ["cat-c", [card("p2")]],
    ]);
    const first = relocateActiveCardToColumn(map, "p1", "cat-b", null);
    expect(first).not.toBeNull();
    const second = relocateActiveCardToColumn(first as ColumnMap<Card>, "p1", "cat-c", "p2");
    expect(second?.get("cat-a")).toEqual([]);
    expect(second?.get("cat-b")).toEqual([]);
    expect(second?.get("cat-c")).toEqual([card("p1"), card("p2")]);
  });

  it("leaves other columns' arrays untouched by reference identity where nothing changed", () => {
    const untouched = [card("p9")];
    const map = mapOf([
      ["cat-a", [card("p1")]],
      ["cat-b", [card("p2")]],
      ["cat-untouched", untouched],
    ]);
    const next = relocateActiveCardToColumn(map, "p1", "cat-b", null);
    expect(next?.get("cat-untouched")).toEqual(untouched);
  });
});

describe("resolveFinalColumnId", () => {
  it("trusts the working copy over everything else", () => {
    const workingMap = mapOf([
      ["cat-a", []],
      ["cat-b", [card("p1")]],
    ]);
    const result = resolveFinalColumnId({
      workingMap,
      activeId: "p1",
      sourceColumnId: "cat-a",
      overType: "card",
      overColumnId: "cat-a", // deliberately stale/wrong — working copy wins
    });
    expect(result).toBe("cat-b");
  });

  it("falls back to sourceColumnId when the working copy no longer has the card", () => {
    const workingMap = mapOf([["cat-a", []]]);
    const result = resolveFinalColumnId({
      workingMap,
      activeId: "p1",
      sourceColumnId: "cat-a",
      overType: "none",
      overColumnId: null,
    });
    expect(result).toBe("cat-a");
  });

  it("trusts `over` directly when there is no working copy (keyboard drag)", () => {
    const result = resolveFinalColumnId({
      workingMap: null,
      activeId: "p1",
      sourceColumnId: "cat-a",
      overType: "columnBody",
      overColumnId: "cat-b",
    });
    expect(result).toBe("cat-b");
  });

  it("falls back to sourceColumnId with no working copy and no usable over", () => {
    const result = resolveFinalColumnId({
      workingMap: null,
      activeId: "p1",
      sourceColumnId: "cat-a",
      overType: "none",
      overColumnId: null,
    });
    expect(result).toBe("cat-a");
  });
});

describe("resolveDropBeforeId", () => {
  it("precedence 1: a real other card in the final column wins", () => {
    const workingMap = mapOf([["cat-a", [card("p2"), card("p1"), card("p3")]]]);
    const result = resolveDropBeforeId({
      finalColumnId: "cat-a",
      workingMap,
      activeId: "p1",
      overId: "p3",
      overType: "card",
    });
    expect(result).toBe("p3");
  });

  it("precedence 1 is skipped when `over` is a card from a STALE (non-final) column", () => {
    const workingMap = mapOf([
      ["cat-a", [card("p1")]], // final column — active landed here
      ["cat-b", [card("p2"), card("p3")]], // over.id points here, stale
    ]);
    const result = resolveDropBeforeId({
      finalColumnId: "cat-a",
      workingMap,
      activeId: "p1",
      overId: "p2",
      overType: "card",
    });
    // p2 is not in the final column, so precedence 1 does not apply; the
    // working copy has no neighbour after p1 in cat-a either, so this
    // falls all the way through to append.
    expect(result).toBeNull();
  });

  it("precedence 1 trusts `over` directly with no working copy (keyboard drag)", () => {
    const result = resolveDropBeforeId({
      finalColumnId: "cat-a",
      workingMap: null,
      activeId: "p1",
      overId: "p3",
      overType: "card",
    });
    expect(result).toBe("p3");
  });

  it("never returns the active card itself as the precedence-1 target", () => {
    const workingMap = mapOf([["cat-a", [card("p1")]]]);
    const result = resolveDropBeforeId({
      finalColumnId: "cat-a",
      workingMap,
      activeId: "p1",
      overId: "p1",
      overType: "card",
    });
    expect(result).toBeNull();
  });

  it("precedence 2: falls back to the working copy's own next neighbour", () => {
    const workingMap = mapOf([["cat-a", [card("p1"), card("p2")]]]);
    const result = resolveDropBeforeId({
      finalColumnId: "cat-a",
      workingMap,
      activeId: "p1",
      overId: null,
      overType: "columnBody",
    });
    expect(result).toBe("p2");
  });

  it("precedence 3: appends when the active card is last with no neighbour", () => {
    const workingMap = mapOf([["cat-a", [card("p2"), card("p1")]]]);
    const result = resolveDropBeforeId({
      finalColumnId: "cat-a",
      workingMap,
      activeId: "p1",
      overId: null,
      overType: "columnBody",
    });
    expect(result).toBeNull();
  });

  it("precedence 3: appends with no working copy and no usable over (keyboard drag onto a column body)", () => {
    const result = resolveDropBeforeId({
      finalColumnId: "cat-a",
      workingMap: null,
      activeId: "p1",
      overId: null,
      overType: "columnBody",
    });
    expect(result).toBeNull();
  });
});

describe("resolveMoveIndex", () => {
  it("matches movePageCommand's convention for a same-category 'move up' (fromIndex - 1)", () => {
    // Category order: [p0, p1, p2]; moving p2 up means inserting it before
    // p1 — outline-actions.ts's movePageCommand would send toIndex = 1.
    const toIndex = resolveMoveIndex(["p0", "p1", "p2"], "p2", "p1");
    expect(toIndex).toBe(1);
  });

  it("matches movePageCommand's convention for a same-category 'move down' (fromIndex + 1)", () => {
    // Moving p0 down inserts it before the page two slots ahead (p2);
    // outline-actions.ts would send toIndex = 1 for this same move.
    const toIndex = resolveMoveIndex(["p0", "p1", "p2"], "p0", "p2");
    expect(toIndex).toBe(1);
  });

  it("appends into a different category (beforeId null) at the target's current length", () => {
    const toIndex = resolveMoveIndex(["p0", "p1"], "moving-page", null);
    expect(toIndex).toBe(2);
  });

  it("inserts before a specific page in a different category", () => {
    const toIndex = resolveMoveIndex(["p0", "p1"], "moving-page", "p1");
    expect(toIndex).toBe(1);
  });

  it("treats an unknown beforeId as append", () => {
    const toIndex = resolveMoveIndex(["p0", "p1"], "moving-page", "ghost");
    expect(toIndex).toBe(2);
  });

  it("a same-slot drop resolves to the page's own original index (a no-op for the caller to detect)", () => {
    // p1 dropped back before its own original next neighbour p2.
    const toIndex = resolveMoveIndex(["p0", "p1", "p2"], "p1", "p2");
    expect(toIndex).toBe(1);
  });
});

describe("resolveColumnMoveIndex", () => {
  it("returns the target's original index (arrayMove convention)", () => {
    expect(resolveColumnMoveIndex(["a", "b", "c"], "a", "c")).toBe(2);
    expect(resolveColumnMoveIndex(["a", "b", "c"], "c", "a")).toBe(0);
  });

  it("swaps two ADJACENT items when dragging the earlier one onto the later one (regression: a codex review round caught this resolving to a no-op via the 'insert before a post-removal index' formula board-view.tsx used to reuse here)", () => {
    expect(resolveColumnMoveIndex(["a", "b", "c"], "a", "b")).toBe(1);
  });

  it("returns null for a no-op (over is the active column itself)", () => {
    expect(resolveColumnMoveIndex(["a", "b", "c"], "a", "a")).toBeNull();
  });

  it("returns null when over is null", () => {
    expect(resolveColumnMoveIndex(["a", "b", "c"], "a", null)).toBeNull();
  });

  it("returns null when either id is not found", () => {
    expect(resolveColumnMoveIndex(["a", "b"], "ghost", "a")).toBeNull();
    expect(resolveColumnMoveIndex(["a", "b"], "a", "ghost")).toBeNull();
  });
});

describe("resolveSameColumnDropIndex", () => {
  it("is the same algorithm as resolveColumnMoveIndex, reused for a same-column card drop with no working copy", () => {
    expect(resolveSameColumnDropIndex).toBe(resolveColumnMoveIndex);
    // The exact scenario board-view.tsx's early branch exists for: a pure
    // same-column drag never builds a working copy, so `over`'s ORIGINAL
    // index (not its post-removal index) is what must be sent.
    expect(resolveSameColumnDropIndex(["p0", "p1", "p2"], "p0", "p1")).toBe(1);
  });
});

describe("isActivatingElement", () => {
  it("allows a non-Element target (defensive default)", () => {
    expect(isActivatingElement(null)).toBe(true);
  });

  it("allows a plain element with no interactive ancestor", () => {
    const div = document.createElement("div");
    expect(isActivatingElement(div)).toBe(true);
  });

  it("blocks a click that lands on (or inside) a button", () => {
    const button = document.createElement("button");
    const icon = document.createElement("span");
    button.appendChild(icon);
    expect(isActivatingElement(button)).toBe(false);
    expect(isActivatingElement(icon)).toBe(false);
  });

  it("blocks a click inside an input, link, or [data-no-dnd] element", () => {
    const input = document.createElement("input");
    const link = document.createElement("a");
    const optOut = document.createElement("div");
    optOut.setAttribute("data-no-dnd", "");
    const child = document.createElement("span");
    optOut.appendChild(child);
    expect(isActivatingElement(input)).toBe(false);
    expect(isActivatingElement(link)).toBe(false);
    expect(isActivatingElement(child)).toBe(false);
  });

  it("an explicit [data-dnd-activator] wins outright, even inside a button", () => {
    const button = document.createElement("button");
    button.setAttribute("data-dnd-activator", "");
    const icon = document.createElement("span");
    button.appendChild(icon);
    expect(isActivatingElement(button)).toBe(true);
    expect(isActivatingElement(icon)).toBe(true);
  });
});
