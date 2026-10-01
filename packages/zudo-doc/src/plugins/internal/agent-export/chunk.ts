import { AGENT_MAX_ITEM_TEXT_UNITS, AGENT_MAX_TOOL_RESPONSE_BYTES } from "../../../agent-docs/limits.js";

function safeCut(text: string, start: number, limit: number): number {
  let end = Math.min(start + limit, text.length);
  if (end < text.length && end > start && /[\uD800-\uDBFF]/.test(text[end - 1]!)) end--;
  return end;
}

/** Exact, ordered slices. Boundaries prefer headings and paragraphs, then Unicode-safe cuts. */
export function chunkAgentText(text: string, title: string, url: string): string[] {
  if (!text) return [""];
  const result: string[] = [];
  let offset = 0;
  // The duplicated MCP structured/text envelope can exceed the text limit for
  // escapable characters. Test actual serialized bytes and shrink as needed.
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
    while (part.length > 1 && Buffer.byteLength(JSON.stringify({ structuredContent: { id: "x".repeat(32), title, text: part, url, metadata: { locale: "x", pageId: "x".repeat(32), fingerprint: "x".repeat(64), part: 999999, partCount: 999999 } }, content: [{ type: "text", text: JSON.stringify({ id: "x".repeat(32), title, text: part, url }) }] })) > AGENT_MAX_TOOL_RESPONSE_BYTES - 4096) {
      end = safeCut(text, offset, Math.max(1, Math.floor((end - offset) * 0.8)));
      part = text.slice(offset, end);
    }
    result.push(part);
    offset = end;
  }
  return result;
}
