// @vitest-environment jsdom
/**
 * The editor slot on its own, because two of its guarantees only hold in a
 * window the workspace specs cannot reach: the frame between a re-render and
 * the effects of that same commit.
 *
 * Preact's top-level `render()` is synchronous while `useEffect` is deferred,
 * so calling it twice without `act` reproduces that window exactly — which is
 * what makes "the buffer belongs to the page it was typed into" testable at
 * all rather than a comment nobody can check.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "preact";
import { act } from "preact/test-utils";
import EditorPaneSlot, { describeCaret } from "../editor-pane-slot";

let container: HTMLElement;

function mount(props: {
  pageId: string;
  value: string;
  onChange: (markdown: string) => void;
}) {
  container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    render(<EditorPaneSlot {...props} />, container);
  });
  return textarea();
}

function textarea(): HTMLTextAreaElement {
  const element = container.querySelector("textarea");
  if (!element) throw new Error("no textarea");
  return element;
}

/** A synchronous re-render with NO effect flush — the risky window. */
function rerenderWithoutEffects(props: {
  pageId: string;
  value: string;
  onChange: (markdown: string) => void;
}): void {
  render(<EditorPaneSlot {...props} />, container);
}

function input(element: HTMLTextAreaElement, value: string): void {
  element.value = value;
  act(() => {
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

afterEach(() => {
  render(null, container);
  container.remove();
  document.body.innerHTML = "";
});

describe("switching pages", () => {
  it("renders the new page's body in the same commit the page id changes", () => {
    const onChange = vi.fn();
    mount({ pageId: "page-a", value: "body of A", onChange });
    input(textarea(), "edited A");

    rerenderWithoutEffects({ pageId: "page-b", value: "body of B", onChange });

    expect(textarea().value).toBe("body of B");
  });

  it("never reports the previous page's text as the new page's edit", () => {
    const onChange = vi.fn();
    mount({ pageId: "page-a", value: "body of A", onChange });
    input(textarea(), "edited A");
    onChange.mockClear();

    rerenderWithoutEffects({ pageId: "page-b", value: "body of B", onChange });
    input(textarea(), "body of B typed further");

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("body of B typed further");
  });
});

describe("composition", () => {
  it("holds the candidate on screen and reports nothing until it is committed", () => {
    const onChange = vi.fn();
    const element = mount({ pageId: "page-a", value: "", onChange });

    element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    input(element, "にほn");

    expect(onChange).not.toHaveBeenCalled();
    // The candidate must survive a re-render triggered by anything else.
    rerenderWithoutEffects({ pageId: "page-a", value: "", onChange });
    expect(textarea().value).toBe("にほn");

    element.value = "日本語";
    act(() => {
      element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledExactlyOnceWith("日本語");
  });
});

describe("describeCaret", () => {
  it("reports 1-based line and column plus a word count", () => {
    expect(describeCaret("one two\nthree", 9)).toEqual({ line: 2, column: 2, words: 3 });
    expect(describeCaret("", 0)).toEqual({ line: 1, column: 1, words: 0 });
  });

  it("clamps a caret outside the document", () => {
    expect(describeCaret("abc", 99)).toMatchObject({ line: 1, column: 4 });
    expect(describeCaret("abc", -5)).toMatchObject({ line: 1, column: 1 });
  });
});
