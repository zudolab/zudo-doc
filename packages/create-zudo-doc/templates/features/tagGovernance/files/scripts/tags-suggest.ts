#!/usr/bin/env tsx
/**
 * tags:suggest — optional local-LLM tag suggester.
 *
 * Reads one or more doc files, asks a local Ollama instance for up to 3 tag
 * ids from the project vocabulary, and either opens an interactive approval
 * prompt (default) or appends suggestions to `.tag-suggestions.jsonl`
 * (`--batch`, also used automatically when stdout is not a TTY).
 *
 * Entirely developer-opt-in. Never runs in CI; never wired into b4push.
 */
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import matter from "gray-matter";

import { tagVocabulary } from "../src/config/tag-vocabulary";
import type { TagVocabularyEntry } from "../src/config/tag-vocabulary-types";

const DEFAULT_HOST = "http://localhost:11434";
const DEFAULT_MODEL = "qwen2.5:7b";
const BODY_CHAR_LIMIT = 1500;
const REQUEST_TIMEOUT_MS = 60_000;
const BATCH_FILE = ".tag-suggestions.jsonl";

interface Args {
  files: string[];
  host: string;
  model: string;
  batch: boolean;
  help: boolean;
}

interface Suggestion {
  file: string;
  current: string[];
  suggested: string[];
}

function printHelp(): void {
  process.stdout.write(`Usage: pnpm tags:suggest [options] <file...>

Ask a local Ollama LLM to suggest up to 3 tag ids from the project
vocabulary for each doc file. Opt-in developer tool — never runs in CI.

Options:
  --host <url>   Ollama endpoint (default: ${DEFAULT_HOST})
  --model <id>   Ollama model id (default: ${DEFAULT_MODEL})
  --batch        Append suggestions to ${BATCH_FILE} instead of prompting.
                 Auto-enabled when stdout is not a TTY.
  --help         Show this help.

Ollama setup:
  1. Install from https://ollama.com/
  2. Pull a model: \`ollama pull ${DEFAULT_MODEL}\`
  3. Ensure the daemon is running at ${DEFAULT_HOST}

Model trade-offs:
  - \`qwen2.5:7b\` (default) — balanced quality/speed; ~5 GB download.
  - \`llama3.1:8b\`          — similar size, stronger English reasoning.
  - \`qwen2.5:3b\` / \`llama3.2:3b\` — smaller/faster, noisier output.
  Pass \`--model\` to override.

Exit codes:
  0  success
  1  usage error
  2  Ollama unreachable or returned unusable output
`);
}

function parseCliArgs(argv: string[]): Args {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        host: { type: "string", default: DEFAULT_HOST },
        model: { type: "string", default: DEFAULT_MODEL },
        batch: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`tags:suggest: ${msg}\n`);
    process.exit(1);
  }
  return {
    files: parsed.positionals,
    host: String(parsed.values.host ?? DEFAULT_HOST),
    model: String(parsed.values.model ?? DEFAULT_MODEL),
    batch: Boolean(parsed.values.batch),
    help: Boolean(parsed.values.help),
  };
}

function activeVocabulary(): TagVocabularyEntry[] {
  return tagVocabulary.filter((entry) => {
    const d = entry.deprecated;
    // Exclude fully-retired tags. Redirect-style deprecation still points
    // at a live canonical id, which the model may surface if relevant.
    if (d === true) return false;
    if (typeof d === "object" && d !== null && !("redirect" in d)) return false;
    return true;
  });
}

function buildPrompt(
  entries: TagVocabularyEntry[],
  title: string,
  body: string,
): string {
  const vocabLines = entries
    .map((e) => {
      const label = e.label ?? e.id;
      const desc = e.description ?? "";
      const group = e.group ? ` [${e.group}]` : "";
      return `- ${e.id}${group} — ${label}: ${desc}`.trim();
    })
    .join("\n");
  const snippet = body.slice(0, BODY_CHAR_LIMIT);
  return `You are tagging a documentation page.

Vocabulary (pick ONLY from these ids):
${vocabLines}

Document title: ${title}

Document excerpt:
"""
${snippet}
"""

Return a JSON array of AT MOST 3 tag ids that best fit this page. The
array must contain only strings that exactly match ids from the
vocabulary above. Respond with the JSON array and nothing else.`;
}

