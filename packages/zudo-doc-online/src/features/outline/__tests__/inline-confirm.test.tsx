// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { InlineConfirm } from "../inline-confirm.js";
import { buttonWithText, click, mount, pressKey } from "./support.js";

describe("InlineConfirm", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("opens with focus on Cancel, not on the destructive button", async () => {
    const onConfirm = vi.fn();
    const view = await mount(
      <InlineConfirm
        message="Delete “Guides” and the 6 pages inside it?"
        confirmLabel="Delete category"
        tone="danger"
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />,
    );

    expect(document.activeElement).toBe(buttonWithText(view.container, "Cancel"));
    expect(onConfirm).not.toHaveBeenCalled();

    view.unmount();
  });

  it("cancels on Escape", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const view = await mount(
      <InlineConfirm
        message="Delete “Two”?"
        confirmLabel="Delete page"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    await pressKey(buttonWithText(view.container, "Cancel"), "Escape");

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    view.unmount();
  });

  it("confirms only when the confirm button is pressed", async () => {
    const onConfirm = vi.fn();
    const view = await mount(
      <InlineConfirm
        message="Delete “Two”?"
        confirmLabel="Delete page"
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />,
    );

    await click(buttonWithText(view.container, "Delete page"));

    expect(onConfirm).toHaveBeenCalledTimes(1);

    view.unmount();
  });

  it("holds the live-refresh guard for as long as it is open", async () => {
    const release = vi.fn();
    const beginEditing = vi.fn(() => release);
    const view = await mount(
      <InlineConfirm
        message="Delete “Two”?"
        confirmLabel="Delete page"
        beginEditing={beginEditing}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );

    expect(beginEditing).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();

    view.unmount();
    expect(release).toHaveBeenCalledTimes(1);
  });
});
