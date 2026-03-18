import MiniSearch from "minisearch";
import type { Env, SearchIndexEntry, SearchResult } from "./types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

let cachedIndex: MiniSearch<SearchIndexEntry> | null = null;
let cachedUrl: string | null = null;

async function fetchSearchIndex(env: Env): Promise<SearchIndexEntry[]> {
  const url = `${env.DOCS_SITE_URL}/search-index.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch search index: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as SearchIndexEntry[];
}

function buildIndex(entries: SearchIndexEntry[]): MiniSearch<SearchIndexEntry> {
  const ms = new MiniSearch<SearchIndexEntry>({
    fields: ["title", "body", "description"],
    storeFields: ["title", "url", "description"],
    idField: "id",
  });
  ms.addAll(entries);
  return ms;
}

async function getIndex(env: Env): Promise<MiniSearch<SearchIndexEntry>> {
  const url = `${env.DOCS_SITE_URL}/search-index.json`;

  if (cachedIndex && cachedUrl === url) {
    return cachedIndex;
  }

  const entries = await fetchSearchIndex(env);
  cachedIndex = buildIndex(entries);
  cachedUrl = url;
  return cachedIndex;
}

export function clampLimit(limit: number | undefined): number {
  if (limit === undefined || limit === null) return DEFAULT_LIMIT;
  const n = Math.floor(limit);
  if (Number.isNaN(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
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
  const results: SearchResult[] = raw.slice(0, clampedLimit).map((hit) => ({
    id: hit.id,
    title: (hit as unknown as Record<string, string>).title ?? "",
    url: (hit as unknown as Record<string, string>).url ?? "",
    description: (hit as unknown as Record<string, string>).description ?? "",
    score: hit.score,
  }));

  return { results, total };
}
