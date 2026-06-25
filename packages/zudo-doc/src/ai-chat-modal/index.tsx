"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// AI Chat Modal island — relocated from src/components/ai-chat-modal.tsx
// (host showcase) into the package as part of Package-First Wave 3 (S3,
// epic #2344). Uses shared hook + utils from S1a foundation:
//   - useModalDialog  from @takazudo/zudo-doc/use-modal-dialog
//   - renderMarkdown  from @takazudo/zudo-doc/render-markdown
//   - SmartBreak      from @takazudo/zudo-doc/smart-break
//   - ChatMessage     from @takazudo/zudo-doc/island-types
//
// The /api/ai-chat endpoint stays host-side (showcase-only).
// The CSS block (.ai-chat-md) is shipped in @takazudo/zudo-doc/features.css
// (moved from src/styles/global.css by S3).

import { useState, useEffect, useRef, useCallback, memo } from "preact/compat";
import type { ChatMessage } from "../island-types/index.js";
import { renderMarkdown } from "../render-markdown/index.js";
import { SmartBreak } from "../smart-break/index.js";
import { BEFORE_NAVIGATE_EVENT } from "../transitions/index.js";
import { useModalDialog } from "../use-modal-dialog/index.js";

interface AiChatModalProps {
  basePath: string;
}

function isAiChatResponse(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" && data !== null;
}

// Memoized row: message objects are immutable once appended.
const ChatMessageRow = memo(function ChatMessageRow({ msg }: { msg: ChatMessage }) {
  return (
    <div
      className={`mb-vsp-xs flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
    >
      <span className="sr-only">{msg.role === "user" ? "You: " : "Assistant: "}</span>
      {msg.role === "user" ? (
        <div className="max-w-[85%] rounded-t-[1rem] rounded-bl-[1rem] rounded-br-[0.25rem] bg-chat-user-bg px-hsp-md py-vsp-2xs text-small leading-relaxed text-chat-user-text">
          <SmartBreak>{msg.content}</SmartBreak>
        </div>
      ) : (
        <div
          className="ai-chat-md max-w-[85%] rounded-t-[1rem] rounded-br-[1rem] rounded-bl-[0.25rem] bg-chat-assistant-bg px-hsp-md py-vsp-2xs text-small leading-relaxed text-chat-assistant-text"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
        />
      )}
    </div>
  );
});

export function AiChatModal({ basePath }: AiChatModalProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setIsOpen(false);
    setMessages([]);
    setInput("");
    setError(null);
    setLoading(false);
  }, []);

  const { dialogRef, handleBackdropClick } = useModalDialog({
    isOpen,
    onClose: resetState,
    navigateEvent: BEFORE_NAVIGATE_EVENT,
    backdropClickClose: true,
    restoreFocusOnly: true,
  });

  useEffect(() => {
    function handleToggle() {
      const dialog = dialogRef.current;
      if (!dialog || !dialog.isConnected) return;
      if (dialog.open) {
        dialog.close();
      } else {
        setIsOpen(true);
      }
    }
    window.addEventListener("toggle-ai-chat", handleToggle);
    return () => window.removeEventListener("toggle-ai-chat", handleToggle);
  }, [dialogRef]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const base = basePath.replace(/\/+$/, "");
      const res = await fetch(`${base}/api/ai-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: messages,
        }),
      });

      const raw: unknown = await res.json();
      const data = isAiChatResponse(raw) ? raw : {};

      if (!res.ok) {
        setError(("error" in data && typeof data.error === "string" ? data.error : null) || "Something went wrong");
      } else if ("response" in data && typeof data.response === "string" && data.response) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.response as string },
        ]);
      } else {
        setError("Received an empty or invalid response");
      }
    } catch {
      setError("Failed to connect to the AI assistant");
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, basePath]);

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="z-modal m-0 h-dvh max-h-none w-dvw max-w-none border-none bg-surface p-0 text-fg backdrop:z-modal-backdrop backdrop:bg-bg/80 lg:m-auto lg:h-[90vh] lg:max-h-[90vh] lg:w-[90vw] lg:max-w-[52.5rem] lg:border-solid lg:border lg:border-fg"
    >
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-muted px-hsp-lg py-vsp-xs">
          <h2 className="text-title font-bold text-fg">AI Assistant</h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="flex items-center justify-center text-muted transition-colors hover:text-fg"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div role="log" aria-label="Chat messages" className="flex-1 overflow-y-auto px-hsp-lg py-vsp-sm">
          {messages.length === 0 && !loading && (
            <p className="py-vsp-xl text-center text-small text-muted">
              Ask a question about the documentation.
            </p>
          )}
          {messages.map((msg, i) => (
            <ChatMessageRow key={i} msg={msg} />
          ))}
          <div
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {(() => {
              // findLast is not in current tsconfig lib target; loop from end.
              for (let i = messages.length - 1; i >= 0; i--) {
                const msg = messages[i];
                if (msg && msg.role === "assistant") return msg.content;
              }
              return "";
            })()}
          </div>
          {loading && (
            <div className="mb-vsp-xs flex justify-start">
              <div
                role="status"
                className="rounded-t-[1rem] rounded-br-[1rem] rounded-bl-[0.25rem] bg-chat-assistant-bg px-hsp-md py-vsp-2xs text-small text-muted"
              >
                Thinking...
              </div>
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="mb-vsp-xs rounded-[0.75rem] border border-danger bg-bg px-hsp-md py-vsp-2xs text-small text-danger"
            >
              {error}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="shrink-0 border-t border-muted px-hsp-lg py-vsp-xs">
          <div className="flex items-center gap-x-hsp-sm">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              aria-label="Type your message"
              aria-busy={loading}
              placeholder="Type your message..."
              className="flex-1 rounded-full border border-muted bg-bg px-hsp-lg py-vsp-2xs text-small text-fg placeholder:text-muted focus:border-accent focus:outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              aria-busy={loading}
              className="flex h-[2rem] w-[2rem] shrink-0 items-center justify-center rounded-full bg-accent text-bg transition-colors hover:bg-accent-hover disabled:opacity-50"
              aria-label="Send message"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
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
AiChatModal.displayName = "AiChatModal";
