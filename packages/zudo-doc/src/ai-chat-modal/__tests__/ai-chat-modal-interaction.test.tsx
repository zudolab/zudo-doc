/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushAll, renderIsland } from "../../__tests__/helpers/zudo-react.js";
import { AiChatModal } from "../index.js";
import { BEFORE_NAVIGATE_EVENT } from "../../transitions/index.js";

const IDENTITY = { component: "AiChatModal", build: "ai-chat-modal-test" } as const;
type ModalView = Awaited<ReturnType<typeof renderIsland<{ basePath: string }>>>;
let view: ModalView | undefined;

function response(data: unknown, ok = true): Response {
  return { ok, json: async () => data } as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function type(input: HTMLInputElement, value: string, isComposing = false): void {
  input.value = value;
  input.dispatchEvent(new InputEvent("input", {
    bubbles: true,
    inputType: "insertText",
    data: value,
    isComposing,
  }));
}

function pressEnter(input: HTMLInputElement, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key: "Enter",
    bubbles: true,
    cancelable: true,
    ...init,
  });
  input.dispatchEvent(event);
  return event;
}

async function settle(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await flushAll();
}

async function mountModal(): Promise<ModalView> {
  view = await renderIsland(AiChatModal, { basePath: "/docs/" }, { identity: IDENTITY });
  expect(view.diagnostics).toEqual([]);
  expect(view.handle).not.toBeNull();
  return view;
}

async function openModal(modal: ModalView): Promise<HTMLDialogElement> {
  window.dispatchEvent(new Event("toggle-ai-chat"));
  await flushAll();
  const dialog = modal.root.querySelector("dialog")!;
  expect(dialog.open).toBe(true);
  return dialog;
}

