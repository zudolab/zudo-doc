import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { agentItemKey, agentPageKey } from "../../../agent-docs/identity.js";
import { AGENT_MAX_ITEMS, AGENT_MAX_MANIFEST_BYTES, AGENT_MAX_SEARCH_INDEX_BYTES } from "../../../agent-docs/limits.js";
import type { AgentItem, AgentManifest, AgentSearchIndex } from "../../../agent-docs/types.js";
import { collectMdFiles, isExcluded, parseMarkdownFile, slugToUrl, stripMarkdown } from "../../../md-utils/index.js";
import { chunkAgentText } from "./chunk.js";
import { normalizeAgentMarkdown } from "./normalize.js";

export interface AgentExportOptions {
  outDir?: string;
  base: string;
  siteUrl?: string;
  siteName: string;
  defaultLocale: string;
  defaultLocaleDir: string;
  locales?: Array<{ code: string; dir: string }>;
}

const hash = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");
const json = (value: unknown): string => JSON.stringify(value);
const order = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => order(a, b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
function prefix(base: string): string { return base === "/" ? "" : `/${base.replace(/^\/+|\/+$/g, "")}`; }
function artifactUrl(options: AgentExportOptions, path: string): string {
  const pathname = `${prefix(options.base)}/agent/v1/${path}`;
  return options.siteUrl ? `${options.siteUrl.replace(/\/$/, "")}${pathname}` : pathname;
}

export function projectAgentCorpus(options: AgentExportOptions): { manifest: AgentManifest; index: AgentSearchIndex; pages: Map<string, string>; items: Map<string, string> } {
  const roots = [{ code: options.defaultLocale, dir: options.defaultLocaleDir, default: true }, ...(options.locales ?? []).map(({ code, dir }) => ({ code, dir, default: false }))];
  const seen = new Set<string>();
  const documents = roots.flatMap((root) => collectMdFiles(resolve(root.dir)).flatMap(({ filePath, slug: fileSlug }) => {
    const parsed = parseMarkdownFile(filePath);
    if (!parsed || isExcluded(parsed.data)) return [];
    const slug = parsed.data.slug ?? fileSlug;
    const id = agentPageKey(root.code, slug);
    if (seen.has(id)) throw new Error(`Duplicate agent page ID: ${id}`);
    seen.add(id);
    const url = slugToUrl(slug, root.default ? null : root.code, options.base, options.siteUrl);
    const normalized = normalizeAgentMarkdown(parsed.content, url);
    const title = parsed.data.title ?? slug;
    const description = parsed.data.description ?? stripMarkdown(parsed.content).split("\n").find(Boolean) ?? "";
    const metadata = {
      locale: root.code,
      pageId: id,
      ...(description ? { description } : {}),
      ...(normalized.unsupportedDynamicContent ? { unsupportedDynamicContent: true } : {}),
    };
    return [{
      id,
      key: id,
      locale: root.code,
      slug,
      title,
      description,
      url,
      text: normalized.text,
      unsupportedDynamicContent: normalized.unsupportedDynamicContent,
      parts: chunkAgentText(normalized.text, title, url, metadata),
    }];
  })).sort((a, b) => order(a.locale, b.locale) || order(a.slug, b.slug));
  const site = { name: options.siteName, url: options.siteUrl ?? "", base: options.base };
  const locales = roots.map(({ code }) => code);
  const fingerprint = hash(json(canonical({ schemaVersion: 1, site, defaultLocale: options.defaultLocale, locales, documents })));
  const pages = new Map<string, string>();
  const items = new Map<string, string>();
  const indexed: AgentItem[] = [];
  const manifest: AgentManifest = { schemaVersion: 1, fingerprint, site, defaultLocale: options.defaultLocale, locales, searchIndex: { url: artifactUrl(options, "search-index.json"), sha256: "" }, documents: [], items: [] };
  for (const doc of documents) {
    pages.set(doc.key, doc.text);
    const itemIds: string[] = [];
    doc.parts.forEach((text, index) => {
      const part = index + 1;
      const id = agentItemKey(doc.id, part);
      itemIds.push(id);
      const item: AgentItem = { id, title: doc.parts.length === 1 ? doc.title : `${doc.title} (part ${part}/${doc.parts.length})`, text, url: doc.url, metadata: { locale: doc.locale, pageId: doc.id, fingerprint, part, partCount: doc.parts.length, ...(doc.description ? { description: doc.description } : {}), ...(doc.unsupportedDynamicContent ? { unsupportedDynamicContent: true } : {}) } };
      const bytes = json(item);
      items.set(id, bytes);
      indexed.push(item);
      manifest.items.push({ id, key: id, pageId: doc.id, url: doc.url, artifactUrl: artifactUrl(options, `items/${id}.json`), sha256: hash(bytes), part, partCount: doc.parts.length });
    });
    manifest.documents.push({ id: doc.id, key: doc.key, locale: doc.locale, title: doc.title, url: doc.url, markdownUrl: artifactUrl(options, `pages/${doc.key}.md`), itemIds });
  }
  if (indexed.length > AGENT_MAX_ITEMS) throw new Error("Agent corpus exceeds the item limit.");
  const index: AgentSearchIndex = { schemaVersion: 1, fingerprint, items: indexed };
  const indexBytes = json(index);
  if (Buffer.byteLength(indexBytes) > AGENT_MAX_SEARCH_INDEX_BYTES) throw new Error("Agent search index exceeds the byte limit.");
  manifest.searchIndex.sha256 = hash(indexBytes);
  if (Buffer.byteLength(json(manifest)) > AGENT_MAX_MANIFEST_BYTES) throw new Error("Agent manifest exceeds the byte limit.");
  return { manifest, index, pages, items };
}

/** Replace only the owned agent/v1 subtree, including on exclude/delete rebuilds. */
export function emitAgentCorpus(options: AgentExportOptions & { outDir: string }): string[] {
  const corpus = projectAgentCorpus(options);
  const root = join(options.outDir, prefix(options.base).slice(1), "agent", "v1");
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, "items"), { recursive: true });
  mkdirSync(join(root, "pages"), { recursive: true });
  const written: string[] = [];
  const write = (path: string, body: string): void => { const target = join(root, path); writeFileSync(target, body); written.push(target); };
  write("manifest.json", json(corpus.manifest));
  write("search-index.json", json(corpus.index));
  for (const [key, body] of corpus.items) write(`items/${key}.json`, body);
  for (const [key, body] of corpus.pages) write(`pages/${key}.md`, body);
  return written;
}
