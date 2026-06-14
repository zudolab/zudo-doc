export interface Env {
  DOCS_SITE_URL: string;
  RATE_LIMIT: KVNamespace;
  RATE_LIMIT_PER_MINUTE?: string;
  RATE_LIMIT_PER_DAY?: string;
  // Optional HMAC key for IP hashing (#2038). When set, rate-limit KV keys
  // derive from HMAC-SHA-256(ip) instead of unsalted SHA-256(ip).
  IP_HASH_SECRET?: string;
}

export interface SearchRequest {
  query: string;
  limit?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  description: string;
  score: number;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  total: number;
}

export interface SearchErrorResponse {
  error: string;
}

/** Shape of entries in search-index.json (matches SearchIndexEntry from the zfb search-index integration) */
export interface SearchIndexEntry {
  id: string;
  title: string;
  body: string;
  url: string;
  description: string;
}
