/** Version 1 of the published, read-only agent corpus. */
export interface AgentItem {
  id: string;
  title: string;
  text: string;
  url: string;
  metadata: {
    locale: string;
    pageId: string;
    fingerprint: string;
    part: number;
    partCount: number;
    description?: string;
    section?: string;
    unsupportedDynamicContent?: boolean;
  };
}

export interface AgentManifest {
  schemaVersion: 1;
  fingerprint: string;
  site: { name: string; url: string; base: string };
  defaultLocale: string;
  locales: string[];
  searchIndex: { url: string; sha256: string };
  documents: Array<{
    id: string;
    key: string;
    locale: string;
    title: string;
    url: string;
    markdownUrl: string;
    itemIds: string[];
  }>;
  items: Array<{
    id: string;
    key: string;
    pageId: string;
    url: string;
    artifactUrl: string;
    sha256: string;
    part: number;
    partCount: number;
  }>;
}

export interface AgentSearchIndex {
  schemaVersion: 1;
  fingerprint: string;
  items: AgentItem[];
}

export interface AgentSearchResultItem {
  id: string;
  title: string;
  url: string;
}

export type AgentSearchResult =
  | { ok: true; results: AgentSearchResultItem[] }
  | { ok: false; error: string };
