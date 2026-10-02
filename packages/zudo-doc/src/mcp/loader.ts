import { AGENT_MAX_ITEMS, AGENT_MAX_MANIFEST_BYTES, AGENT_MAX_SEARCH_INDEX_BYTES } from "../agent-docs/limits.js";
import { buildAgentSearchIndex, type BuiltAgentSearchIndex } from "../agent-docs/search.js";
import type { AgentItem, AgentManifest, AgentSearchIndex } from "../agent-docs/types.js";
import { z } from "zod";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const pageId = z.string().regex(/^p-[a-f0-9]{16}$/);
const itemId = z.string().regex(/^p-[a-f0-9]{16}-[0-9]{6}$/);
const part = z.number().int().positive();
const itemSchema = z.object({
  id: itemId, title: z.string(), text: z.string(), url: z.string(),
  metadata: z.object({
    locale: z.string(), pageId, fingerprint: digest, part, partCount: part,
    description: z.string().optional(), section: z.string().optional(),
    unsupportedDynamicContent: z.boolean().optional(),
  }),
});
const manifestSchema = z.object({
  schemaVersion: z.literal(1), fingerprint: digest,
  site: z.object({ name: z.string(), url: z.string(), base: z.string() }),
  defaultLocale: z.string(), locales: z.array(z.string()),
  searchIndex: z.object({ url: z.string(), sha256: digest }),
  documents: z.array(z.object({
    id: pageId, key: pageId, locale: z.string(), title: z.string(), url: z.string(),
    markdownUrl: z.string(), itemIds: z.array(itemId),
  })),
  items: z.array(z.object({
    id: itemId, key: itemId, pageId, url: z.string(), artifactUrl: z.string(),
    sha256: digest, part, partCount: part,
  })).max(AGENT_MAX_ITEMS),
});
const indexSchema = z.object({
  schemaVersion: z.literal(1), fingerprint: digest,
  items: z.array(itemSchema).max(AGENT_MAX_ITEMS),
});

export type ReadAsset = (path: string) => Promise<Response>;

export class CorpusUnavailable extends Error {}

const encoder = new TextEncoder();
async function sha256(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}
function basePath(base: string): string {
  return `/${base.split("/").filter(Boolean).join("/")}/agent/v1/`.replace(/^\/\//, "/");
}
function safePath(url: string, root: string, siteUrl: string): string {
  let path = url;
  if (/^https?:\/\//.test(url)) {
    let parsed: URL;
    try { parsed = new URL(url); }
    catch { throw new CorpusUnavailable("Invalid agent corpus artifact URL."); }
    if (!siteUrl || parsed.origin !== new URL(siteUrl).origin || parsed.search || parsed.hash) throw new CorpusUnavailable("Invalid agent corpus artifact origin.");
    path = parsed.pathname;
  }
  if (!path.startsWith(root) || path.includes("?") || path.includes("#") || path.includes("..") || path.includes("%")) {
    throw new CorpusUnavailable("Invalid agent corpus artifact path.");
  }
  return path;
}
async function readText(read: ReadAsset, path: string, max: number): Promise<string> {
  let response: Response;
  try { response = await read(path); }
  catch { throw new CorpusUnavailable(`Cannot read agent corpus artifact: ${path}`); }
  if (!response.ok || !response.body) throw new CorpusUnavailable(`Missing agent corpus artifact: ${path}`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new CorpusUnavailable(`Agent corpus artifact exceeds ${max} bytes.`);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof CorpusUnavailable) throw error;
    throw new CorpusUnavailable(`Cannot read agent corpus artifact: ${path}`);
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new CorpusUnavailable(`Invalid UTF-8 in agent corpus artifact: ${path}`); }
}
function parse<T>(text: string, label: string, schema: z.ZodType<T>): T {
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { throw new CorpusUnavailable(`Invalid agent ${label} JSON.`); }
  const result = schema.safeParse(value);
  if (!result.success) throw new CorpusUnavailable(`Incompatible agent ${label}.`);
  return result.data;
}
export class AgentCorpusLoader {
  private current?: { fingerprint: string; manifest: AgentManifest; index: BuiltAgentSearchIndex };
  private loading?: Promise<{ fingerprint: string; manifest: AgentManifest; index: BuiltAgentSearchIndex }>;
  constructor(private readonly read: ReadAsset, private readonly base: string) {}

