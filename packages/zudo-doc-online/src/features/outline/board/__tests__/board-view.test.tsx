// @vitest-environment jsdom
/**
 * jsdom mount tests for the board view. These exercise every path that does
 * NOT require a real pointer drag (jsdom cannot simulate one): rendering
 * from a snapshot, composers, delete confirms, and the button-based
 * up/down/left/right reorder affordances. Real drag verification is a
 * browser-verification request, not a unit test — see the PR body.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OutlineCommand } from "../../../../core/outline/index.js";
import {
  buttonContaining,
  click,
  mount,
  queryByLabel,
  testSnapshot,
  typeInto,
} from "../../__tests__/support.js";
import type {
  OutlineDispatch,
  OutlineDispatchResult,
  OutlineSelection,
} from "../../view-props.js";
import BoardView from "../../board-view.js";

afterEach(() => {
  document.body.innerHTML = "";
});

interface Harness {
  dispatch: OutlineDispatch;
  commands: OutlineCommand[];
  selection: OutlineSelection;
  selectCategory: ReturnType<typeof vi.fn>;
  focusNode: ReturnType<typeof vi.fn>;
}

function createHarness(result: OutlineDispatchResult = { ok: true, changed: true }): Harness {
  const commands: OutlineCommand[] = [];
  const dispatch: OutlineDispatch = vi.fn(async (command: OutlineCommand) => {
    commands.push(command);
    return result;
  });
  const selectCategory = vi.fn();
  const focusNode = vi.fn();
  const selection: OutlineSelection = {
    categoryId: null,
    focusedId: null,
    selectCategory,
    focusNode,
  };
  return { dispatch, commands, selection, selectCategory, focusNode };
}

describe("BoardView rendering", () => {
  it("renders the derived top-page column, one column per category, and every page as a card", async () => {
    const harness = createHarness();
    const view = await mount(
      <BoardView
        snapshot={testSnapshot()}
        dispatch={harness.dispatch}
        selection={harness.selection}
      />,
    );

    expect(queryByLabel(view.container, "Top page (derived)")).not.toBeNull();
    expect(queryByLabel(view.container, "Category: Alpha")).not.toBeNull();
    expect(queryByLabel(view.container, "Category: Beta")).not.toBeNull();
    expect(queryByLabel(view.container, "Category: Gamma")).not.toBeNull();

    // Alpha has 3 pages in the fixture.
    const alphaColumn = queryByLabel(view.container, "Category: Alpha");
    expect(alphaColumn?.querySelectorAll("li").length).toBe(3);

    // Gamma is the empty category — its droppable body still renders with
    // zero cards (the trailing spacer keeps it droppable).
    const gammaColumn = queryByLabel(view.container, "Category: Gamma");
    expect(gammaColumn?.querySelectorAll("li").length).toBe(0);

    view.unmount();
  });

  it("shows a draft dot for a draft page and none for a published one", async () => {
    const harness = createHarness();
    const view = await mount(
      <BoardView
        snapshot={testSnapshot()}
        dispatch={harness.dispatch}
        selection={harness.selection}
      />,
    );

    // "Two" is the fixture's draft page.
    const draftCard = [...view.container.querySelectorAll("li")].find((li) =>
      (li.textContent ?? "").includes("Two"),
    );
    expect(draftCard?.querySelector('[title="Draft — not published yet"]')).not.toBeNull();

    const publishedCard = [...view.container.querySelectorAll("li")].find((li) =>
      (li.textContent ?? "").includes("One"),
    );
    expect(publishedCard?.querySelector('[title="Draft — not published yet"]')).toBeNull();

    view.unmount();
  });

  it("gives every card and column a keyboard-reachable drag handle", async () => {
    const harness = createHarness();
    const view = await mount(
      <BoardView
        snapshot={testSnapshot()}
        dispatch={harness.dispatch}
        selection={harness.selection}
      />,
    );

    expect(queryByLabel(view.container, "Drag One to reorder")).not.toBeNull();
    expect(queryByLabel(view.container, "Drag to reorder Alpha")).not.toBeNull();

    view.unmount();
  });

  it("renders each page card's editor link with the expected hash route", async () => {
    const harness = createHarness();
    const view = await mount(
      <BoardView
        snapshot={testSnapshot()}
        dispatch={harness.dispatch}
        selection={harness.selection}
      />,
    );

    const link = view.container.querySelector('a[href="#/editor/page-alpha-one"]');
    expect(link).not.toBeNull();
    expect(link?.textContent ?? "").toContain("One");

    view.unmount();
  });
});

describe("BoardView composers", () => {
  it("add-page composer dispatches add-page, stays open, and clears the input for rapid entry", async () => {
    const harness = createHarness({ ok: true, changed: true, createdPageId: "new-page" });
    const view = await mount(
      <BoardView
        snapshot={testSnapshot()}
        dispatch={harness.dispatch}
        selection={harness.selection}
      />,
    );

    const alphaColumn = queryByLabel(view.container, "Category: Alpha") as HTMLElement;
    await click(buttonContaining(alphaColumn, "Add page"));

    const input = alphaColumn.querySelector<HTMLInputElement>(
      'input[aria-label="Title of the new page in Alpha"]',
    );
    expect(input).not.toBeNull();
    if (input === null) throw new Error("composer input missing");

    typeInto(input, "Fresh Page");
    await click(buttonContaining(alphaColumn, "Add"));

    expect(harness.commands).toEqual([
      { type: "add-page", categoryId: "cat-alpha", title: "Fresh Page" },
    ]);
    // Selection follows the newly created page (matches the tree's own
    // onAddPage behaviour in outline-page.tsx).
    expect(harness.selectCategory).toHaveBeenCalledWith("cat-alpha");
    expect(harness.focusNode).toHaveBeenCalledWith("new-page");

    // Stays open for rapid entry — the input is still in the DOM, cleared.
    const stillOpenInput = alphaColumn.querySelector<HTMLInputElement>(
      'input[aria-label="Title of the new page in Alpha"]',
    );
    expect(stillOpenInput).not.toBeNull();
    expect(stillOpenInput?.value ?? "new-page-not-cleared").toBe("");

    view.unmount();
  });

  it("add-category ghost column dispatches add-category and closes on a single commit", async () => {
    const harness = createHarness({ ok: true, changed: true, selectedId: "cat-new" });
    const view = await mount(
      <BoardView
        snapshot={testSnapshot()}
        dispatch={harness.dispatch}
        selection={harness.selection}
      />,
    );

    await click(buttonContaining(view.container, "Add category"));
    const input = view.container.querySelector<HTMLInputElement>(
      'input[aria-label="Title of the new category"]',
    );
    expect(input).not.toBeNull();
    if (input === null) throw new Error("composer input missing");

    typeInto(input, "New Section");
    await click(buttonContaining(view.container, "Add category"));

    expect(harness.commands).toEqual([{ type: "add-category", title: "New Section" }]);
    expect(harness.selectCategory).toHaveBeenCalledWith("cat-new");

    // A single commit closes it — the input is gone, the ghost affordance
    // button is back.
    expect(
      view.container.querySelector('input[aria-label="Title of the new category"]'),
    ).toBeNull();

    view.unmount();
  });

  it("board-wide composer exclusivity: opening one closes any other that was open", async () => {
    const harness = createHarness();
    const view = await mount(
      <BoardView
        snapshot={testSnapshot()}
        dispatch={harness.dispatch}
        selection={harness.selection}
      />,
    );

    const alphaColumn = queryByLabel(view.container, "Category: Alpha") as HTMLElement;
    const betaColumn = queryByLabel(view.container, "Category: Beta") as HTMLElement;

    await click(buttonContaining(alphaColumn, "Add page"));
    expect(
      alphaColumn.querySelector('input[aria-label="Title of the new page in Alpha"]'),
    ).not.toBeNull();

    await click(buttonContaining(betaColumn, "Add page"));
    expect(
      alphaColumn.querySelector('input[aria-label="Title of the new page in Alpha"]'),
    ).toBeNull();
    expect(
      betaColumn.querySelector('input[aria-label="Title of the new page in Beta"]'),
    ).not.toBeNull();

    view.unmount();
  });
});

describe("BoardView delete flows (InlineConfirm reuse)", () => {
  it("deletes a page via InlineConfirm, dispatching remove-page only after confirm", async () => {
    const harness = createHarness();
    const view = await mount(
      <BoardView
        snapshot={testSnapshot()}
        dispatch={harness.dispatch}
        selection={harness.selection}
      />,
    );

    await click(queryByLabel(view.container, "Delete Two") as HTMLElement);
    expect(harness.commands).toEqual([]);

    await click(buttonContaining(view.container, "Delete page"));
    expect(harness.commands).toEqual([{ type: "remove-page", pageId: "page-alpha-two" }]);

    view.unmount();
  });

  it("cancelling a page delete confirm dispatches nothing", async () => {
    const harness = createHarness();
    const view = await mount(
      <BoardView
        snapshot={testSnapshot()}
        dispatch={harness.dispatch}
        selection={harness.selection}
      />,
    );

    await click(queryByLabel(view.container, "Delete Two") as HTMLElement);
    await click(buttonContaining(view.container, "Cancel"));
    expect(harness.commands).toEqual([]);
    expect(queryByLabel(view.container, "Delete Two")).not.toBeNull();

    view.unmount();
  });

  it("deletes a category via InlineConfirm, dispatching remove-category only after confirm", async () => {
    const harness = createHarness();
    const view = await mount(
      <BoardView
        snapshot={testSnapshot()}
        dispatch={harness.dispatch}
        selection={harness.selection}
      />,
    );

    await click(queryByLabel(view.container, "Delete category Gamma") as HTMLElement);
    await click(buttonContaining(view.container, "Delete category"));
    expect(harness.commands).toEqual([{ type: "remove-category", categoryId: "cat-gamma" }]);

    view.unmount();
  });
});

describe("BoardView button-based reordering (keyboard-reachable, no drag)", () => {
  it("disables up on the first card and down on the last, and dispatches move-page from the middle", async () => {
    const harness = createHarness();
    const view = await mount(
      <BoardView
        snapshot={testSnapshot()}
        dispatch={harness.dispatch}
        selection={harness.selection}
      />,
    );

    const firstUp = queryByLabel(
      view.container,
      "Move Alpha up in Alpha",
    ) as HTMLButtonElement | null;
    expect(firstUp?.disabled).toBe(true);

    const lastDown = queryByLabel(
      view.container,
      "Move Two down in Alpha",
    ) as HTMLButtonElement | null;
    expect(lastDown?.disabled).toBe(true);

    await click(queryByLabel(view.container, "Move One down in Alpha") as HTMLElement);
    expect(harness.commands).toEqual([
      { type: "move-page", pageId: "page-alpha-one", toCategoryId: "cat-alpha", toIndex: 2 },
    ]);

    view.unmount();
  });

  it("disables left on the first column and right on the last, and dispatches move-category", async () => {
    const harness = createHarness();
    const view = await mount(
      <BoardView
        snapshot={testSnapshot()}
        dispatch={harness.dispatch}
        selection={harness.selection}
      />,
    );

    const firstLeft = queryByLabel(
      view.container,
      "Move Alpha left",
    ) as HTMLButtonElement | null;
    expect(firstLeft?.disabled).toBe(true);

    const lastRight = queryByLabel(
      view.container,
      "Move Gamma right",
    ) as HTMLButtonElement | null;
    expect(lastRight?.disabled).toBe(true);

    await click(queryByLabel(view.container, "Move Beta right") as HTMLElement);
    expect(harness.commands).toEqual([
      { type: "move-category", categoryId: "cat-beta", toIndex: 2 },
    ]);

    view.unmount();
  });
});
