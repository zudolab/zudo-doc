/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushAll, renderIsland } from "../../__tests__/helpers/zudo-react.js";
import { FindInPageInit } from "../index.js";

const IDENTITY = { component: "FindInPageInit", build: "find-in-page-test" } as const;
const BEFORE_PREPARATION_EVENT = "zfb:before-preparation";
type FindInPageView = Awaited<ReturnType<typeof renderIsland<{}>>>;
let view: FindInPageView | undefined;

function addContent(text = "alpha beta alpha"): HTMLElement {
  const article = document.createElement("article");
  article.className = "zd-content";
  article.textContent = text;
  document.body.append(article);
  return article;
}

function enableTauri(): void {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    value: {},
    configurable: true,
  });
}

async function mountFindInPage() {
  view = await renderIsland(FindInPageInit, {}, {
    identity: IDENTITY,
    beforeActivate: (root) => expect(root.querySelector("input")).toBeNull(),
  });
  expect(view.diagnostics).toEqual([]);
  expect(view.handle).not.toBeNull();
  return view;
}

function press(
  target: EventTarget,
  init: KeyboardEventInit,
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

function type(input: HTMLInputElement, text: string, isComposing = false): void {
  input.value = text;
  input.dispatchEvent(new InputEvent("input", {
    bubbles: true,
    inputType: "insertText",
    data: text,
    isComposing,
  }));
}

afterEach(() => {
  view?.dispose();
  view = undefined;
  document.body.innerHTML = "";
  delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  vi.restoreAllMocks();
});

describe("FindInPageInit", () => {
  it("hydrates inert outside Tauri, then opens, searches live, advances, and closes", async () => {
    addContent();
    const ordinaryHost = await mountFindInPage();

    const unhandledShortcut = press(document, { key: "f", ctrlKey: true });
    await flushAll();
    expect(unhandledShortcut.defaultPrevented).toBe(false);
    expect(ordinaryHost.root.querySelector("input")).toBeNull();

    ordinaryHost.dispose();
    view = undefined;
    document.body.innerHTML = "";
    addContent();
    enableTauri();
    const tauriHost = await mountFindInPage();

    const shortcut = press(document, { key: "f", ctrlKey: true });
    await flushAll();
    expect(shortcut.defaultPrevented).toBe(true);

    const input = tauriHost.root.querySelector<HTMLInputElement>(
      'input[aria-label="Find in page"]',
    )!;
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);

    // modelValue must react to native input without waiting for blur/change.
    type(input, "alpha");
    await flushAll();
    const article = document.querySelector<HTMLElement>("article.zd-content")!;
    const marks = () => [...article.querySelectorAll("mark[data-find-match='true']")];
    expect(marks()).toHaveLength(2);
    expect(tauriHost.root.querySelector("span")?.textContent).toBe("1/2");
    expect(marks()[0]?.hasAttribute("data-find-active")).toBe(true);

    press(input, { key: "Enter", isComposing: true });
    await flushAll();
    expect(tauriHost.root.querySelector("span")?.textContent).toBe("1/2");
    const consumeEnter = (event: Event) => event.preventDefault();
    input.addEventListener("keydown", consumeEnter, { capture: true, once: true });
    const consumedEnter = press(input, { key: "Enter" });
    await flushAll();
    expect(consumedEnter.defaultPrevented).toBe(true);
    expect(tauriHost.root.querySelector("span")?.textContent).toBe("1/2");

    tauriHost.root.querySelector<HTMLButtonElement>('button[title="Next (Enter)"]')!.click();
    await flushAll();
    expect(tauriHost.root.querySelector("span")?.textContent).toBe("2/2");
    expect(marks()[1]?.hasAttribute("data-find-active")).toBe(true);

    // The text model keeps up with composition input and the shortcut handler
    // leaves Escape to the IME until composition has ended.
    input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    type(input, "beta", true);
    await flushAll();
    expect(marks()).toHaveLength(1);
    expect(tauriHost.root.querySelector("span")?.textContent).toBe("1/1");
    press(input, { key: "Escape", isComposing: true });
    await flushAll();
    expect(tauriHost.root.contains(input)).toBe(true);
    input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    await flushAll();

    const consumeEscape = (event: Event) => event.preventDefault();
    input.addEventListener("keydown", consumeEscape, { capture: true, once: true });
    const consumedEscape = press(input, { key: "Escape" });
    await flushAll();
    expect(consumedEscape.defaultPrevented).toBe(true);
    expect(tauriHost.root.contains(input)).toBe(true);

    press(input, { key: "Escape" });
    await flushAll();
    expect(tauriHost.root.querySelector("input")).toBeNull();
    expect(marks()).toHaveLength(0);

    press(document, { key: "f", ctrlKey: true });
    await flushAll();
    const reopenedInput = tauriHost.root.querySelector<HTMLInputElement>("input")!;
    expect(reopenedInput.value).toBe("");
    type(reopenedInput, "alpha");
    await flushAll();
    expect(marks()).toHaveLength(2);
    tauriHost.root.querySelector<HTMLButtonElement>('button[title="Close (Esc)"]')!.click();
    await flushAll();
    expect(tauriHost.root.querySelector("input")).toBeNull();
    expect(marks()).toHaveLength(0);
  });

  it("clears search on zfb navigation and removes both document listeners on disposal", async () => {
    addContent();
    enableTauri();
    const addListener = vi.spyOn(document, "addEventListener");
    const removeListener = vi.spyOn(document, "removeEventListener");
    const tauriHost = await mountFindInPage();
    const ownedSubscriptions = addListener.mock.calls.filter(([type]) =>
      type === "keydown" || type === BEFORE_PREPARATION_EVENT,
    );
    expect(ownedSubscriptions.map(([type]) => type)).toContain("keydown");
    expect(ownedSubscriptions.map(([type]) => type)).toContain(BEFORE_PREPARATION_EVENT);

    press(document, { key: "f", ctrlKey: true });
    await flushAll();
    const input = tauriHost.root.querySelector<HTMLInputElement>("input")!;
    type(input, "alpha");
    await flushAll();
    const article = document.querySelector("article.zd-content")!;
    expect(article.querySelectorAll("mark")).toHaveLength(2);

    document.dispatchEvent(new Event(BEFORE_PREPARATION_EVENT));
    await flushAll();
    expect(tauriHost.root.querySelector("input")).toBeNull();
    expect(article.querySelectorAll("mark")).toHaveLength(0);

    press(document, { key: "f", ctrlKey: true });
    await flushAll();
    const reopenedInput = tauriHost.root.querySelector<HTMLInputElement>("input")!;
    expect(reopenedInput.value).toBe("");
    type(reopenedInput, "beta");
    await flushAll();
    expect(article.querySelectorAll("mark")).toHaveLength(1);

    tauriHost.dispose();
    view = undefined;
    expect(article.querySelectorAll("mark")).toHaveLength(0);
    for (const [type, listener] of ownedSubscriptions) {
      expect(removeListener.mock.calls.some(([removedType, removedListener]) =>
        removedType === type && removedListener === listener,
      )).toBe(true);
    }
    const shortcutAfterDisposal = press(document, { key: "f", ctrlKey: true });
    expect(shortcutAfterDisposal.defaultPrevented).toBe(false);
  });
});
