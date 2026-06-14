"use client";

// Use `preact/compat` so the bundle resolves to Preact's React-shim at
// runtime. The "react" → "preact/compat" alias lets us consume React-typed
// components in this Preact app (configured project-wide). preact/compat
// re-exports the same hooks under the React-compat names plus the `React.*`
// type namespace this file references for event handlers.
import { useState, useEffect, useRef, useCallback, memo } from "preact/compat";
import type { ChatMessage } from "@/types/ai-chat";
import { renderMarkdown } from "@/utils/render-markdown";
import { SmartBreak } from "@/utils/smart-break";
import { BEFORE_NAVIGATE_EVENT } from "@takazudo/zudo-doc/transitions";
import { useModalDialog } from "@/hooks/use-modal-dialog";

interface AiChatModalProps {
  basePath: string;
}

/** Runtime type guard for the AI chat API response. The server returns
 *  `{ response: string }` on 2xx and `{ error: string }` on 4xx/5xx.
 *  Prevents laundering an untrusted `res.json()` value (typed as `any`)
 *  into the component's typed code without validation. */
function isAiChatResponse(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" && data !== null;
}

// Memoized row: message objects are immutable once appended, so rows skip
// re-rendering on unrelated state changes — without this, every keystroke
// (input state) re-runs renderMarkdown for every assistant message.
const ChatMessageRow = memo(function ChatMessageRow({ msg }: { msg: ChatMessage }) {
  return (
    <div
      className={`mb-vsp-xs flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
    >
      {/* SR-only role prefix: visual distinction is bubble alignment/color only, so
          screen readers need a text label to identify speaker. position:absolute
          pulls it out of flex flow, preserving the bubble layout. */}
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

export default function AiChatModal({ basePath }: AiChatModalProps) {
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

  // Shared dialog lifecycle: showModal/close sync, native-close callback,
  // backdrop click, and navigation-close (before swap to avoid stale-ref
  // errors on next open — refs #1621) — delegated to useModalDialog.
  const { dialogRef, handleBackdropClick } = useModalDialog({
    isOpen,
    onClose: resetState,
    navigateEvent: BEFORE_NAVIGATE_EVENT,
    backdropClickClose: true,
  });

  // Listen for toggle event dispatched by the header AI-chat trigger button.
  // Guard against stale refs from detached DOM after SPA navigation (#1621).
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

  // Focus the input once the dialog is open. useModalDialog calls
  // dialog.showModal() in a layout effect; focusing in a separate effect
  // that runs after ensures the dialog is in the top layer before focus.
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Auto-scroll to bottom when messages change
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
      // isAiChatResponse acts as a runtime type guard — res.json() returns
      // `any` which would launder an untrusted network payload into typed
      // code without validation. The server returns { response: string } on
      // 2xx and { error: string } on 4xx/5xx (mirrors _ai-chat-types.ts
      // isClaudeApiResponse pattern used on the server side).
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="m-0 h-dvh max-h-none w-dvw max-w-none border-none bg-surface p-0 text-fg backdrop:bg-bg/80 lg:m-auto lg:h-[90vh] lg:max-h-[90vh] lg:w-[90vw] lg:max-w-[52.5rem] lg:border-solid lg:border lg:border-fg"
    >
      <div className="flex h-full flex-col">
        {/* Header */}
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

        {/* Messages */}
        {/* role="log" implies aria-live="polite" aria-relevant="additions" per
            the ARIA spec; it does NOT re-announce prior entries when the list
            grows, which is the correct behavior for a chat transcript.
            The previous aria-live="polite" on this whole container caused every
            prior message and the user's own message to be re-announced on each
            update (#2136 M4). */}
        <div role="log" aria-label="Chat messages" className="flex-1 overflow-y-auto px-hsp-lg py-vsp-sm">
          {messages.length === 0 && !loading && (
            <p className="py-vsp-xl text-center text-small text-muted">
              Ask a question about the documentation.
            </p>
          )}
          {/* Index keys are stable here: the list is append-only and only
              resets wholesale on dialog close. */}
          {messages.map((msg, i) => (
            <ChatMessageRow key={i} msg={msg} />
          ))}
          {/* Scoped polite live region: only announces the latest assistant reply.
              Rendered as a visually hidden node that is updated when a new assistant
              message arrives so the screen reader reads only the new content (#2136 M4). */}
          <div
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {(() => {
              const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
              return lastAssistant ? lastAssistant.content : "";
            })()}
          </div>
          {loading && (
            <div className="mb-vsp-xs flex justify-start">
              {/* role="status" marks this as a live status region distinct from the
                  message log; it implies aria-live="polite" on its own node. */}
              <div
                role="status"
                className="rounded-t-[1rem] rounded-br-[1rem] rounded-bl-[0.25rem] bg-chat-assistant-bg px-hsp-md py-vsp-2xs text-small text-muted"
              >
                Thinking...
              </div>
            </div>
          )}
          {error && (
            // role="alert" (assertive) rather than polite: a failed send is
            // actionable — the user must know immediately so they can retry.
            <div
              role="alert"
              className="mb-vsp-xs rounded-[0.75rem] border border-danger bg-bg px-hsp-md py-vsp-2xs text-small text-danger"
            >
              {error}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
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