interface OllamaGenerateResponse {
  response?: string;
  error?: string;
}

async function callOllama(
  host: string,
  model: string,
  prompt: string,
): Promise<string> {
  const url = `${host.replace(/\/$/, "")}/api/generate`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: "json",
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error)?.name === "AbortError") {
      throw new OllamaError(
        `Ollama request timed out after ${REQUEST_TIMEOUT_MS / 1000}s at ${host}. Is \`ollama serve\` running?`,
      );
    }
    // Any other fetch rejection (ECONNREFUSED, UND_ERR_CONNECT_TIMEOUT,
    // DNS failure, bad port, …) means we could not talk to Ollama. Collapse
    // them into one actionable message — the full stack isn't useful to
    // the doc author running this CLI.
    throw new OllamaUnreachableError(host, model);
  }
  clearTimeout(timer);

  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as OllamaGenerateResponse;
      if (body?.error) detail = ` — ${body.error}`;
    } catch {
      // ignore; keep status line only
    }
    if (res.status === 404) {
      throw new OllamaError(
        `Ollama responded 404 at ${host}. Pull the model first: \`ollama pull ${model}\`.${detail}`,
      );
    }
    throw new OllamaError(
      `Ollama responded HTTP ${res.status} at ${host}.${detail}`,
    );
  }

  let json: OllamaGenerateResponse;
  try {
    json = (await res.json()) as OllamaGenerateResponse;
  } catch {
    throw new OllamaError(`Ollama returned non-JSON response at ${host}.`);
  }
  if (typeof json.response !== "string") {
    throw new OllamaError(`Ollama response missing 'response' field.`);
  }
  return json.response;
}

class OllamaError extends Error {
  readonly friendly = true;
}
class OllamaUnreachableError extends OllamaError {
  constructor(host: string, model: string) {
    super(
      `Ollama not reachable at ${host}. Install from https://ollama.com/ and run \`ollama pull ${model}\`.`,
    );
  }
}

function parseSuggestions(
  raw: string,
  allowedIds: Set<string>,
): string[] {
  const trimmed = raw.trim();
  // Accept either a bare JSON array or a JSON object that wraps one.
  // Some models return `{"tags": [...]}` even when asked for an array.
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // Last-ditch: try to extract the first JSON array substring.
    const match = trimmed.match(/\[[\s\S]*\]/);
    if (!match) {
      throw new OllamaError(
        `Model output was not valid JSON. Raw: ${trimmed.slice(0, 200)}`,
      );
    }
    parsed = JSON.parse(match[0]);
  }
  let arr: unknown[];
  if (Array.isArray(parsed)) {
    arr = parsed;
  } else if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as { tags?: unknown }).tags)
  ) {
    arr = (parsed as { tags: unknown[] }).tags;
  } else {
    throw new OllamaError(`Model output is not a JSON array.`);
  }
  const ids = arr
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && allowedIds.has(v));
  // Dedupe, cap at 3.
  return Array.from(new Set(ids)).slice(0, 3);
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

async function writeFrontmatterTags(
  filePath: string,
  parsed: matter.GrayMatterFile<string>,
  nextTags: string[],
): Promise<void> {
  const data = { ...parsed.data, tags: nextTags };
  const rebuilt = matter.stringify(parsed.content, data);
  await writeFile(filePath, rebuilt, "utf-8");
}

async function appendBatch(
  repoRoot: string,
  entry: Suggestion,
): Promise<void> {
  const outPath = resolve(repoRoot, BATCH_FILE);
  await appendFile(outPath, JSON.stringify(entry) + "\n", "utf-8");
}

class UsageError extends Error {}

