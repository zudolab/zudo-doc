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
  /** Exact canonical id, or the raw input when it is unknown/inactive. */
  canonical: string;
  /** True when the raw input exactly matched a vocabulary id. */
  known: boolean;
}

function buildIndex(tagVocabulary: readonly TagVocabularyEntry[]): Set<string> {
  return new Set(tagVocabulary.map((entry) => entry.id));
}

/** Resolve a single raw tag using a pre-built index (internal). */
function resolveTagWithIndex(raw: string, ids: Set<string>): ResolvedTag {
  return { canonical: raw, known: ids.has(raw) };
}

/**
 * Resolve a raw tag string to its canonical form.
 *
 * Parameterized version of the host's `resolveTag` — receives `tagVocabulary`
 * and `tagGovernance` as arguments instead of reading `settings.*` at module scope.
 *
 * When the vocabulary is inactive (`tagVocabulary` is empty/falsy or
 * `tagGovernance` is `"off"`), the raw value passes through unchanged with
 * `known: false`. Otherwise:
 *
 * - An exact id match returns that id with `known: true`.
 * - An unknown value returns the raw string with `known: false`.
 */
export function resolveTag(
  raw: string,
  tagVocabulary: readonly TagVocabularyEntry[] | false | undefined,
  tagGovernance: TagGovernanceMode | undefined,
): ResolvedTag {
  if (!tagVocabulary || tagGovernance === "off") {
    return { canonical: raw, known: false };
  }
  return resolveTagWithIndex(raw, buildIndex(tagVocabulary));
}

/**
 * Resolve a list of raw tag strings (e.g. from frontmatter), preserving order
 * and removing exact duplicates. Unknown strings pass through unchanged.
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
    const { canonical } = resolveTagWithIndex(raw, index);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    out.push(canonical);
  }
  return out;
}
