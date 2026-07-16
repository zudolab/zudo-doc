import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const START = "# BEGIN AI_CHAT_DAILY_SPEND_CAP_BOOTSTRAP";
const END = "# END AI_CHAT_DAILY_SPEND_CAP_BOOTSTRAP";
const PRODUCTION_NAME = 'name = "zudo-doc"';
const PREVIEW_NAME = 'name = "zudo-doc-preview"';
const PRODUCTION_ENTRY = 'main = "./worker-entry.ts"';
const PREVIEW_ENTRY = 'main = "./worker-preview-entry.ts"';
const PRODUCTION_WORKERS_DEV = "workers_dev = false";
const PREVIEW_WORKERS_DEV = "workers_dev = true";

export function createPreviewWorkerConfig(source) {
  const start = source.indexOf(START);
  const end = source.indexOf(END);

  if (start === -1 || end === -1 || end < start) {
    throw new Error("wrangler.toml is missing the Durable Object bootstrap markers");
  }
  if (source.indexOf(START, start + START.length) !== -1 || source.indexOf(END, end + END.length) !== -1) {
    throw new Error("wrangler.toml contains duplicate Durable Object bootstrap markers");
  }

  const afterEnd = end + END.length;
  const withoutObject = `${source.slice(0, start)}${source.slice(afterEnd).replace(/^\r?\n/, "")}`;

  if (
    !withoutObject.includes(PRODUCTION_NAME) ||
    !withoutObject.includes(PRODUCTION_ENTRY) ||
    !withoutObject.includes(PRODUCTION_WORKERS_DEV)
  ) {
    throw new Error(
      "wrangler.toml is missing the production Worker name, entry, or workers.dev setting",
    );
  }

  return withoutObject
    .replace(PRODUCTION_NAME, PREVIEW_NAME)
    .replace(PRODUCTION_ENTRY, PREVIEW_ENTRY)
    .replace(PRODUCTION_WORKERS_DEV, PREVIEW_WORKERS_DEV);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outputPath = process.argv[2];
  if (!outputPath) {
    throw new Error("usage: node scripts/write-worker-preview-config.mjs <output-path>");
  }

  const root = resolve(import.meta.dirname, "..");
  const source = readFileSync(resolve(root, "wrangler.toml"), "utf8");
  writeFileSync(outputPath, createPreviewWorkerConfig(source));
}