function resolveFiles(repoRoot: string, inputs: string[]): string[] {
  const out: string[] = [];
  for (const raw of inputs) {
    const abs = isAbsolute(raw) ? raw : resolve(repoRoot, raw);
    if (!existsSync(abs)) {
      throw new UsageError(`file not found: ${raw}`);
    }
    out.push(abs);
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (args.files.length === 0) {
    process.stderr.write(
      "tags:suggest: no input files. Pass one or more `.mdx` paths, or run with --help.\n",
    );
    process.exit(1);
  }

  const repoRoot = process.cwd();
  const files = resolveFiles(repoRoot, args.files);
  const vocab = activeVocabulary();
  const allowedIds = new Set(vocab.map((e) => e.id));

  const isTty = Boolean(process.stdout.isTTY);
  const batchMode = args.batch || !isTty;

  // Dynamic import so the script's `--help` and arg parsing work even if
  // `@inquirer/prompts` is momentarily unavailable in an odd environment.
  type CheckboxFn = <V extends string>(config: {
    message: string;
    choices: { name: string; value: V; checked?: boolean }[];
    loop?: boolean;
  }) => Promise<V[]>;
  let checkbox: CheckboxFn | null = null;
  if (!batchMode) {
    const mod = (await import("@inquirer/prompts")) as {
      checkbox: CheckboxFn;
    };
    checkbox = mod.checkbox;
  }

  for (const filePath of files) {
    const rel = relative(repoRoot, filePath);
    const source = await readFile(filePath, "utf-8");
    const parsed = matter(source);
    const title =
      typeof parsed.data.title === "string" ? parsed.data.title : rel;
    const current = asStringArray(parsed.data.tags);

    let suggested: string[];
    try {
      const prompt = buildPrompt(vocab, title, parsed.content);
      const raw = await callOllama(args.host, args.model, prompt);
      suggested = parseSuggestions(raw, allowedIds);
    } catch (err) {
      if (err instanceof OllamaError) {
        process.stderr.write(`tags:suggest: ${err.message}\n`);
        process.exit(2);
      }
      throw err;
    }

    if (suggested.length === 0) {
      process.stdout.write(`${rel}: no vocabulary-matching suggestions\n`);
      continue;
    }

    if (batchMode) {
      await appendBatch(repoRoot, {
        file: rel,
        current,
        suggested,
      });
      process.stdout.write(
        `${rel}: recorded ${suggested.length} suggestion(s) to ${BATCH_FILE}\n`,
      );
      continue;
    }

    // Interactive approval: pre-check suggestions, show current tags for context.
    const combined = Array.from(new Set([...current, ...suggested]));
    const choices = combined.map((id) => {
      const inSuggestion = suggested.includes(id);
      const inCurrent = current.includes(id);
      const label =
        inSuggestion && inCurrent
          ? `${id} (current, also suggested)`
          : inSuggestion
            ? `${id} (suggested)`
            : `${id} (current)`;
      return {
        name: label,
        value: id,
        checked: inSuggestion || inCurrent,
      };
    });
    if (!checkbox) {
      // Should not happen — we set it above when !batchMode.
      throw new Error("interactive prompt loader missing");
    }
    const picked = await checkbox<string>({
      message: `${rel} — pick tags to write:`,
      choices,
      loop: false,
    });
    const nextTags = picked.slice();
    if (
      nextTags.length === current.length &&
      nextTags.every((t, i) => t === current[i])
    ) {
      process.stdout.write(`${rel}: unchanged\n`);
      continue;
    }
    await writeFrontmatterTags(filePath, parsed, nextTags);
    process.stdout.write(
      `${rel}: wrote tags [${nextTags.join(", ")}]\n`,
    );
  }
}

main().catch((err) => {
  if (err instanceof OllamaError) {
    process.stderr.write(`tags:suggest: ${err.message}\n`);
    process.exit(2);
  }
  if (err instanceof UsageError) {
    process.stderr.write(`tags:suggest: ${err.message}\n`);
    process.exit(1);
  }
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`tags:suggest: ${msg}\n`);
  process.exit(1);
});
