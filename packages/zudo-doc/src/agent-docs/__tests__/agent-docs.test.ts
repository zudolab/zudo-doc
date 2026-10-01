import { describe, expect, it } from "vitest";
import { agentItemKey, agentPageKey } from "../identity.js";
import { AGENT_MAX_ITEMS } from "../limits.js";
import { buildAgentSearchIndex, searchAgentIndex } from "../search.js";
import { tokenizeAgentText } from "../tokenize.js";
import type { AgentItem } from "../types.js";

function item(id: string, title: string, text: string, locale = "en", extra: Partial<AgentItem["metadata"]> = {}): AgentItem {
  return {
    id, title, text, url: `https://docs.example/${locale}/${id}/`,
    metadata: { locale, pageId: id.slice(0, 18), fingerprint: "abc", part: 1, partCount: 1, ...extra },
  };
}

describe("agent identity", () => {
  it("uses standard UTF-8 FNV-1a-64 and one-based item keys", () => {
    expect(agentPageKey("en", "docs/start")).toBe("p-0b448d35bbf7dfb0");
    expect(agentPageKey("ja", "docs/設定")).toBe("p-a4b40e4f5e8ae49e");
    expect(agentPageKey("ja", "docs/start")).not.toBe(agentPageKey("en", "docs/start"));
    expect(agentItemKey("p-0123456789abcdef", 2)).toBe("p-0123456789abcdef-000002");
    expect(() => agentItemKey("../bad", 1)).toThrow();
    expect(() => agentItemKey("p-0123456789abcdef", 0)).toThrow();
  });
});

describe("agent tokenization", () => {
  it("normalizes identifiers and Japanese unigrams/bigrams deterministically", () => {
    expect(tokenizeAgentText("zudoDoc() の設定 API_KEY")).toEqual([
      "api_key", "zudodoc", "の", "の設", "定", "設", "設定",
    ]);
    expect(tokenizeAgentText("ＡＰＩ_key API_KEY")).toEqual(["api_key"]);
    expect(tokenizeAgentText("🍣設定")).toEqual(["定", "設", "設定"]);
  });
});

describe("agent full-text search", () => {
  const fixtures = [
    item("a", "Configuration", "Intro.\n## Authentication\nUse zudoDoc() and API_KEY for auth.\n" + "x".repeat(3_100) + " needleafter3000"),
    item("b", "設定", "## 認証\nzudoDoc() の設定と API_KEY を説明します。", "ja", { section: "認証" }),
    item("c", "Configuration", "This page describes colors and themes.", "ja"),
    item("d", "Guide", "A general guide to configuration and setup."),
  ];
  const index = buildAgentSearchIndex(fixtures);

  it("finds complete text after character 3,000", () => {
    expect(searchAgentIndex(index, "needleafter3000")).toMatchObject({ ok: true, results: [{ id: "a" }] });
  });
  it("ranks Japanese, mixed identifier, and English queries", () => {
    const first = (query: string) => {
      const result = searchAgentIndex(index, query);
      return result.ok ? result.results[0]?.id : undefined;
    };
    expect(first("認証")).toBe("b");
    expect(first("zudoDoc() の設定 API_KEY")).toBe("b");
    expect(first("Configuration")).toBe("a");
  });
  it("disambiguates locale, section, and part when needed", () => {
    const result = searchAgentIndex(index, "Configuration");
    expect(result.ok && result.results.find((entry) => entry.id === "a")?.title).toBe("Configuration (en)");
    expect(result.ok && result.results.find((entry) => entry.id === "c")?.title).toBe("Configuration (ja)");
    expect(searchAgentIndex(index, "認証")).toMatchObject({ ok: true, results: [{ title: "設定 (ja · 認証)" }] });
    const parts = buildAgentSearchIndex([item("p", "Large", "needle", "en", { part: 2, partCount: 3 })]);
    expect(searchAgentIndex(parts, "needle")).toMatchObject({ ok: true, results: [{ title: "Large (en · part 2/3)" }] });
    const sameLocale = buildAgentSearchIndex([item("x", "Guide", "needle"), item("y", "Guide", "needle")]);
    expect(searchAgentIndex(sameLocale, "needle")).toMatchObject({
      ok: true, results: [{ title: "Guide (en · x)" }, { title: "Guide (en · y)" }],
    });
  });
  it("validates queries, caps results, and makes ties deterministic", () => {
    expect(searchAgentIndex(index, "   ")).toEqual({ ok: false, error: "Query must not be empty." });
    expect(searchAgentIndex(index, "x".repeat(501))).toMatchObject({ ok: false });
    expect(searchAgentIndex(index, "x".repeat(500)).ok).toBe(true);
    expect(searchAgentIndex(index, "🦄")).toMatchObject({ ok: false });
    expect(searchAgentIndex(index, "unmatchedterm")).toEqual({ ok: true, results: [] });
    expect(searchAgentIndex(index, "Configuration", 1)).toMatchObject({ ok: true, results: [{ id: "a" }] });
    const capped = searchAgentIndex(buildAgentSearchIndex(Array.from({ length: 12 }, (_, i) => item(String(i), "Page", "needle"))), "needle", 100);
    expect(capped.ok && capped.results).toHaveLength(10);
    const equal = buildAgentSearchIndex([item("z", "X", "same"), item("a", "Y", "same")]);
    expect(searchAgentIndex(equal, "same")).toMatchObject({ ok: true, results: [{ id: "a" }, { id: "z" }] });
    expect(searchAgentIndex(index, "Configuration")).toEqual(searchAgentIndex(buildAgentSearchIndex(fixtures), "Configuration"));
    expect(searchAgentIndex(buildAgentSearchIndex({ schemaVersion: 1, fingerprint: "abc", items: fixtures }), "認証"))
      .toEqual(searchAgentIndex(index, "認証"));
    expect(() => buildAgentSearchIndex({ schemaVersion: 2, fingerprint: "abc", items: fixtures } as never)).toThrow();
    expect(() => buildAgentSearchIndex(Array.from({ length: AGENT_MAX_ITEMS + 1 }, () => fixtures[0]!))).toThrow();
  });
});
