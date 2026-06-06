import MiniSearch from "minisearch";
import type { Env, SearchIndexEntry, SearchResult } from "./types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Cache TTL: 5 minutes (in ms) */
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedPromise: Promise<MiniSearch<SearchIndexEntry>> | null = null;
let cachedUrl: string | null = null;
let cachedAt = 0;

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

/** Runtime guard: verifies each raw entry has the required string fields. */
function isSearchIndexEntry(entry: unknown): entry is SearchIndexEntry {
  if (typeof entry !== "object" || entry === null) return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.title === "string" &&
    typeof e.body === "string" &&
    typeof e.url === "string" &&
    typeof e.description === "string"
  );
}

async function fetchSearchIndex(url: string): Promise<SearchIndexEntry[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch search index: ${res.status} ${res.statusText}`);
  }
  const parsed: unknown = await res.json();
  if (!Array.isArray(parsed)) {
    throw new Error("Search index is not an array");
  }
  // Validate each entry's shape rather than blindly casting the fetched data.
  const entries: SearchIndexEntry[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const entry = parsed[i];
    if (!isSearchIndexEntry(entry)) {
      throw new Error(`Search index entry at index ${i} has unexpected shape`);
    }
    entries.push(entry);
  }
  return entries;
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
  const now = Date.now();

  if (cachedPromise && cachedUrl === url && now - cachedAt < CACHE_TTL_MS) {
    return cachedPromise;
  }

  cachedUrl = url;
  cachedAt = now;
  cachedPromise = buildIndex(url).catch((err) => {
    // Reset cache on failure so next request retries
    cachedPromise = null;
    cachedUrl = null;
    cachedAt = 0;
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
