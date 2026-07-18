import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const START = "# BEGIN AI_CHAT_DAILY_SPEND_CAP_BOOTSTRAP";
const END = "# END AI_CHAT_DAILY_SPEND_CAP_BOOTSTRAP";
const ROUTE_START = "# BEGIN PRODUCTION_CUSTOM_DOMAIN";
const ROUTE_END = "# END PRODUCTION_CUSTOM_DOMAIN";
const KV_START = "# BEGIN PRODUCTION_RATE_LIMIT_KV";
const KV_END = "# END PRODUCTION_RATE_LIMIT_KV";
const PRODUCTION_NAME = 'name = "zudo-doc"';
const PREVIEW_NAME = 'name = "zudo-doc-preview"';
const PRODUCTION_ENTRY = 'main = "./worker-entry.ts"';
const PREVIEW_ENTRY = 'main = "./worker-preview-entry.ts"';

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
  const routeStart = withoutObject.indexOf(ROUTE_START);
  const routeEnd = withoutObject.indexOf(ROUTE_END);
  if (routeStart === -1 || routeEnd === -1 || routeEnd < routeStart) {
    throw new Error("wrangler.toml is missing the production custom-domain markers");
  }
  if (
    withoutObject.indexOf(ROUTE_START, routeStart + ROUTE_START.length) !== -1 ||
    withoutObject.indexOf(ROUTE_END, routeEnd + ROUTE_END.length) !== -1
  ) {
    throw new Error("wrangler.toml contains duplicate production custom-domain markers");
  }

  const afterRouteEnd = routeEnd + ROUTE_END.length;
  const withoutProductionRoute = `${withoutObject.slice(0, routeStart)}${withoutObject
    .slice(afterRouteEnd)
    .replace(/^\r?\n/, "")}`;
  const kvStart = withoutProductionRoute.indexOf(KV_START);
  const kvEnd = withoutProductionRoute.indexOf(KV_END);
  if (kvStart === -1 || kvEnd === -1 || kvEnd < kvStart) {
    throw new Error("wrangler.toml is missing the production rate-limit KV markers");
  }
  if (
    withoutProductionRoute.indexOf(KV_START, kvStart + KV_START.length) !== -1 ||
    withoutProductionRoute.indexOf(KV_END, kvEnd + KV_END.length) !== -1
  ) {
    throw new Error("wrangler.toml contains duplicate production rate-limit KV markers");
  }

  const afterKvEnd = kvEnd + KV_END.length;
  const withoutProductionKv = `${withoutProductionRoute.slice(0, kvStart)}${withoutProductionRoute
    .slice(afterKvEnd)
    .replace(/^\r?\n/, "")}`;

  if (
    !withoutProductionKv.includes(PRODUCTION_NAME) ||
    !withoutProductionKv.includes(PRODUCTION_ENTRY)
  ) {
    throw new Error("wrangler.toml is missing the production Worker name or entry");
  }

  return withoutProductionKv
    .replace(PRODUCTION_NAME, PREVIEW_NAME)
    .replace(PRODUCTION_ENTRY, PREVIEW_ENTRY);
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
