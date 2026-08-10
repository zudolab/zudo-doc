// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ViewSwitch } from "../view-switch.js";
import { buttonWithText, click, mount } from "./support.js";

describe("ViewSwitch", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("marks the active mode with aria-pressed", async () => {
    const view = await mount(
      <ViewSwitch value="outline" onChange={() => undefined} />,
    );

    expect(
      buttonWithText(view.container, "Outline").getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      buttonWithText(view.container, "Board").getAttribute("aria-pressed"),
    ).toBe("false");

    view.unmount();
  });

  it("reports the mode that was picked", async () => {
    const onChange = vi.fn();
    const view = await mount(<ViewSwitch value="outline" onChange={onChange} />);

    await click(buttonWithText(view.container, "Board"));

    expect(onChange).toHaveBeenCalledWith("board");

    view.unmount();
  });

  it("offers Board even before the board view exists", async () => {
    const view = await mount(
      <ViewSwitch value="board" onChange={() => undefined} />,
    );

    expect(buttonWithText(view.container, "Board").disabled).toBe(false);

    view.unmount();
  });
});
