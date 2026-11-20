// Codex custom agent (`.codex/agents/*.toml`) renderer.

import { parse } from "smol-toml";
import { escapeForMdx } from "./escape-for-mdx.js";
import { escapeMarkdownTableCell, renderCodeFence } from "./markdown-structure.js";
import { isRecord, type RenderedPage, type Warn } from "./types.js";

function optionalString(
  record: Record<string, unknown>,
  field: string,
  warn: Warn,
): string | undefined {
  const value = record[field];
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  warn(`${field} must be a string; omitting it`);
  return undefined;
}

export function renderCodexAgent(
  source: string,
  fallbackName: string,
  warn: Warn,
): RenderedPage {
  let parsed: unknown;
  try {
    parsed = parse(source);
  } catch (error) {
    warn(`unable to parse TOML; rendering the source only: ${String(error)}`);
    parsed = {};
  }
  const record = isRecord(parsed) ? parsed : {};
  const name = optionalString(record, "name", warn) ?? fallbackName;
  const description = optionalString(record, "description", warn) ?? "";
  const model = optionalString(record, "model", warn);
  const reasoning = optionalString(record, "model_reasoning_effort", warn);
  const sandbox = optionalString(record, "sandbox_mode", warn);
  const instructions = optionalString(record, "developer_instructions", warn);
  const badges = [
    model ? `**Model:** ${escapeMarkdownTableCell(model)}` : "",
    reasoning ? `**Reasoning effort:** ${escapeMarkdownTableCell(reasoning)}` : "",
    sandbox ? `**Sandbox:** ${escapeMarkdownTableCell(sandbox)}` : "",
  ].filter(Boolean);
  const sections = [badges.join("\n")];
  if (instructions !== undefined) {
    sections.push(`## Developer instructions\n\n${escapeForMdx(instructions.trim())}`);
  }
  sections.push(`## Source\n\n${renderCodeFence(source, "toml")}`);
  return { title: name, description, body: sections.filter(Boolean).join("\n\n") };
}
