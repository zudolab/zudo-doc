import { AGENT_MAX_ITEMS, AGENT_MAX_MANIFEST_BYTES, AGENT_MAX_SEARCH_INDEX_BYTES } from "../agent-docs/limits.js";
import { buildAgentSearchIndex, type BuiltAgentSearchIndex } from "../agent-docs/search.js";
import type { AgentItem, AgentManifest, AgentSearchIndex } from "../agent-docs/types.js";

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
      if (size > max) throw new CorpusUnavailable(`Agent corpus artifact exceeds ${max} bytes.`);
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
function parse<T>(text: string, label: string): T {
  try { return JSON.parse(text) as T; }
  catch { throw new CorpusUnavailable(`Invalid agent ${label} JSON.`); }
}
export class AgentCorpusLoader {
  private current?: { fingerprint: string; manifest: AgentManifest; index: BuiltAgentSearchIndex };
  private loading?: Promise<{ fingerprint: string; manifest: AgentManifest; index: BuiltAgentSearchIndex }>;
  private loadingFingerprint?: string;
  constructor(private readonly read: ReadAsset, private readonly base: string) {}

  private async load(manifest: AgentManifest) {
    const root = basePath(this.base);
    const indexPath = safePath(manifest.searchIndex.url, root, manifest.site.url);
    if (indexPath !== `${root}search-index.json`) throw new CorpusUnavailable("Invalid agent search index path.");
    const raw = await readText(this.read, indexPath, AGENT_MAX_SEARCH_INDEX_BYTES);
    if (await sha256(raw) !== manifest.searchIndex.sha256) throw new CorpusUnavailable("Agent search index digest mismatch.");
    const data = parse<AgentSearchIndex>(raw, "search index");
    if (data.schemaVersion !== 1 || data.fingerprint !== manifest.fingerprint || !Array.isArray(data.items) || data.items.length > AGENT_MAX_ITEMS) {
      throw new CorpusUnavailable("Incompatible agent search index.");
    }
    const byId = new Map(manifest.items.map(item => [item.id, item]));
    if (byId.size !== manifest.items.length || byId.size !== data.items.length || data.items.some(item => !byId.has(item.id) || item.metadata?.fingerprint !== manifest.fingerprint)) {
      throw new CorpusUnavailable("Agent search index does not match manifest.");
    }
    const loaded = { fingerprint: manifest.fingerprint, manifest, index: buildAgentSearchIndex(data) };
    this.current = loaded;
    return loaded;
  }

  async corpus() {
    const root = basePath(this.base);
    const raw = await readText(this.read, `${root}manifest.json`, AGENT_MAX_MANIFEST_BYTES);
    const manifest = parse<AgentManifest>(raw, "manifest");
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
        if (this.loadingFingerprint === manifest.fingerprint) return { ...loaded, manifest };
      } catch { /* retry the current manifest */ }
    }
    this.loadingFingerprint = manifest.fingerprint;
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
    const item = parse<AgentItem>(raw, "item");
    if (item.id !== id || item.metadata?.fingerprint !== manifest.fingerprint || item.metadata.pageId !== entry.pageId) throw new CorpusUnavailable("Agent item does not match manifest.");
    return item;
  }
}
