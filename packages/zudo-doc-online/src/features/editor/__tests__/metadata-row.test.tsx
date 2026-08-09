// @vitest-environment jsdom
/**
 * The metadata row in isolation, focused on the two behaviors that are easy
 * to break and expensive to notice: the IME triple guard, and the frontmatter
 * shape the server's schema will accept.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render } from "preact";
import { act } from "preact/test-utils";
import type { PageFrontmatter } from "../../../store/index";
import { MetadataRow, withFrontmatterField } from "../metadata-row";
import { buildEditorTree, findTreePage, type EditorTreePage } from "../page-index";
import { INSTALLATION_ID, createEditorTestStore } from "./support";

let page: EditorTreePage;
let container: HTMLElement;

const frontmatter: PageFrontmatter = {
  title: "Installation",
  description: "Prerequisites, install commands, and the first run.",
  draft: true,
};

beforeAll(async () => {
  const snapshot = await createEditorTestStore().loadSnapshot();
  const found = findTreePage(buildEditorTree(snapshot), INSTALLATION_ID);
  if (!found) throw new Error("fixture page missing");
  page = found;
});

afterEach(() => {
  render(null, container);
  container.remove();
  document.body.innerHTML = "";
});

function mount() {
  const onFrontmatterChange = vi.fn();
  const onPositionCommit = vi.fn();
  container = document.createElement("div");
  document.body.appendChild(container);

  act(() => {
    render(
      <MetadataRow
        page={page}
        frontmatter={frontmatter}
        onFrontmatterChange={onFrontmatterChange}
        onPositionCommit={onPositionCommit}
      />,
      container,
    );
  });

  const field = (id: string): HTMLInputElement => {
    const element = container.querySelector<HTMLInputElement>(`#${id}`);
    if (!element) throw new Error(`No field "${id}".`);
    return element;
  };

  return { onFrontmatterChange, onPositionCommit, field };
}

function input(element: HTMLInputElement, value: string): void {
  element.value = value;
  act(() => {
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function key(element: HTMLElement, init: KeyboardEventInit): void {
  act(() => {
    element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));
  });
}

function composition(element: HTMLElement, type: "start" | "end"): void {
  act(() => {
    element.dispatchEvent(
      new CompositionEvent(`composition${type}`, { bubbles: true }),
    );
  });
}

describe("title and description", () => {
  it("commits every keystroke outside a composition", () => {
    const { onFrontmatterChange, field } = mount();
    input(field("zdo-meta-title"), "Install");

    expect(onFrontmatterChange).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Install", draft: true }),
    );
  });

  it("holds the commit until a composition finishes", () => {
    const { onFrontmatterChange, field } = mount();
    const title = field("zdo-meta-title");

    composition(title, "start");
    input(title, "にほn");
    input(title, "にほんご");
    expect(onFrontmatterChange).not.toHaveBeenCalled();

    title.value = "日本語";
    composition(title, "end");

    expect(onFrontmatterChange).toHaveBeenCalledTimes(1);
    expect(onFrontmatterChange).toHaveBeenCalledWith(
      expect.objectContaining({ title: "日本語" }),
    );
  });

  it("ignores an Escape the IME owns, and reverts a real one", () => {
    const { field } = mount();
    const title = field("zdo-meta-title");

    composition(title, "start");
    input(title, "にほん");
    key(title, { key: "Escape", keyCode: 229 });
    expect(title.value).toBe("にほん");

    composition(title, "end");
    input(title, "Half typed");
    key(title, { key: "Escape" });
    expect(title.value).toBe("Installation");
  });

  it("marks a blank title invalid instead of sending it", () => {
    const { onFrontmatterChange, field } = mount();
    const title = field("zdo-meta-title");

    input(title, "  ");

    expect(onFrontmatterChange).not.toHaveBeenCalled();
    expect(title.getAttribute("aria-invalid")).toBe("true");
  });
});

describe("position", () => {
  it("commits on Enter only, never on a keystroke", () => {
    const { onPositionCommit, field } = mount();
    const position = field("zdo-meta-position");

    input(position, "1");
    expect(onPositionCommit).not.toHaveBeenCalled();

    key(position, { key: "Enter" });
    expect(onPositionCommit).toHaveBeenCalledWith(1);
  });

  it("never commits on a composition Enter", () => {
    const { onPositionCommit, field } = mount();
    const position = field("zdo-meta-position");

    input(position, "1");
    key(position, { key: "Enter", keyCode: 229 });

    expect(onPositionCommit).not.toHaveBeenCalled();
  });

  it("rejects an unparseable position and marks the field invalid", () => {
    const { onPositionCommit, field } = mount();
    const position = field("zdo-meta-position");

    input(position, "last");
    key(position, { key: "Enter" });

    expect(onPositionCommit).not.toHaveBeenCalled();
    expect(position.getAttribute("aria-invalid")).toBe("true");
  });

  it("names its range for assistive technology", () => {
    const { field } = mount();
    const described = field("zdo-meta-position").getAttribute("aria-describedby");
    expect(described).toBe("zdo-meta-position-range");
    expect(container.querySelector(`#${described}`)?.textContent).toBe(
      "1 to 4 within getting-started",
    );
  });
});

describe("withFrontmatterField", () => {
  it("drops an emptied description rather than sending an empty string", () => {
    expect(withFrontmatterField(frontmatter, "description", "")).toEqual({
      title: "Installation",
      draft: true,
    });
  });

  it("keeps every untouched field and never mutates the input", () => {
    const next = withFrontmatterField(frontmatter, "title", "Setting up");
    expect(next).toEqual({ ...frontmatter, title: "Setting up" });
    expect(frontmatter.title).toBe("Installation");
  });
});
