/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { getScope, signal } from "@takazudo/zfb/zudo-react";
import { renderIsland, flushAll } from "../../__tests__/helpers/zudo-react.js";
import { modalDialog } from "../index.js";
import { hydrationPending } from "../../hydration-pending.js";

const disposers: Array<() => void> = [];
afterEach(() => { for (const dispose of disposers.splice(0)) dispose(); document.body.replaceChildren(); });

function fixture(options: { manageFocus?: boolean; restoreFocusOnly?: boolean; backdropClickClose?: boolean; returnFocusRef?: { current: HTMLElement | null } } = {}) {
  const isOpen = signal(false);
  const onClose = vi.fn(() => { isOpen.value = false; });
  function Dialog() {
    const { dialogRef, handleBackdropClick } = modalDialog(getScope(), {
      isOpen, onClose, navigateEvent: "test:navigate", ...options,
    });
    return <dialog ref={dialogRef} on:click={handleBackdropClick}><button type="button">Inside</button></dialog>;
  }
  return { isOpen, onClose, Dialog };
}

async function render(Dialog: ReturnType<typeof fixture>["Dialog"]) {
  const view = await renderIsland(Dialog, {}, { identity: { component: "Dialog", build: "test" } });
  disposers.push(view.dispose);
  expect(view.diagnostics).toEqual([]);
  return view.root.querySelector("dialog")!;
}

describe("modalDialog", () => {
  it("synchronizes open/close and reports native Escape close once", async () => {
    const f = fixture();
    const dialog = await render(f.Dialog);
    f.isOpen.value = true;
    await flushAll();
    expect(dialog.open).toBe(true);
    dialog.close(); // the browser's Escape default closes the native dialog
    await flushAll();
    expect(f.onClose).toHaveBeenCalledTimes(1);
    expect(f.isOpen.value).toBe(false);
    f.isOpen.value = true;
    await flushAll();
    f.isOpen.value = false;
    await flushAll();
    expect(dialog.open).toBe(false);
    expect(f.onClose).toHaveBeenCalledTimes(1);
  });

  it("closes only backdrop clicks and active navigation, with listener cleanup", async () => {
    const f = fixture({ backdropClickClose: true });
    const dialog = await render(f.Dialog);
    document.dispatchEvent(new Event("test:navigate"));
    expect(f.onClose).not.toHaveBeenCalled();
    f.isOpen.value = true;
    await flushAll();
    dialog.querySelector("button")!.click();
    expect(dialog.open).toBe(true);
    dialog.click();
    await flushAll();
    expect(f.onClose).toHaveBeenCalledTimes(1);
    f.isOpen.value = true;
    await flushAll();
    document.dispatchEvent(new Event("test:navigate"));
    await flushAll();
    expect(f.onClose).toHaveBeenCalledTimes(2);
    disposers.pop()!();
    document.dispatchEvent(new Event("test:navigate"));
    expect(f.onClose).toHaveBeenCalledTimes(2);
  });

  it("moves focus inside and restores the trigger on native close", async () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const f = fixture({ manageFocus: true, returnFocusRef: { current: trigger } });
    const dialog = await render(f.Dialog);
    f.isOpen.value = true;
    await flushAll();
    expect(document.activeElement).toBe(dialog.querySelector("button"));
    dialog.close();
    await flushAll();
    expect(document.activeElement).toBe(trigger);
  });

  it("restoreFocusOnly does not move focus into the dialog", async () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const f = fixture({ restoreFocusOnly: true, returnFocusRef: { current: trigger } });
    const dialog = await render(f.Dialog);
    f.isOpen.value = true;
    await flushAll();
    expect(document.activeElement).not.toBe(dialog.querySelector("button"));
    dialog.close();
    await flushAll();
    expect(document.activeElement).toBe(trigger);
  });
});

it("hydration pending matches SSR then clears on activation", async () => {
  function Pending() {
    const pending = hydrationPending(getScope(), true);
    return <span aria-busy={pending}>Pending</span>;
  }
  const view = await renderIsland(Pending, {}, { identity: { component: "Pending", build: "test" } });
  disposers.push(view.dispose);
  expect(view.diagnostics).toEqual([]);
  expect(view.root.querySelector("span")?.getAttribute("aria-busy")).toBe("false");
});
