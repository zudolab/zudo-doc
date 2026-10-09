"use client";

/** @jsxRuntime automatic */
// AI Chat Modal island — relocated from src/components/ai-chat-modal.tsx
// (host showcase) into the package as part of Package-First Wave 3 (S3,
// epic #2344). The `/api/ai-chat` endpoint remains host-side.
// The CSS block (.ai-chat-md) is shipped in @takazudo/zudo-doc/features.css.

import {
  batch,
  computed,
  For,
  getScope,
  Show,
  signal,
  type Ref,
} from "@takazudo/zfb/zudo-react";
import type { ChatMessage } from "../island-types/index.js";
import { renderMarkdown } from "../render-markdown/index.js";
import { SmartBreak } from "../smart-break/index.js";
import { BEFORE_NAVIGATE_EVENT } from "../transitions/index.js";
import { modalDialog } from "../use-modal-dialog/index.js";

interface AiChatModalProps {
  basePath: string;
}

interface AiChatMessage extends ChatMessage {
  id: number;
}

function isAiChatResponse(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" && data !== null;
}

function ChatMessageRow({ msg }: { msg: AiChatMessage }) {
  return (
    <div
      class={`mb-vsp-xs flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
    >
      <span class="sr-only">{msg.role === "user" ? "You: " : "Assistant: "}</span>
      {msg.role === "user" ? (
        <div class="max-w-[85%] rounded-t-[1rem] rounded-bl-[1rem] rounded-br-[0.25rem] bg-chat-user-bg px-hsp-md py-vsp-2xs text-small leading-relaxed text-chat-user-text">
          <SmartBreak>{msg.content}</SmartBreak>
        </div>
      ) : (
        // `renderMarkdown` escapes authored content before adding its small,
        // protocol-checked tag allowlist. This generated HTML is the only
        // payload assigned to rawHtml; the opaque subtree has no owned children.
        <div
          class="ai-chat-md max-w-[85%] rounded-t-[1rem] rounded-br-[1rem] rounded-bl-[0.25rem] bg-chat-assistant-bg px-hsp-md py-vsp-2xs text-small leading-relaxed text-chat-assistant-text"
          rawHtml={renderMarkdown(msg.content)}
        />
      )}
    </div>
  );
}

export function AiChatModal({ basePath }: AiChatModalProps) {
  const scope = getScope();
  const messagesEndRef: Ref<HTMLDivElement> = { current: null };
  const inputRef: Ref<HTMLInputElement> = { current: null };

  const isOpen = signal(false);
  const messages = signal<AiChatMessage[]>([]);
  const input = signal("");
  const loading = signal(false);
  const error = signal<string | null>(null);
  const isComposing = signal(false);
  let nextMessageId = 0;
  let requestVersion = 0;
  let activeRequest: AbortController | null = null;
  let cleanupActiveRequest: (() => void) | null = null;

  const busy = computed(() => loading.value);
  const sendDisabled = computed(() => busy.value || input.value.trim().length === 0);
  const showEmptyState = computed(() => messages.value.length === 0 && !busy.value);
  const hasError = computed(() => error.value !== null);
  const latestAssistantMessage = computed(() => {
    const current = messages.value;
    for (let index = current.length - 1; index >= 0; index--) {
      const message = current[index];
      if (message?.role === "assistant") return message.content;
    }
    return "";
  });

  const cancelActiveRequest = () => {
    requestVersion++;
    activeRequest?.abort();
    cleanupActiveRequest?.();
    activeRequest = null;
    cleanupActiveRequest = null;
  };

  const resetState = () => {
    cancelActiveRequest();
    batch(() => {
      isOpen.value = false;
      messages.value = [];
      input.value = "";
      error.value = null;
      loading.value = false;
      isComposing.value = false;
    });
  };

  const { dialogRef, handleBackdropClick } = modalDialog(scope, {
    isOpen,
    onClose: resetState,
    navigateEvent: BEFORE_NAVIGATE_EVENT,
    backdropClickClose: true,
    restoreFocusOnly: true,
  });

  // Browser access and the global listener belong to the activated island.
  scope.onActivate(() => {
    const handleToggle = (_event: Event) => {
      const dialog = dialogRef.current;
      if (!dialog?.isConnected) return;
      if (dialog.open) {
        dialog.close();
      } else {
        isOpen.value = true;
      }
    };
    window.addEventListener("toggle-ai-chat", handleToggle);
    return () => window.removeEventListener("toggle-ai-chat", handleToggle);
  });

  // When closing or disposing, invalidate the request before aborting it so
  // its finally/catch path cannot update a reset or disposed dialog.
  scope.onCleanup(cancelActiveRequest);

  scope.effect(() => {
    if (isOpen.value) inputRef.current?.focus();
  });

  scope.effect(() => {
    messages.value;
    loading.value;
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  });

  const sendMessage = async () => {
    const trimmed = input.value.trim();
    if (
      !trimmed ||
      loading.value ||
      isComposing.value ||
      scope.abortSignal.aborted
    ) {
      return;
    }

    const requestMessages = messages.value.map(({ role, content }) => ({ role, content }));
    const userMessage: AiChatMessage = {
      id: ++nextMessageId,
      role: "user",
      content: trimmed,
    };
    const controller = new AbortController();
    const currentRequest = ++requestVersion;
    activeRequest = controller;
    const abortForScope = () => controller.abort();
    scope.abortSignal.addEventListener("abort", abortForScope, { once: true });
    const cleanupScopeAbort = () => scope.abortSignal.removeEventListener("abort", abortForScope);
    cleanupActiveRequest = cleanupScopeAbort;
    const isCurrentRequest = () =>
      currentRequest === requestVersion &&
      activeRequest === controller &&
      !controller.signal.aborted &&
      !scope.abortSignal.aborted;
    let assistantMessage: AiChatMessage | null = null;
    let responseError: string | undefined;

    batch(() => {
      messages.value = [...messages.value, userMessage];
      input.value = "";
      error.value = null;
      loading.value = true;
    });

    try {
      const base = basePath.replace(/\/+$/, "");
      const response = await fetch(`${base}/api/ai-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history: requestMessages }),
        signal: controller.signal,
      });
      if (!isCurrentRequest()) return;

      const raw: unknown = await response.json();
      if (!isCurrentRequest()) return;
      const data = isAiChatResponse(raw) ? raw : {};

      if (!response.ok) {
        responseError =
          ("error" in data && typeof data.error === "string" ? data.error : null) ||
          "Something went wrong";
      } else if ("response" in data && typeof data.response === "string" && data.response) {
        assistantMessage = { id: ++nextMessageId, role: "assistant", content: data.response };
      } else {
        responseError = "Received an empty or invalid response";
      }
    } catch {
      if (isCurrentRequest()) responseError = "Failed to connect to the AI assistant";
    } finally {
      cleanupScopeAbort();
      if (activeRequest === controller) cleanupActiveRequest = null;
      if (isCurrentRequest()) {
        activeRequest = null;
        batch(() => {
          if (assistantMessage) messages.value = [...messages.value, assistantMessage];
          if (responseError !== undefined) error.value = responseError;
          loading.value = false;
        });
      }
    }
  };

  const handleKeyDown = (event: Event) => {
    const keyboard = event as KeyboardEvent;
    if (
      keyboard.key !== "Enter" ||
      keyboard.shiftKey ||
      keyboard.isComposing ||
      isComposing.value ||
      event.defaultPrevented
    ) {
      return;
    }
    event.preventDefault();
    void sendMessage();
  };

  const handleSendClick = (event: Event) => {
    if (event.defaultPrevented || isComposing.value) return;
    void sendMessage();
  };

  return (
    <dialog
      ref={dialogRef}
      on:click={handleBackdropClick}
      class="z-modal m-0 h-dvh max-h-none w-dvw max-w-none border-none bg-surface p-0 text-fg backdrop:z-modal-backdrop backdrop:bg-bg/80 lg:m-auto lg:h-[90vh] lg:max-h-[90vh] lg:w-[90vw] lg:max-w-[52.5rem] lg:border-solid lg:border lg:border-fg"
    >
      <div class="flex h-full flex-col">
        <div class="flex shrink-0 items-center justify-between border-b border-muted px-hsp-lg py-vsp-xs">
          <h2 class="text-title font-bold text-fg">AI Assistant</h2>
          <button
            type="button"
            on:click={() => dialogRef.current?.close()}
            class="flex items-center justify-center text-muted transition-colors hover:text-fg"
            aria-label="Close"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div role="log" aria-label="Chat messages" class="flex-1 overflow-y-auto px-hsp-lg py-vsp-sm">
          <Show when={showEmptyState}>
            {() => (
              <p class="py-vsp-xl text-center text-small text-muted">
                Ask a question about the documentation.
              </p>
            )}
          </Show>
          <For each={messages} by={(message) => message.id}>
            {(message) => <ChatMessageRow msg={message.value} />}
          </For>
          <div aria-live="polite" aria-atomic="true" class="sr-only">
            {latestAssistantMessage}
          </div>
          <Show when={busy}>
            {() => (
              <div class="mb-vsp-xs flex justify-start">
                <div
                  role="status"
                  class="rounded-t-[1rem] rounded-br-[1rem] rounded-bl-[0.25rem] bg-chat-assistant-bg px-hsp-md py-vsp-2xs text-small text-muted"
                >
                  Thinking...
                </div>
              </div>
            )}
          </Show>
          <Show when={hasError}>
            {() => (
              <div
                role="alert"
                class="mb-vsp-xs rounded-[0.75rem] border border-danger bg-bg px-hsp-md py-vsp-2xs text-small text-danger"
              >
                {computed(() => error.value ?? "")}
              </div>
            )}
          </Show>
          <div ref={messagesEndRef} />
        </div>

        <div class="shrink-0 border-t border-muted px-hsp-lg py-vsp-xs">
          <div class="flex items-center gap-x-hsp-sm">
            <input
              ref={inputRef}
              type="text"
              modelValue={input}
              on:compositionstart={() => {
                isComposing.value = true;
              }}
              on:compositionend={() => {
                isComposing.value = false;
              }}
              on:keydown={handleKeyDown}
              disabled={busy}
              aria-label="Type your message"
              aria-busy={busy}
              placeholder="Type your message..."
              class="flex-1 rounded-full border border-muted bg-bg px-hsp-lg py-vsp-2xs text-small text-fg placeholder:text-muted focus:border-accent focus:outline-none disabled:opacity-50"
            />
            <button
              type="button"
              on:click={handleSendClick}
              disabled={sendDisabled}
              aria-busy={busy}
              class="flex h-[2rem] w-[2rem] shrink-0 items-center justify-center rounded-full bg-accent text-bg transition-colors duration-0 hover:bg-accent-hover disabled:opacity-50"
              aria-label="Send message"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
