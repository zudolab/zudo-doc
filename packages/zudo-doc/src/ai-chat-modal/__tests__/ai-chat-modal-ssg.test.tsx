import { describe, expect, it } from "vitest";
import { renderSsr } from "../../__tests__/helpers/zudo-react.js";
import { AiChatModal } from "../index.js";

describe("AiChatModal — island identity", () => {
  it("keeps a named entry component for zfb's island scanner", () => {
    expect(AiChatModal.name).toBe("AiChatModal");
  });
});

describe("AiChatModal — SSG HTML presence (closed state)", () => {
  const html = renderSsr(<AiChatModal basePath="/" />);

  it("renders a closed dialog with the title and chat-log region", () => {
    expect(html).toContain("<dialog");
    expect(html).toContain("AI Assistant");
    expect(html).toContain('role="log"');
    expect(html).toContain('aria-label="Chat messages"');
  });

  it("renders the accessible input, send button, and close button", () => {
    expect(html).toContain('aria-label="Type your message"');
    expect(html).toContain('type="text"');
    expect(html).toContain('aria-label="Send message"');
    expect(html).toContain('aria-label="Close"');
  });

  it("starts with the empty-state prompt and no chat messages", () => {
    expect(html).toContain("Ask a question about the documentation.");
    expect(html).not.toContain("ai-chat-md");
  });
});