afterEach(() => {
  view?.dispose();
  view = undefined;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AiChatModal interactions", () => {
  it("sends a message, shows loading, renders two keyed replies, and guards composition/default prevention", async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    const fetchMock = vi.fn((_url: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(response({ response: "unused" })),
    );
    fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    vi.stubGlobal("fetch", fetchMock);

    const modal = await mountModal();
    const dialog = await openModal(modal);
    const input = dialog.querySelector<HTMLInputElement>('input[aria-label="Type your message"]')!;
    const sendButton = dialog.querySelector<HTMLButtonElement>('button[aria-label="Send message"]')!;
    expect(document.activeElement).toBe(input);
    expect(sendButton.disabled).toBe(true);

    input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    type(input, "日本語", true);
    await flushAll();
    pressEnter(input, { isComposing: true });
    sendButton.click();
    await flushAll();
    expect(fetchMock).not.toHaveBeenCalled();

    input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    await flushAll();
    type(input, " first question ");
    await flushAll();
    const preventedClick = (event: Event) => event.preventDefault();
    sendButton.addEventListener("click", preventedClick, { capture: true, once: true });
    sendButton.click();
    await flushAll();
    expect(fetchMock).not.toHaveBeenCalled();

    const consumedEnter = (event: Event) => event.preventDefault();
    input.addEventListener("keydown", consumedEnter, { capture: true, once: true });
    const keydown = pressEnter(input);
    await flushAll();
    expect(keydown.defaultPrevented).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();

    const firstSubmit = pressEnter(input);
    await flushAll();
    expect(firstSubmit.defaultPrevented).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall?.[0]).toBe("/docs/api/ai-chat");
    expect(JSON.parse(String(firstCall?.[1]?.body))).toEqual({
      message: "first question",
      history: [],
    });
    expect(input.value).toBe("");
    expect(input.disabled).toBe(true);
    expect(sendButton.disabled).toBe(true);
    expect(dialog.querySelector('[role="status"]')?.textContent).toContain("Thinking...");

    const firstAnswer =
      "**first answer**\n\n<img src=x onerror=alert(1)> [unsafe](javascript:alert(1)) [safe](https://example.com/?q=a&b=c)";
    first.resolve(response({ response: firstAnswer }));
    await settle();
    expect(dialog.querySelector('[role="status"]')).toBeNull();
    expect(dialog.querySelector(".ai-chat-md p strong")?.textContent).toBe("first answer");
    const firstBubble = dialog.querySelector<HTMLElement>(".ai-chat-md")!;
    expect(firstBubble.querySelector("img")).toBeNull();
    expect(firstBubble.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(firstBubble.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(firstBubble.querySelector('a[href^="https://example.com/"]')?.getAttribute("rel"))
      .toBe("noopener noreferrer");
    const firstAssistantRow = dialog.querySelector(".ai-chat-md")?.parentElement;
    expect(firstAssistantRow).not.toBeNull();

    type(input, "second question");
    await flushAll();
    sendButton.click();
    await flushAll();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondCall = fetchMock.mock.calls[1];
    expect(JSON.parse(String(secondCall?.[1]?.body))).toEqual({
      message: "second question",
      history: [
        { role: "user", content: "first question" },
        { role: "assistant", content: firstAnswer },
      ],
    });
    second.resolve(response({ response: "second answer" }));
    await settle();

    const assistantMessages = [...dialog.querySelectorAll<HTMLElement>(".ai-chat-md")];
    expect(assistantMessages).toHaveLength(2);
    expect(assistantMessages[0]?.parentElement).toBe(firstAssistantRow);
    expect(assistantMessages[1]?.textContent).toContain("second answer");
    expect(dialog.querySelector('[aria-live="polite"]')?.textContent).toBe("second answer");
  });

  it("shows server errors and ignores a response after closing its request", async () => {
    const stale = deferred<Response>();
    const fetchMock = vi.fn((_url: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(response({ response: "unused" })),
    )
      .mockResolvedValueOnce(response({ error: "service unavailable" }, false))
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce(response({ response: "fresh answer" }));
    vi.stubGlobal("fetch", fetchMock);

    const modal = await mountModal();
    const dialog = await openModal(modal);
    const input = dialog.querySelector<HTMLInputElement>('input[aria-label="Type your message"]')!;
    type(input, "error question");
    await flushAll();
    dialog.querySelector<HTMLButtonElement>('button[aria-label="Send message"]')!.click();
    await settle();
    expect(dialog.querySelector('[role="alert"]')?.textContent).toBe("service unavailable");
    expect(dialog.querySelector('[role="status"]')).toBeNull();

    type(input, "stale question");
    await flushAll();
    dialog.querySelector<HTMLButtonElement>('button[aria-label="Send message"]')!.click();
    await flushAll();
    const staleSignal = fetchMock.mock.calls[1]?.[1]?.signal;
    expect(staleSignal?.aborted).toBe(false);

    document.dispatchEvent(new Event(BEFORE_NAVIGATE_EVENT));
    await flushAll();
    expect(dialog.open).toBe(false);
    expect(staleSignal?.aborted).toBe(true);
    expect(dialog.querySelector('[role="alert"]')).toBeNull();

    await openModal(modal);
    type(input, "fresh question");
    await flushAll();
    dialog.querySelector<HTMLButtonElement>('button[aria-label="Send message"]')!.click();
    await settle();
    stale.resolve(response({ response: "stale answer" }));
    await settle();

    expect(dialog.textContent).toContain("fresh answer");
    expect(dialog.textContent).not.toContain("stale answer");
    expect(dialog.querySelectorAll(".ai-chat-md")).toHaveLength(1);
  });

  it("aborts active work and removes its toggle listener on island disposal", async () => {
    const pending = deferred<Response>();
    const fetchMock = vi.fn((_url: RequestInfo | URL, _init?: RequestInit) => pending.promise);
    vi.stubGlobal("fetch", fetchMock);
    const addListener = vi.spyOn(window, "addEventListener");
    const removeListener = vi.spyOn(window, "removeEventListener");

    const modal = await mountModal();
    const toggleSubscription = addListener.mock.calls.find(([type]) => type === "toggle-ai-chat");
    expect(toggleSubscription).toBeDefined();
    const dialog = await openModal(modal);
    const input = dialog.querySelector<HTMLInputElement>('input[aria-label="Type your message"]')!;
    type(input, "pending question");
    await flushAll();
    pressEnter(input);
    await flushAll();
    const requestSignal = fetchMock.mock.calls[0]?.[1]?.signal;
    expect(requestSignal?.aborted).toBe(false);

    const htmlBeforeDispose = modal.root.innerHTML;
    modal.dispose();
    view = undefined;
    expect(requestSignal?.aborted).toBe(true);
    expect(removeListener.mock.calls).toContainEqual(toggleSubscription);

    pending.resolve(response({ response: "late answer" }));
    await settle();
    expect(modal.root.innerHTML).toBe(htmlBeforeDispose);
  });
});
