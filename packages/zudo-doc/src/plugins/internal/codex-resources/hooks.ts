import fs from "node:fs";
import path from "node:path";
import {
  formatFrontmatterString,
  cleanDir,
  ensureDir,
  getScriptDescription,
  renderCodeFence,
  resolveResourceLabel,
  writeCategoryIndex,
} from "../resource-docs-shared/index.js";
import {
  assertUniqueSlug,
  filenameSlug,
  isRecord,
  languageForFilename,
  renderTableRow,
  warn,
  writeGeneratedPage,
} from "./utils.js";
import type { CodexResourcesConfig } from "./generate.js";

export interface HookItem {
  filename: string;
  slug: string;
}

interface HookRow {
  event: string;
  matcher: unknown;
  type: unknown;
  command: string;
  timeout: unknown;
  async: unknown;
}

function readHookRows(filePath: string, source: string): HookRow[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    warn(filePath, `unable to parse JSON, skipping hooks.json page: ${String(error)}`);
    return null;
  }
  if (!isRecord(parsed) || !isRecord(parsed.hooks)) {
    warn(filePath, "hooks.hooks must be a non-null object; skipping hooks.json page");
    return null;
  }

  const rows: HookRow[] = [];
  for (const [event, groups] of Object.entries(parsed.hooks)) {
    if (!Array.isArray(groups)) {
      warn(filePath, `hooks.${event} must be an array; skipping event`);
      continue;
    }
    for (const [groupIndex, group] of groups.entries()) {
      if (!isRecord(group) || !Array.isArray(group.hooks)) {
        warn(
          filePath,
          `hooks.${event}[${groupIndex}].hooks must be an array; skipping group`,
        );
        continue;
      }
      for (const [handlerIndex, handler] of group.hooks.entries()) {
        if (!isRecord(handler) || typeof handler.command !== "string") {
          warn(
            filePath,
            `hooks.${event}[${groupIndex}].hooks[${handlerIndex}] must be an object with a string command; skipping row`,
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

function generateHooksJson(
  config: CodexResourcesConfig,
  outputDir: string,
  emitted: Map<string, string>,
): HookItem | null {
  const filePath = path.join(config.codexDir, "hooks.json");
  if (!fs.existsSync(filePath)) return null;
  let source: string;
  try {
    source = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    warn(filePath, `unable to read hooks.json, skipping page: ${String(error)}`);
    return null;
  }
  const rows = readHookRows(filePath, source);
  if (rows === null) return null;

  const slug = "hooks-json";
  assertUniqueSlug("hook", slug, "hooks.json", emitted);
  const tableRows = rows.map((row) => renderTableRow([
    row.event,
    row.matcher,
    row.type,
    row.command,
    row.timeout,
    row.async,
  ]));
  const body = [
    "| Event | Matcher | Type | Command | Timeout | Async |",
    "| --- | --- | --- | --- | --- | --- |",
    ...(tableRows.length > 0
      ? tableRows
      : [renderTableRow(Array.from({ length: 6 }))]),
    "",
    "## Source",
    "",
    renderCodeFence(source, "json"),
  ].join("\n");
  writeGeneratedPage({
    outputPath: path.join(outputDir, `${slug}.mdx`),
    title: "hooks.json",
    description: "Codex lifecycle hook configuration",
    sidebarLabel: "hooks.json",
    body,
  });
  return { filename: "hooks.json", slug };
}

function generateHookScripts(
  config: CodexResourcesConfig,
  outputDir: string,
  emitted: Map<string, string>,
): HookItem[] {
  const hooksDir = path.join(config.codexDir, "hooks");
  if (!fs.existsSync(hooksDir)) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(hooksDir, { withFileTypes: true });
  } catch (error) {
    warn(hooksDir, `unable to read hooks directory: ${String(error)}`);
    return [];
  }

  const items: HookItem[] = [];
  for (const entry of entries.filter((item) => item.isFile()).sort((a, b) =>
    a.name.localeCompare(b.name)
  )) {
    const filePath = path.join(hooksDir, entry.name);
    const slug = filenameSlug(entry.name);
    assertUniqueSlug("hook", slug, filePath, emitted);
    let source: string;
    try {
      source = fs.readFileSync(filePath, "utf8");
    } catch (error) {
      warn(filePath, `unable to read hook script, skipping file: ${String(error)}`);
      continue;
    }
    const scriptDescription = getScriptDescription(filePath).replace(/^ — /, "");
    writeGeneratedPage({
      outputPath: path.join(outputDir, `${slug}.mdx`),
      title: entry.name,
      description: scriptDescription,
      sidebarLabel: entry.name,
      body: `## Source\n\n${renderCodeFence(
        source,
        languageForFilename(entry.name),
      )}`,
    });
    items.push({ filename: entry.name, slug });
  }
  return items;
}

export function generateHooksCategory(
  config: CodexResourcesConfig,
): HookItem[] {
  const outputDir = path.join(config.docsDir, "codex-hooks");
  cleanDir(outputDir);
  const hasJson = fs.existsSync(path.join(config.codexDir, "hooks.json"));
  const hasScripts = fs.existsSync(path.join(config.codexDir, "hooks"));
  if (!hasJson && !hasScripts) return [];

  ensureDir(outputDir);
  const emitted = new Map<string, string>();
  const jsonItem = generateHooksJson(config, outputDir, emitted);
  const items = [
    ...(jsonItem ? [jsonItem] : []),
    ...generateHookScripts(config, outputDir, emitted),
  ];
  if (items.length > 0) {
    writeCategoryIndex(
      outputDir,
      resolveResourceLabel({
        translations: config.translations,
        locale: config.defaultLocale ?? "en",
        defaultLocale: config.defaultLocale,
        key: "resource.codexHooks.label",
        fallbackLiteral: "Hooks",
      }),
      908,
      resolveResourceLabel({
        translations: config.translations,
        locale: config.defaultLocale ?? "en",
        defaultLocale: config.defaultLocale,
        key: "resource.codexHooks.description",
        fallbackLiteral: "Lifecycle hooks",
      }),
      formatFrontmatterString,
    );
  }
  return items;
}
