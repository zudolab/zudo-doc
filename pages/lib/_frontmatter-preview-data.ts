// Host-side filter helper that turns a doc entry's `data` (frontmatter)
// into the `entries` array expected by `<FrontmatterPreview>`.
//
// The v2 component (packages/zudo-doc-v2/src/metainfo/frontmatter-preview.tsx)
// is a pure renderer — the caller is responsible for:
//
//  1. Honouring `settings.frontmatterPreview === false` (block hidden everywhere).
//  2. Removing schema-managed system keys (DEFAULT_FRONTMATTER_IGNORE_KEYS).
//  3. Applying the host's `ignoreKeys` (replaces the default list) or
//     `extraIgnoreKeys` (adds to the default).
//  4. Skipping null/undefined values.
//
// Returning an empty array suppresses the block — the v2 component
// short-circuits with `null` when `entries` is empty.
//
// Note: `frontmatterRenderers` integration is intentionally skipped for
// now. The v2 component does not yet accept a renderer map; the simple
// text path covers every case the e2e smoke spec checks for. Custom
// renderer support can be added as a follow-up without changing this
// helper's signature.

import { settings } from "@/config/settings";
import { DEFAULT_FRONTMATTER_IGNORE_KEYS } from "@/config/frontmatter-preview-defaults";

export function buildFrontmatterPreviewEntries(
  data: Record<string, unknown> | null | undefined,
): Array<[string, unknown]> {
  if (!data) return [];

  const config = settings.frontmatterPreview;
  if (config === false) return [];

  const ignoreSet = new Set<string>(
    config.ignoreKeys ?? [
      ...DEFAULT_FRONTMATTER_IGNORE_KEYS,
      ...(config.extraIgnoreKeys ?? []),
    ],
  );

  const entries: Array<[string, unknown]> = [];
  for (const [key, value] of Object.entries(data)) {
    if (ignoreSet.has(key)) continue;
    if (value === null || value === undefined) continue;
    entries.push([key, value]);
  }
  return entries;
}
