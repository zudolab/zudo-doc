import MiniSearch from "minisearch";
import type { Env, SearchIndexEntry, SearchResult } from "./types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

let cachedPromise: Promise<MiniSearch<SearchIndexEntry>> | null = null;
let cachedUrl: string | null = null;

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

async function fetchSearchIndex(url: string): Promise<SearchIndexEntry[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch search index: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as SearchIndexEntry[];
}

async function buildIndex(url: string): Promise<MiniSearch<SearchIndexEntry>> {
  const entries = await fetchSearchIndex(url);
  const ms = new MiniSearch<SearchIndexEntry>({
    fields: ["title", "body", "description"],
    storeFields: ["title", "url", "description"],
    idField: "id",
  });
  ms.addAll(entries);
  return ms;
}

function getIndex(env: Env): Promise<MiniSearch<SearchIndexEntry>> {
  const url = `${normalizeBaseUrl(env.DOCS_SITE_URL)}/search-index.json`;

  if (cachedPromise && cachedUrl === url) {
    return cachedPromise;
  }

  cachedUrl = url;
  cachedPromise = buildIndex(url).catch((err) => {
    // Reset cache on failure so next request retries
    cachedPromise = null;
    cachedUrl = null;
    throw err;
  });
  return cachedPromise;
}

export function clampLimit(limit: number | undefined): number {
  if (limit === undefined || limit === null) return DEFAULT_LIMIT;
  const n = Math.floor(limit);
  if (Number.isNaN(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

interface StoredFields {
  title: string;
  url: string;
  description: string;
}

export async function search(
  query: string,
  limit: number | undefined,
  env: Env,
): Promise<{ results: SearchResult[]; total: number }> {
  const index = await getIndex(env);
  const clampedLimit = clampLimit(limit);

  const raw = index.search(query, {
    prefix: true,
    fuzzy: 0.2,
    boost: { title: 3, description: 2 },
  });

  const total = raw.length;
  const results: SearchResult[] = raw.slice(0, clampedLimit).map((hit) => {
    const stored = hit as unknown as StoredFields;
    return {
      id: hit.id,
      title: stored.title ?? "",
      url: stored.url ?? "",
      description: stored.description ?? "",
      score: hit.score,
    };
  });

  return { results, total };
}
