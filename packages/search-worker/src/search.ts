import MiniSearch from "minisearch";
import type { Env, SearchIndexEntry, SearchResult } from "./types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Cache TTL: 5 minutes (in ms) */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Negative-cache window after a fetch failure (in ms).
 * During this window concurrent requests coalesce onto the same rejected
 * promise instead of each launching its own 5-second fetch against a
 * DOCS_SITE_URL that is known to be down. After this window expires the
 * next request is allowed to retry once. 30 seconds is short enough to
 * recover quickly from transient blips while preventing a thundering-herd
 * during a longer outage.
 */
const NEGATIVE_CACHE_TTL_MS = 30 * 1000;

/** Fetch timeout: abort if the docs site doesn't respond within 5 seconds */
const FETCH_TIMEOUT_MS = 5_000;

/**
 * Maximum number of entries accepted from search-index.json.
 * A response far beyond a plausible doc corpus is likely corrupt or malicious;
 * reject early rather than feeding unbounded data into MiniSearch.addAll.
 */
const MAX_INDEX_ENTRIES = 100_000;

let cachedPromise: Promise<MiniSearch<SearchIndexEntry>> | null = null;
let cachedUrl: string | null = null;
let cachedAt = 0;
/** Timestamp of the most recent fetch failure; 0 when no failure is recorded. */
let failedAt = 0;

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
  // AbortSignal.timeout aborts the fetch if the docs site is unresponsive,
  // preventing one slow load from hanging all coalesced callers indefinitely.
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`Failed to fetch search index: ${res.status} ${res.statusText}`);
  }
  const parsed: unknown = await res.json();
  if (!Array.isArray(parsed)) {
    throw new Error("Search index is not an array");
  }
  // Sanity cap: reject implausibly large indexes before feeding them to
  // MiniSearch.addAll. Throwing here causes the cache to reset (see getIndex
  // .catch handler), so the next request retries a fresh fetch.
  if (parsed.length > MAX_INDEX_ENTRIES) {
    throw new Error(
      `Search index has ${parsed.length} entries, exceeding the ${MAX_INDEX_ENTRIES} cap`,
    );
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

  // Positive-cache hit: index loaded successfully and TTL has not expired.
  if (cachedPromise && cachedUrl === url && cachedAt > 0 && now - cachedAt < CACHE_TTL_MS) {
    return cachedPromise;
  }

  // Negative-cache hit: the previous fetch failed within the backoff window.
  // Return the still-pending (rejected) promise so all concurrent callers
  // receive the same error instead of each spawning a new 5-second timeout
  // fetch against a DOCS_SITE_URL that is known to be unavailable.
  if (cachedPromise && cachedUrl === url && failedAt > 0 && now - failedAt < NEGATIVE_CACHE_TTL_MS) {
    return cachedPromise;
  }

  cachedUrl = url;
  failedAt = 0;
  // cachedAt is set in .then() (after the index builds successfully) rather
  // than here. Setting it before the fetch resolves burns TTL during a slow
  // load: a 4-second fetch on a 5-minute TTL would serve a stale index for
  // only ~4m56s before the next refresh. By stamping the clock only on
  // success, the full TTL window starts when the index is actually ready.
  cachedPromise = buildIndex(url)
    .then((ms) => {
      cachedAt = Date.now();
      failedAt = 0;
      return ms;
    })
    .catch((err) => {
      // Record the failure timestamp so subsequent requests within
      // NEGATIVE_CACHE_TTL_MS coalesce onto this rejected promise
      // rather than each launching an independent fetch. After the
      // backoff window expires the next request clears failedAt and
      // retries. cachedAt stays 0 so the positive-cache branch never
      // fires for a failed build.
      cachedAt = 0;
      failedAt = Date.now();
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
