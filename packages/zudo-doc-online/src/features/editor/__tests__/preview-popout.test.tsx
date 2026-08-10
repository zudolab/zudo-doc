// @vitest-environment jsdom
/**
 * The workspace-side half of the pop-out contract (#3339): the preview
 * header's "Pop out" button and the in-pane placeholder swap. The pop-out
 * window itself (a second SPA instance) is covered by
 * `../../popout/__tests__/popout-window.test.tsx`; this spec only exercises
 * `workspace.tsx`'s own wiring against the real `popoutRegistry` module,
 * with just its window-opening side faked out (jsdom's own `window.open`
 * always returns `null`, which would never let the placeholder appear).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "preact/test-utils";

const { fakeOpener } = vi.hoisted(() => ({ fakeOpener: vi.fn() }));

vi.mock("../../popout/popout-registry", async () => {
  const actual =
    await vi.importActual<typeof import("../../popout/popout-registry")>(
      "../../popout/popout-registry",
    );
  return {
    ...actual,
    popoutRegistry: new actual.PopoutRegistry({ windowOpener: fakeOpener, channel: null }),
  };
});

import { popoutRegistry } from "../../popout/popout-registry";
import { mountWorkspace, queryByText, requireElement, settle } from "./harness";
import { INSTALLATION_ID, createEditorTestStore } from "./support";
import type { MemoryProjectStore } from "../../../store/index";

let store: MemoryProjectStore;
let mounted: Awaited<ReturnType<typeof mountWorkspace>> | undefined;

async function mount() {
  store = createEditorTestStore();
  const snapshot = await store.loadSnapshot();
  mounted = await mountWorkspace({
    store,
    snapshot,
    routePageId: INSTALLATION_ID,
    saveDebounceMs: 1,
  });
  return mounted;
}

afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
  fakeOpener.mockReset();
});

describe("workspace preview pop-out wiring", () => {
  it("shows a Pop out button in the preview header while not popped out", async () => {
    const { container } = await mount();

    const preview = requireElement(container, 'section[aria-label="Preview"]');
    expect(queryByText(preview, "button", "Pop out")).toBeDefined();
    expect(container.querySelector('[aria-label^="Preview: "]')).not.toBeNull();
  });

  it("clicking Pop out opens the registry entry and swaps the pane to the placeholder", async () => {
    fakeOpener.mockReturnValue({ closed: false, close: vi.fn() });
    const { container } = await mount();

    const preview = requireElement(container, 'section[aria-label="Preview"]');
    const popOutButton = queryByText<HTMLButtonElement>(preview, "button", "Pop out");
    act(() => popOutButton?.click());
    await settle();

    expect(popoutRegistry.isOpen("aurora-docs", INSTALLATION_ID)).toBe(true);
    expect(container.textContent).toContain("Previewing in another window");
    // The real preview pane unmounts while popped out.
    expect(container.querySelector('[aria-label^="Preview: "]')).toBeNull();
    // No point offering a second "Pop out" once it is already popped out.
    expect(queryByText(preview, "button", "Pop out")).toBeUndefined();

    act(() => popoutRegistry.bringBack("aurora-docs", INSTALLATION_ID));
  });

  it("clicking Bring back in the placeholder restores the real preview pane", async () => {
    fakeOpener.mockReturnValue({ closed: false, close: vi.fn() });
    const { container } = await mount();

    const preview = requireElement(container, 'section[aria-label="Preview"]');
    act(() => queryByText<HTMLButtonElement>(preview, "button", "Pop out")?.click());
    await settle();
    expect(container.textContent).toContain("Previewing in another window");

    act(() => queryByText<HTMLButtonElement>(preview, "button", "Bring back")?.click());
    await settle();

    expect(popoutRegistry.isOpen("aurora-docs", INSTALLATION_ID)).toBe(false);
    expect(container.textContent).not.toContain("Previewing in another window");
    expect(container.querySelector('[aria-label^="Preview: "]')).not.toBeNull();
  });
});
