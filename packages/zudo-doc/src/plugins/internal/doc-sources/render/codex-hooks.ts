// Codex lifecycle hook configuration (`hooks.json`) renderer. Hook scripts
// themselves render through the generic inert `code` format.

import { renderCodeFence, renderTableRow } from "./markdown-structure.js";
import { isRecord, type RenderedPage, type Warn } from "./types.js";

interface HookRow {
  event: string;
  matcher: unknown;
  type: unknown;
  command: string;
  timeout: unknown;
  async: unknown;
}

function readHookRows(source: string, warn: Warn): HookRow[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    warn(`unable to parse JSON, rendering the source only: ${String(error)}`);
    return null;
  }
  if (!isRecord(parsed) || !isRecord(parsed.hooks)) {
    warn("hooks.hooks must be a non-null object; rendering the source only");
    return null;
  }

  const rows: HookRow[] = [];
  for (const [event, groups] of Object.entries(parsed.hooks)) {
    if (!Array.isArray(groups)) {
      warn(`hooks.${event} must be an array; skipping event`);
      continue;
    }
    for (const [groupIndex, group] of groups.entries()) {
      if (!isRecord(group) || !Array.isArray(group.hooks)) {
        warn(`hooks.${event}[${groupIndex}].hooks must be an array; skipping group`,
        );
        continue;
      }
      for (const [handlerIndex, handler] of group.hooks.entries()) {
        if (!isRecord(handler) || typeof handler.command !== "string") {
          warn(`hooks.${event}[${groupIndex}].hooks[${handlerIndex}] must be an object with a string command; skipping row`,
          );
          continue;
        }
        rows.push({
          event,
          matcher: group.matcher,
          type: handler.type,
          command: handler.command,
          timeout: handler.timeout,
          async: handler.async,
        });
      }
    }
  }
  return rows;
}

export function renderCodexHooks(source: string, filename: string, warn: Warn): RenderedPage {
  const rows = readHookRows(source, warn) ?? [];
  const tableRows = rows.map((row) =>
    renderTableRow([row.event, row.matcher, row.type, row.command, row.timeout, row.async])
  );
  const body = [
    "| Event | Matcher | Type | Command | Timeout | Async |",
    "| --- | --- | --- | --- | --- | --- |",
    ...(tableRows.length > 0 ? tableRows : [renderTableRow(Array.from({ length: 6 }))]),
    "",
    "## Source",
    "",
    renderCodeFence(source, "json"),
  ].join("\n");
  return { title: filename, description: "Codex lifecycle hook configuration", body };
}
