// Codex configuration (`config.toml`, profiles) renderer.

import { parse, TomlDate } from "smol-toml";
import {
  escapeMarkdownTableCell,
  renderCodeFence,
  renderTableRow,
} from "./markdown-structure.js";
import { isRecord, type RenderedPage, type Warn } from "./types.js";

function renderValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value instanceof TomlDate) return value.toISOString();
  return String(value);
}

export function renderCodexConfig(source: string, filename: string, warn: Warn): RenderedPage {
  let parsed: unknown = {};
  try {
    parsed = parse(source);
  } catch (error) {
    warn(`unable to parse TOML; rendering the source only: ${String(error)}`);
  }
  const record = isRecord(parsed) ? parsed : {};
  const settings = Object.entries(record)
    .filter(([, value]) => !isRecord(value) || value instanceof TomlDate)
    .map(([key, value]) => renderTableRow([key, renderValue(value)]));
  const sections = source.match(/^\s*\[\[?[^\]]+\]\]?/gm) ?? [];
  const sectionList = sections.length === 0
    ? "—"
    : sections.map((section) => `- ${escapeMarkdownTableCell(section.trim())}`).join("\n");
  const body = [
    "## Settings",
    "",
    "| Key | Value |",
    "| --- | --- |",
    ...(settings.length > 0 ? settings : [renderTableRow([undefined, undefined])]),
    "",
    "## Sections",
    "",
    sectionList,
    "",
    "## Source",
    "",
    renderCodeFence(source, "toml"),
  ].join("\n");
  return { title: filename, description: `Codex configuration from ${filename}`, body };
}
