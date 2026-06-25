// tag-helpers — parameterized tag resolution functions (epic #2344, S7).
//
// The host's `src/utils/tags.ts` previously read `settings.tagVocabulary` and
// `settings.tagGovernance` at module scope and imported `tagVocabulary` from
// `@/config/tag-vocabulary`. This module provides pure, parameterized versions
// of `resolveTag` and `resolvePageTags` that receive the vocabulary and
// governance mode as arguments, so the logic lives in the package while the
// host stub keeps the singleton imports.
//
// The host's `collectTags` function depends on `DocsEntry` from the host's
// content collections — it stays in `src/utils/tags.ts` and calls the
// parameterized `resolveTag` from here.
//
// Pure functions — no node builtins, no host alias imports.

import type { TagVocabularyEntry, TagGovernanceMode } from "../settings.js";

export type { TagVocabularyEntry, TagGovernanceMode };

/** Result of resolving a raw tag string. */
export interface ResolvedTag {
  /** Canonical id after alias/redirect rewrites. Equal to the raw input when unchanged. */
  canonical: string;
  /** True when the canonical id should be dropped from aggregation (deprecated without redirect). */
  deprecated: boolean;
  /** True when the raw input matched a vocabulary entry (as id or alias). */
  known: boolean;
}

interface VocabularyIndex {
  byId: Map<string, TagVocabularyEntry>;
  byAlias: Map<string, TagVocabularyEntry>;
}

function buildIndex(tagVocabulary: readonly TagVocabularyEntry[]): VocabularyIndex {
  const byId = new Map<string, TagVocabularyEntry>();
  const byAlias = new Map<string, TagVocabularyEntry>();
  for (const entry of tagVocabulary) {
    byId.set(entry.id, entry);
    for (const alias of entry.aliases ?? []) byAlias.set(alias, entry);
  }
  return { byId, byAlias };
}

/** Resolve a single raw tag using a pre-built index (internal). */
function resolveTagWithIndex(
  raw: string,
  index: VocabularyIndex,
): ResolvedTag {
  const entry = index.byId.get(raw) ?? index.byAlias.get(raw);
  if (!entry) return { canonical: raw, deprecated: false, known: false };
  const dep = entry.deprecated;
  if (dep && typeof dep === "object" && dep.redirect) {
    const target = index.byId.get(dep.redirect);
    if (target) return { canonical: target.id, deprecated: false, known: true };
    // Redirect points at a missing id — treat like plain deprecation.
    return { canonical: entry.id, deprecated: true, known: true };
  }
  if (dep === true) {
    return { canonical: entry.id, deprecated: true, known: true };
  }
  return { canonical: entry.id, deprecated: false, known: true };
}

/**
 * Resolve a raw tag string to its canonical form.
 *
 * Parameterized version of the host's `resolveTag` — receives `tagVocabulary`
 * and `tagGovernance` as arguments instead of reading `settings.*` at module scope.
 *
 * When the vocabulary is inactive (`tagVocabulary` is empty/falsy or
 * `tagGovernance` is `"off"`), the raw value passes through unchanged with
 * `known: false, deprecated: false`. Otherwise:
 *
 * - A direct id match returns that id.
 * - An alias match returns the aliased entry's id.
 * - `deprecated: { redirect: "<id>" }` rewrites to the redirect target.
 * - `deprecated: true` (no redirect) returns `deprecated: true` so callers
 *   can drop the tag from aggregation.
 * - An unknown value returns the raw string with `known: false`.
 */
export function resolveTag(
  raw: string,
  tagVocabulary: readonly TagVocabularyEntry[] | false | undefined,
  tagGovernance: TagGovernanceMode | undefined,
): ResolvedTag {
  if (!tagVocabulary || tagGovernance === "off") {
    return { canonical: raw, deprecated: false, known: false };
  }
  return resolveTagWithIndex(raw, buildIndex(tagVocabulary));
}

/**
 * Resolve a list of raw tag strings (e.g. from frontmatter) to canonical ids,
 * dropping deprecated-without-redirect entries and preserving order. Duplicates
 * produced by alias collapse are removed.
 *
 * Builds the vocabulary index once and reuses it for all tags — O(N) index
 * construction instead of O(N×M) when called with M tags.
 *
 * Parameterized version of the host's `resolvePageTags`.
 */
export function resolvePageTags(
  rawTags: readonly string[],
  tagVocabulary: readonly TagVocabularyEntry[] | false | undefined,
  tagGovernance: TagGovernanceMode | undefined,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  if (!tagVocabulary || tagGovernance === "off") {
    // Vocabulary inactive — pass-through all tags deduped.
    for (const raw of rawTags) {
      if (seen.has(raw)) continue;
      seen.add(raw);
      out.push(raw);
    }
    return out;
  }
  // Build the index once for all tags in this call.
  const index = buildIndex(tagVocabulary);
  for (const raw of rawTags) {
    const { canonical, deprecated } = resolveTagWithIndex(raw, index);
    if (deprecated) continue;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    out.push(canonical);
  }
  return out;
}
