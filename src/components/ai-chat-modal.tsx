import { useState, useEffect, useRef, useCallback } from "react";
import type { ChatMessage } from "@/types/ai-chat";

interface AiChatModalProps {
  basePath: string;
}

export default function AiChatModal({ basePath }: AiChatModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Listen for toggle event
  useEffect(() => {
    function handleToggle() {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (dialog.open) {
        dialog.close();
      } else {
        dialog.showModal();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("toggle-ai-chat", handleToggle);
    return () => window.removeEventListener("toggle-ai-chat", handleToggle);
  }, []);

  // Reset state when dialog closes
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function handleClose() {
      setMessages([]);
      setInput("");
      setError(null);
      setLoading(false);
    }
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Backdrop click
  function handleBackdropClick(e: React.MouseEvent) {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      dialog.close();
    }
  }

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

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.response },
        ]);
      }
    } catch {
      setError("Failed to connect to the AI assistant");
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, basePath]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function formatContent(content: string) {
    const lines = content.split("\n");
    return lines.map((line, i) => (
      <span key={i}>
        {line}
        {i < lines.length - 1 && <br />}
      </span>
    ));
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="m-0 h-full w-full border border-muted bg-surface p-0 backdrop:bg-bg/80 lg:m-auto lg:h-[min(80vh,48rem)] lg:w-[min(90vw,40rem)] lg:rounded-sm"
      style={{
        color: "var(--color-fg)",
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        maxWidth: "none",
        maxHeight: "none",
      }}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-muted px-hsp-lg py-vsp-xs">
          <h2 className="text-subheading font-bold text-fg">AI Assistant</h2>
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
        <div className="flex-1 overflow-y-auto px-hsp-lg py-vsp-sm">
          {messages.length === 0 && !loading && (
            <p className="text-center text-small text-muted">
              Ask a question about the documentation.
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`mb-vsp-xs flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-sm px-hsp-md py-vsp-2xs text-small ${
                  msg.role === "user"
                    ? "bg-accent text-bg"
                    : "bg-bg text-fg"
                }`}
              >
                {formatContent(msg.content)}
              </div>
            </div>
          ))}
          {loading && (
            <div className="mb-vsp-xs flex justify-start">
              <div className="rounded-sm bg-bg px-hsp-md py-vsp-2xs text-small text-muted">
                Thinking...
              </div>
            </div>
          )}
          {error && (
            <div className="mb-vsp-xs rounded-sm border border-danger bg-bg px-hsp-md py-vsp-2xs text-small text-danger">
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
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Type your message..."
              className="flex-1 border border-muted bg-bg px-hsp-md py-vsp-2xs text-small text-fg placeholder:text-muted focus:border-accent focus:outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="flex items-center justify-center border border-muted bg-accent px-hsp-md py-vsp-2xs text-small text-bg transition-colors hover:bg-accent-hover disabled:opacity-50"
              aria-label="Send message"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
