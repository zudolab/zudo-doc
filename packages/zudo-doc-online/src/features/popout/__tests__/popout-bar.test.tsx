// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "preact";
import { act } from "preact/test-utils";
import type { ComponentChild } from "preact";

const { fakeOpener } = vi.hoisted(() => ({ fakeOpener: vi.fn() }));

// PopoutBar and usePopoutOpen both close over the module-level
// `popoutRegistry` singleton, so it must be swapped for a test-controlled
// instance (fake window opener, no real BroadcastChannel) before either is
// imported below.
vi.mock("../popout-registry", async () => {
  const actual = await vi.importActual<typeof import("../popout-registry")>("../popout-registry");
  return {
    ...actual,
    popoutRegistry: new actual.PopoutRegistry({ windowOpener: fakeOpener, channel: null }),
  };
});

import PopoutBar, { usePopoutOpen } from "../popout-bar";
import { popoutRegistry } from "../popout-registry";

const mountedContainers: HTMLElement[] = [];

function mount(node: ComponentChild): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    render(node, container);
  });
  mountedContainers.push(container);
  return container;
}

afterEach(() => {
  for (const container of mountedContainers.splice(0)) {
    render(null, container);
    container.remove();
  }
  fakeOpener.mockReset();
});

describe("PopoutBar", () => {
  it("renders the placeholder message and both actions", () => {
    const container = mount(<PopoutBar projectSlug="proj-a" pageId="page-a" />);

    const buttons = container.querySelectorAll("button");
    expect(container.textContent).toContain("Previewing in another window");
    expect(buttons[0]?.textContent).toBe("Focus");
    expect(buttons[1]?.textContent).toBe("Bring back");
  });

  it("clicking Focus calls popoutRegistry.focus for this pageId", () => {
    const focusSpy = vi.spyOn(popoutRegistry, "focus");
    const container = mount(<PopoutBar projectSlug="proj-a" pageId="page-a" />);

    const [focusButton] = container.querySelectorAll("button");
    act(() => {
      focusButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(focusSpy).toHaveBeenCalledWith("proj-a", "page-a");
  });

  it("clicking Bring back calls popoutRegistry.bringBack for this pageId", () => {
    const bringBackSpy = vi.spyOn(popoutRegistry, "bringBack");
    const container = mount(<PopoutBar projectSlug="proj-a" pageId="page-a" />);

    const buttons = container.querySelectorAll("button");
    act(() => {
      buttons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(bringBackSpy).toHaveBeenCalledWith("proj-a", "page-a");
  });
});

describe("usePopoutOpen", () => {
  function Probe({ pageId }: { pageId: string }) {
    const isOpen = usePopoutOpen("proj-b", pageId);
    return <span>{isOpen ? "open" : "closed"}</span>;
  }

  it("reflects the registry's isOpen state and re-renders on open/bringBack", () => {
    fakeOpener.mockReturnValue({ closed: false, close: vi.fn() });

    const container = mount(<Probe pageId="page-b" />);
    expect(container.textContent).toBe("closed");

    act(() => popoutRegistry.open("proj-b", "page-b"));
    expect(container.textContent).toBe("open");

    act(() => popoutRegistry.bringBack("proj-b", "page-b"));
    expect(container.textContent).toBe("closed");
  });

  it("does not react to a different pageId's open/close", () => {
    fakeOpener.mockReturnValue({ closed: false, close: vi.fn() });

    const container = mount(<Probe pageId="page-b" />);
    act(() => popoutRegistry.open("proj-b", "page-c"));

    expect(container.textContent).toBe("closed");
  });
});
