// Codex command approval rules (`.codex/rules/*.rules`) renderer. The
// Starlark subset parser only reads `prefix_rule(...)` calls; nothing runs.

import { renderCodeFence, renderTableRow } from "./markdown-structure.js";
import type { RenderedPage } from "./types.js";

interface RuleRow {
  pattern?: string;
  decision?: string;
  justification?: string;
}

interface ScanState {
  quote: "'" | '"' | null;
  triple: boolean;
  escaped: boolean;
  comment: boolean;
}

function freshState(): ScanState {
  return { quote: null, triple: false, escaped: false, comment: false };
}

/** Advance Starlark string/comment state, returning how many chars were used. */
function advanceState(text: string, index: number, state: ScanState): number {
  const char = text[index] ?? "";
  if (state.comment) {
    if (char === "\n") state.comment = false;
    return 1;
  }
  if (state.quote !== null) {
    if (state.escaped) {
      state.escaped = false;
      return 1;
    }
    if (char === "\\") {
      state.escaped = true;
      return 1;
    }
    if (state.triple && text.slice(index, index + 3) === state.quote.repeat(3)) {
      state.quote = null;
      state.triple = false;
      return 3;
    }
    if (!state.triple && char === state.quote) state.quote = null;
    return 1;
  }
  if (char === "#") {
    state.comment = true;
    return 1;
  }
  if (char === "'" || char === '"') {
    state.quote = char;
    state.triple = text.slice(index, index + 3) === char.repeat(3);
    return state.triple ? 3 : 1;
  }
  return 1;
}

function findPrefixRuleBodies(source: string): string[] {
  const bodies: string[] = [];
  const state = freshState();
  let index = 0;
  while (index < source.length) {
    if (state.quote === null && !state.comment && source.startsWith("prefix_rule", index)) {
      const before = source[index - 1];
      const after = source[index + "prefix_rule".length];
      if ((!before || !/[\w]/.test(before)) && (!after || !/[\w]/.test(after))) {
        let open = index + "prefix_rule".length;
        while (/\s/.test(source[open] ?? "")) open++;
        if (source[open] === "(") {
          const callState = freshState();
          let depth = 1;
          let cursor = open + 1;
          const bodyStart = cursor;
          while (cursor < source.length) {
            if (callState.quote === null && !callState.comment) {
              if (source[cursor] === "(") depth++;
              if (source[cursor] === ")") {
                depth--;
                if (depth === 0) break;
              }
            }
            cursor += advanceState(source, cursor, callState);
          }
          bodies.push(source.slice(bodyStart, cursor));
          index = cursor < source.length ? cursor + 1 : source.length;
          continue;
        }
      }
    }
    index += advanceState(source, index, state);
  }
  return bodies;
}

function splitTopLevel(text: string, delimiter: string): string[] {
  const parts: string[] = [];
  const state = freshState();
  let square = 0;
  let round = 0;
  let curly = 0;
  let start = 0;
  let index = 0;
  while (index < text.length) {
    if (state.quote === null && !state.comment) {
      const char = text[index];
      if (char === "[") square++;
      else if (char === "]") square--;
      else if (char === "(") round++;
      else if (char === ")") round--;
      else if (char === "{") curly++;
      else if (char === "}") curly--;
      else if (char === delimiter && square === 0 && round === 0 && curly === 0) {
        parts.push(text.slice(start, index));
        start = index + 1;
      }
    }
    index += advanceState(text, index, state);
  }
  parts.push(text.slice(start));
  return parts;
}

function parseStringLiteral(value: string): string | undefined {
  const text = value.trim();
  const quote = text[0];
  if ((quote !== '"' && quote !== "'") || text.at(-1) !== quote) return undefined;
  if (text.startsWith(quote.repeat(3)) && text.endsWith(quote.repeat(3))) {
    return text.slice(3, -3);
  }
  const inner = text.slice(1, -1);
  let result = "";
  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];
    if (char !== "\\") {
      result += char;
      continue;
    }
    const next = inner[++i];
    if (next === undefined) return undefined;
    const escapes: Record<string, string> = {
      n: "\n",
      r: "\r",
      t: "\t",
      "\\": "\\",
      "'": "'",
      '"': '"',
    };
    result += escapes[next] ?? next;
  }
  return result;
}

type PatternValue = string | PatternValue[];

function parsePatternValue(text: string): PatternValue | undefined {
  const trimmed = text.trim();
  const stringValue = parseStringLiteral(trimmed);
  if (stringValue !== undefined) return stringValue;
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return undefined;
  const inner = trimmed.slice(1, -1);
  if (inner.trim() === "") return [];
  const values: PatternValue[] = [];
  for (const part of splitTopLevel(inner, ",")) {
    if (part.trim() === "") continue;
    const parsed = parsePatternValue(part);
    if (parsed === undefined) return undefined;
    values.push(parsed);
  }
  return values;
}

function formatPattern(value: PatternValue): string | undefined {
  if (!Array.isArray(value)) return value;
  const parts: string[] = [];
  for (const element of value) {
    if (Array.isArray(element)) {
      if (element.some(Array.isArray)) return undefined;
      parts.push((element as string[]).join("|"));
    } else {
      parts.push(element);
    }
  }
  return parts.join(" ");
}

function parseRule(body: string): RuleRow {
  const args = new Map<string, string>();
  for (const part of splitTopLevel(body, ",")) {
    const assignment = splitTopLevel(part, "=");
    if (assignment.length !== 2) continue;
    const key = assignment[0]?.trim();
    const value = assignment[1];
    if (key && value !== undefined) args.set(key, value.trim());
  }
  const rawPattern = args.get("pattern");
  const parsedPattern = rawPattern === undefined
    ? undefined
    : parsePatternValue(rawPattern);
  const decision = args.has("decision")
    ? parseStringLiteral(args.get("decision") ?? "")
    : "allow";
  return {
    pattern: parsedPattern === undefined ? undefined : formatPattern(parsedPattern),
    decision,
    justification: args.has("justification")
      ? parseStringLiteral(args.get("justification") ?? "")
      : undefined,
  };
}

export function renderCodexRules(source: string, filename: string): RenderedPage {
  const rows = findPrefixRuleBodies(source).map(parseRule);
  const body = [
    "## Rules",
    "",
    "| Pattern | Decision | Justification |",
    "| --- | --- | --- |",
    ...(rows.length > 0
      ? rows.map((row) => renderTableRow([row.pattern, row.decision, row.justification]))
      : [renderTableRow(Array.from({ length: 3 }))]),
    "",
    "## Source",
    "",
    renderCodeFence(source, "python"),
  ].join("\n");
  return { title: filename, description: `Command approval rules from ${filename}`, body };
}