  private async load(manifest: AgentManifest) {
    const root = basePath(this.base);
    const indexPath = safePath(manifest.searchIndex.url, root, manifest.site.url);
    if (indexPath !== `${root}search-index.json`) throw new CorpusUnavailable("Invalid agent search index path.");
    const raw = await readText(this.read, indexPath, AGENT_MAX_SEARCH_INDEX_BYTES);
    if (await sha256(raw) !== manifest.searchIndex.sha256) throw new CorpusUnavailable("Agent search index digest mismatch.");
    const data = parse<AgentSearchIndex>(raw, "search index", indexSchema);
    if (data.schemaVersion !== 1 || data.fingerprint !== manifest.fingerprint || !Array.isArray(data.items) || data.items.length > AGENT_MAX_ITEMS) {
      throw new CorpusUnavailable("Incompatible agent search index.");
    }
    const byId = new Map(manifest.items.map(item => [item.id, item]));
    if (byId.size !== manifest.items.length || byId.size !== data.items.length || new Set(data.items.map(item => item.id)).size !== data.items.length || data.items.some(item => !byId.has(item.id) || item.metadata?.fingerprint !== manifest.fingerprint)) {
      throw new CorpusUnavailable("Agent search index does not match manifest.");
    }
    const loaded = { fingerprint: manifest.fingerprint, manifest, index: buildAgentSearchIndex(data) };
    this.current = loaded;
    return loaded;
  }

  async corpus() {
    const root = basePath(this.base);
    const raw = await readText(this.read, `${root}manifest.json`, AGENT_MAX_MANIFEST_BYTES);
    const manifest = parse<AgentManifest>(raw, "manifest", manifestSchema);
    if (manifest.schemaVersion !== 1 || !/^[a-f0-9]{64}$/.test(manifest.fingerprint) || !Array.isArray(manifest.items) || manifest.items.length > AGENT_MAX_ITEMS || !manifest.searchIndex?.sha256) {
      throw new CorpusUnavailable("Incompatible agent manifest.");
    }
    if (this.current?.fingerprint === manifest.fingerprint && this.current.manifest.searchIndex.sha256 === manifest.searchIndex.sha256) {
      // The latest manifest is authoritative for removals, even while the index stays warm.
      this.current = { ...this.current, manifest };
      return this.current;
    }
    this.current = undefined;
    if (this.loading) {
      try {
        const loaded = await this.loading;
        if (loaded.fingerprint === manifest.fingerprint && loaded.manifest.searchIndex.sha256 === manifest.searchIndex.sha256) return { ...loaded, manifest };
      } catch { /* retry the current manifest */ }
    }
    this.loading = this.load(manifest).finally(() => { this.loading = undefined; });
    return this.loading;
  }

  async item(id: string): Promise<AgentItem | undefined> {
    const { manifest } = await this.corpus();
    const entry = manifest.items.find(item => item.id === id);
    if (!entry) return undefined;
    const root = basePath(this.base);
    const path = safePath(entry.artifactUrl, `${root}items/`, manifest.site.url);
    if (path !== `${root}items/${entry.key}.json` || !/^p-[a-f0-9]{16}-[0-9]{6}$/.test(entry.key)) throw new CorpusUnavailable("Invalid agent item path.");
    const raw = await readText(this.read, path, 256 * 1024);
    if (await sha256(raw) !== entry.sha256) throw new CorpusUnavailable("Agent item digest mismatch.");
    const item = parse<AgentItem>(raw, "item", itemSchema);
    if (item.id !== id || item.metadata?.fingerprint !== manifest.fingerprint || item.metadata.pageId !== entry.pageId) throw new CorpusUnavailable("Agent item does not match manifest.");
    return item;
  }
}
