import { AGENT_MAX_ITEM_TEXT_UNITS, AGENT_MAX_TOOL_RESPONSE_BYTES } from "../../../agent-docs/limits.js";
import type { AgentItem } from "../../../agent-docs/types.js";

type AgentChunkMetadata = Pick<AgentItem["metadata"], "locale" | "pageId"> &
  Partial<
    Pick<
      AgentItem["metadata"],
      "description" | "section" | "unsupportedDynamicContent"
    >
  >;

const RESPONSE_FRAMING_RESERVE_BYTES = 4096;

function isHighSurrogate(value: number): boolean {
  return value >= 0xd800 && value <= 0xdbff;
}

function isLowSurrogate(value: number): boolean {
  return value >= 0xdc00 && value <= 0xdfff;
}

function firstCodePointUnits(text: string, start: number): number {
  return isHighSurrogate(text.charCodeAt(start)) && isLowSurrogate(text.charCodeAt(start + 1))
    ? 2
    : 1;
}

function safeCut(text: string, start: number, limit: number): number {
  let end = Math.min(start + limit, text.length);
  if (
    end < text.length &&
    end > start &&
    isHighSurrogate(text.charCodeAt(end - 1)) &&
    isLowSurrogate(text.charCodeAt(end))
  ) {
    end--;
  }
  return end;
}

function fitsResponseBudget(
  text: string,
  title: string,
  url: string,
  metadata: AgentChunkMetadata,
): boolean {
  const item = {
    // The real page IDs are 25 UTF-16 units at most; keep a larger fixed ID
    // and the maximum part numbers while sizing before chunkCount is known.
    id: "x".repeat(32),
    title,
    text,
    url,
    metadata: {
      ...metadata,
      fingerprint: "f".repeat(64),
      part: 999_999,
      partCount: 999_999,
    },
  };
  const serialized = JSON.stringify({
    structuredContent: item,
    content: [{ type: "text", text: JSON.stringify(item) }],
  });
  return (
    Buffer.byteLength(serialized) <=
    AGENT_MAX_TOOL_RESPONSE_BYTES - RESPONSE_FRAMING_RESERVE_BYTES
  );
}

function failItemBudget(): never {
  throw new Error(
    "Agent item cannot fit within the MCP tool response byte limit, even with one Unicode code point.",
  );
}

/** Exact, ordered slices. Boundaries prefer headings and paragraphs, then Unicode-safe cuts. */
export function chunkAgentText(
  text: string,
  title: string,
  url: string,
  metadata: AgentChunkMetadata = { locale: "x", pageId: "x".repeat(32) },
): string[] {
  if (!text) {
    if (!fitsResponseBudget("", title, url, metadata)) failItemBudget();
    return [""];
  }
  const result: string[] = [];
  let offset = 0;
  // The duplicated MCP structured/text envelope can exceed the text limit for
  // escapable characters or unusually large metadata. Test the serialized
  // fields twice and reserve space for JSON-RPC framing.
  while (offset < text.length) {
    let end = safeCut(text, offset, AGENT_MAX_ITEM_TEXT_UNITS);
    if (end < text.length) {
      const slice = text.slice(offset, end);
      const preferred = Math.max(slice.lastIndexOf("\n# "), slice.lastIndexOf("\n## "), slice.lastIndexOf("\n\n"));
      if (preferred > Math.floor(slice.length / 3)) end = offset + preferred + 1;
      // A fence crossing this boundary is kept whole when it fits the budget.
      const before = text.slice(offset, end);
      const openings = [...before.matchAll(/^\s*(`{3,}|~{3,})/gm)];
      if (openings.length % 2 === 1) {
        const last = openings.at(-1)!;
        const fenceStart = offset + last.index!;
        const close = text.indexOf(`\n${last[1]}`, end);
        if (close >= 0 && close + 1 + last[1]!.length - offset <= AGENT_MAX_ITEM_TEXT_UNITS) {
          end = close + 1 + last[1]!.length;
        } else if (fenceStart > offset) end = fenceStart;
      }
    }
    if (end <= offset) end = safeCut(text, offset, AGENT_MAX_ITEM_TEXT_UNITS);
    let part = text.slice(offset, end);
    while (!fitsResponseBudget(part, title, url, metadata)) {
      const currentUnits = end - offset;
      const minimumUnits = firstCodePointUnits(text, offset);
      if (currentUnits <= minimumUnits) failItemBudget();
      const nextUnits = Math.max(minimumUnits, Math.floor(currentUnits * 0.8));
      let nextEnd = safeCut(text, offset, nextUnits);
      if (nextEnd <= offset || nextEnd >= end) nextEnd = offset + minimumUnits;
      if (nextEnd <= offset || nextEnd >= end) failItemBudget();
      end = nextEnd;
      part = text.slice(offset, end);
    }
    result.push(part);
    offset = end;
  }
  return result;
}
