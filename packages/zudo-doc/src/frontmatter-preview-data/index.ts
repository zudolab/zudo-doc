// frontmatter-preview-data — parameterized factory for the host-side
// frontmatter entry filter (epic #2344, S1b).
//
// The host's `pages/lib/_frontmatter-preview-data.ts` previously read
// `settings.frontmatterPreview` and `DEFAULT_FRONTMATTER_IGNORE_KEYS`
// at module scope. This factory receives both as arguments so the logic
// lives in the package while the host stub keeps the singleton imports.

import type { FrontmatterPreviewConfig } from "../settings.js";

export type { FrontmatterPreviewConfig };

/**
 * Config the factory reads from the host's settings.
 *
 * `frontmatterPreview` is the host's resolved `settings.frontmatterPreview`
 * field (a `FrontmatterPreviewConfig` object or `false`/`undefined`).
 * `defaultIgnoreKeys` is the host-supplied schema-managed key list
 * (typically `DEFAULT_FRONTMATTER_IGNORE_KEYS` from the host's config).
 */
export interface FrontmatterPreviewDataConfig {
  frontmatterPreview: FrontmatterPreviewConfig | false | undefined;
  defaultIgnoreKeys: readonly string[];
}

/**
 * Create a `buildFrontmatterPreviewEntries` helper bound to the given config.
 *
 * The host stub calls this once with its concrete settings and re-exports the
 * result, mirroring the shape of `makeUrlHelpers` (S1a) and
 * `createComposeMetaTitle`.
 *
 * Returning an empty array suppresses the frontmatter block — the v2
 * `<FrontmatterPreview>` component short-circuits with `null` when
 * `entries` is empty.
 */
export function createBuildFrontmatterPreviewEntries(
  config: FrontmatterPreviewDataConfig,
): (data: Record<string, unknown> | null | undefined) => Array<[string, unknown]> {
  return function buildFrontmatterPreviewEntries(
    data: Record<string, unknown> | null | undefined,
  ): Array<[string, unknown]> {
    if (!data) return [];

    // `frontmatterPreview` may be absent (undefined) in fixtures that
    // don't opt into the feature. `false` means the host explicitly
    // disabled the block. Both should produce an empty entries array.
    const fmConfig = config.frontmatterPreview;
    if (fmConfig === false || fmConfig === undefined) return [];

    const ignoreSet = new Set<string>(
      fmConfig.ignoreKeys ?? [
        ...config.defaultIgnoreKeys,
        ...(fmConfig.extraIgnoreKeys ?? []),
      ],
    );

    const entries: Array<[string, unknown]> = [];
    for (const [key, value] of Object.entries(data)) {
      if (ignoreSet.has(key)) continue;
      if (value === null || value === undefined) continue;
      entries.push([key, value]);
    }
    return entries;
  };
}
