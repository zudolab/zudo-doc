/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * SSG hydration smoke test for AiChatModal.
 *
 * Verifies that:
 *   1. The component renders the dialog structure in static HTML (closed state,
 *      since isOpen starts as false on mount).
 *   2. The accessible input, send button, and chat-log region are present in
 *      the SSR output.
 *   3. `displayName` is pinned so zfb's island scanner produces the right marker.
 *
 * Pattern: toc/__tests__/toc-ssg.test.tsx.
 */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { AiChatModal } from "../index.js";

describe("AiChatModal — displayName (island scanner marker)", () => {
  it("pins displayName to 'AiChatModal' so zfb's captureComponentName produces the right marker", () => {
    expect(AiChatModal.displayName).toBe("AiChatModal");
  });
});

describe("AiChatModal — SSG HTML presence (closed state)", () => {
  it("renders a dialog element in static HTML", () => {
    const html = render(<AiChatModal basePath="/" />);
    expect(html).toContain("<dialog");
  });

  it("renders the 'AI Assistant' heading in static HTML", () => {
    const html = render(<AiChatModal basePath="/" />);
    expect(html).toContain("AI Assistant");
  });

  it("renders the chat log region with aria-label in static HTML", () => {
    const html = render(<AiChatModal basePath="/" />);
    expect(html).toContain('role="log"');
    expect(html).toContain('aria-label="Chat messages"');
  });

  it("renders the text input with aria-label in static HTML", () => {
    const html = render(<AiChatModal basePath="/" />);
    expect(html).toContain('aria-label="Type your message"');
    expect(html).toContain('type="text"');
  });

  it("renders the send button in static HTML", () => {
    const html = render(<AiChatModal basePath="/" />);
    expect(html).toContain('aria-label="Send message"');
  });

  it("renders the close button in static HTML", () => {
    const html = render(<AiChatModal basePath="/" />);
    expect(html).toContain('aria-label="Close"');
  });

  it("does not render any chat messages in initial closed state", () => {
    const html = render(<AiChatModal basePath="/" />);
    // No assistant or user messages in the initial empty state.
    expect(html).not.toContain("ai-chat-md");
  });
});
