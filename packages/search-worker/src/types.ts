export interface Env {
  DOCS_SITE_URL: string;
  RATE_LIMIT: KVNamespace;
  RATE_LIMIT_PER_MINUTE?: string;
  RATE_LIMIT_PER_DAY?: string;
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

/** Shape of entries in search-index.json (matches SearchIndexEntry from the Astro integration) */
export interface SearchIndexEntry {
  id: string;
  title: string;
  body: string;
  url: string;
  description: string;
}
