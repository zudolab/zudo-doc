import { AGENT_MAX_ITEMS, AGENT_MAX_QUERY_UNITS, AGENT_MAX_SEARCH_RESULTS } from "./limits.js";
import { tokenizeAgentText } from "./tokenize.js";
import type { AgentSearchIndex, AgentSearchResult, AgentSearchResultItem, AgentItem } from "./types.js";

interface Posting { item: number; weight: number }
export interface BuiltAgentSearchIndex {
  readonly items: readonly AgentItem[];
  readonly postings: ReadonlyMap<string, readonly Posting[]>;
}

const HEADING = /^#{1,6}\s+(.+)$/gm;

/** Build postings from complete item text, including content after UI-search truncation. */
export function buildAgentSearchIndex(source: AgentSearchIndex | readonly AgentItem[]): BuiltAgentSearchIndex {
  const artifact = Array.isArray(source) ? undefined : source as AgentSearchIndex;
  if (artifact && artifact.schemaVersion !== 1) {
    throw new Error("Unsupported agent search index schema version.");
  }
  const items: readonly AgentItem[] = artifact ? artifact.items : source as readonly AgentItem[];
  if (items.length > AGENT_MAX_ITEMS) throw new Error(`Agent search index exceeds ${AGENT_MAX_ITEMS} items.`);
  const postings = new Map<string, Posting[]>();
  items.forEach((item, itemIndex) => {
    const weights = new Map<string, number>();
    const add = (text: string, weight: number) => {
      for (const token of tokenizeAgentText(text)) {
        weights.set(token, (weights.get(token) ?? 0) + weight);
      }
    };
    add(item.text, 1);
    add(item.title, 12);
    if (item.metadata.description) add(item.metadata.description, 5);
    if (item.metadata.section) add(item.metadata.section, 7);
    for (const match of item.text.matchAll(HEADING)) add(match[1]!, 6);
    for (const [token, weight] of weights) {
      const list = postings.get(token);
      if (list) list.push({ item: itemIndex, weight });
      else postings.set(token, [{ item: itemIndex, weight }]);
    }
  });
  return { items, postings };
}

function displayTitle(item: AgentItem, duplicateTitle: boolean, duplicateQualifier: boolean): string {
  const { locale, section, part, partCount } = item.metadata;
  const qualifiers = [locale];
  if (section && section !== item.title) qualifiers.push(section);
  if (partCount > 1) qualifiers.push(`part ${part}/${partCount}`);
  if (duplicateQualifier) qualifiers.push(item.id);
  return duplicateTitle || qualifiers.length > 1 ? `${item.title} (${qualifiers.join(" · ")})` : item.title;
}

/** Returns a validation result for bad queries and [] for valid queries with no matches. */
export function searchAgentIndex(
  index: BuiltAgentSearchIndex,
  query: string,
  topK = AGENT_MAX_SEARCH_RESULTS,
): AgentSearchResult {
  if (query.length > AGENT_MAX_QUERY_UNITS) {
    return { ok: false, error: `Query exceeds ${AGENT_MAX_QUERY_UNITS} UTF-16 code units.` };
  }
  if (!query.trim()) return { ok: false, error: "Query must not be empty." };
  const tokens = tokenizeAgentText(query);
  if (tokens.length === 0) return { ok: false, error: "Query has no searchable terms." };
  const scores = new Map<number, number>();
  for (const token of tokens) {
    const list = index.postings.get(token);
    if (!list) continue;
    const idf = 1 + Math.log((index.items.length + 1) / (list.length + 1));
    const specificity = Array.from(token).length === 1 ? 0.25 : 1;
    for (const { item, weight } of list) {
      scores.set(item, (scores.get(item) ?? 0) + weight * idf * specificity);
    }
  }
  const boundedK = Number.isFinite(topK)
    ? Math.max(0, Math.min(AGENT_MAX_SEARCH_RESULTS, Math.floor(topK)))
    : AGENT_MAX_SEARCH_RESULTS;
  const ranked = [...scores.keys()].sort((a, b) => {
    const difference = scores.get(b)! - scores.get(a)!;
    if (difference) return difference;
    const first = index.items[a]!.id;
    const second = index.items[b]!.id;
    return first < second ? -1 : first > second ? 1 : 0;
  }).slice(0, boundedK);
  const titleCounts = new Map<string, number>();
  for (const item of index.items) titleCounts.set(item.title, (titleCounts.get(item.title) ?? 0) + 1);
  const qualifiedCounts = new Map<string, number>();
  for (const item of index.items) {
    const title = displayTitle(item, (titleCounts.get(item.title) ?? 0) > 1, false);
    qualifiedCounts.set(title, (qualifiedCounts.get(title) ?? 0) + 1);
  }
  const results: AgentSearchResultItem[] = ranked.map((i) => {
    const item = index.items[i]!;
    const title = displayTitle(item, (titleCounts.get(item.title) ?? 0) > 1, false);
    return { id: item.id, title: displayTitle(item, (titleCounts.get(item.title) ?? 0) > 1, (qualifiedCounts.get(title) ?? 0) > 1), url: item.url };
  });
  return { ok: true, results };
}
