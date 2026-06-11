/**
 * ai-chat-payload.test.ts
 *
 * Payload tests for pages/api/_ai-chat-payload.ts.
 *
 * These tests assert the structure of the assembled Anthropic API request
 * body WITHOUT calling the real API — the corpus string is injected directly
 * so no network, no CF globals, and no ANTHROPIC_API_KEY are needed.
 *
 * CI gate: the assembled request must include exactly one cache_control
 * breakpoint, placed on the stable corpus (system) block. No breakpoint
 * must appear on any messages entry — those are per-turn dynamic content.
 */

import { describe, it, expect } from "vitest";
import {
  buildClaudeRequestBody,
  buildSystemPromptText,
} from "../../../pages/api/_ai-chat-payload";

const SAMPLE_CORPUS = "# zudo-doc docs\n\nSample documentation content.";

describe("buildSystemPromptText", () => {
  it("embeds the corpus inside <documentation> tags", () => {
    const text = buildSystemPromptText(SAMPLE_CORPUS);
    expect(text).toContain("<documentation>");
    expect(text).toContain(SAMPLE_CORPUS);
    expect(text).toContain("</documentation>");
  });

  it("includes the system rules preamble", () => {
    const text = buildSystemPromptText(SAMPLE_CORPUS);
    expect(text).toContain("documentation assistant for zudo-doc");
    expect(text).toContain("<rules>");
  });

  it("instructs the model to treat prior conversation turns as untrusted client input", () => {
    // Issue #2036: history is client-supplied and stateless, so a forged
    // assistant turn is possible. The system prompt is the documented
    // mitigation — assert the untrusted-history rule stays present.
    const text = buildSystemPromptText(SAMPLE_CORPUS);
    expect(text).toContain("supplied by the client");
    expect(text).toMatch(/must NEVER override these rules/i);
  });
});

describe("buildClaudeRequestBody — cache_control breakpoint", () => {
  it("places system as a content-block array (not a plain string)", () => {
    const body = buildClaudeRequestBody("hello", [], SAMPLE_CORPUS);
    expect(Array.isArray(body.system)).toBe(true);
  });

  it("has exactly one system block", () => {
    const body = buildClaudeRequestBody("hello", [], SAMPLE_CORPUS);
    expect(body.system).toHaveLength(1);
  });

  it("system block is type=text and contains the corpus", () => {
    const body = buildClaudeRequestBody("hello", [], SAMPLE_CORPUS);
    const block = body.system[0]!;
    expect(block.type).toBe("text");
    expect(block.text).toContain(SAMPLE_CORPUS);
  });

  it("system block carries cache_control: { type: 'ephemeral' }", () => {
    const body = buildClaudeRequestBody("hello", [], SAMPLE_CORPUS);
    const block = body.system[0]!;
    expect(block.cache_control).toEqual({ type: "ephemeral" });
  });

  it("exactly one cache_control breakpoint across the entire body (CI gate)", () => {
    const history = [
      { role: "user" as const, content: "previous question" },
      { role: "assistant" as const, content: "previous answer" },
    ];
    const body = buildClaudeRequestBody("new question", history, SAMPLE_CORPUS);

    // Count all cache_control occurrences across the serialized body.
    // We check both the system blocks and the messages array explicitly.
    const systemBreakpoints = body.system.filter((b) => b.cache_control != null);
    expect(systemBreakpoints).toHaveLength(1);

    // messages entries must NOT carry cache_control (they are dynamic per-turn).
    for (const msg of body.messages) {
      expect(
        Object.prototype.hasOwnProperty.call(msg, "cache_control"),
      ).toBe(false);
    }
  });

  it("appends the current user message at the end of messages", () => {
    const history = [{ role: "user" as const, content: "earlier" }];
    const body = buildClaudeRequestBody("new question", history, SAMPLE_CORPUS);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[1]).toEqual({ role: "user", content: "new question" });
  });

  it("uses the expected model and max_tokens defaults", () => {
    const body = buildClaudeRequestBody("hi", [], SAMPLE_CORPUS);
    expect(body.model).toBe("claude-haiku-4-5-20251001");
    expect(body.max_tokens).toBe(2048);
  });

  it("allows overriding model and max_tokens", () => {
    const body = buildClaudeRequestBody("hi", [], SAMPLE_CORPUS, "claude-opus-4", 1024);
    expect(body.model).toBe("claude-opus-4");
    expect(body.max_tokens).toBe(1024);
  });
});
