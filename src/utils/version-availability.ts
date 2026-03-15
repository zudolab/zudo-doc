import { settings } from "@/config/settings";
import type { CollectionKey } from "astro:content";
import { getDocsCollection } from "@/utils/get-docs-collection";
import { toRouteSlug } from "@/utils/slug";

export type VersionAvailability = Record<string, Set<string>>;

let cached: VersionAvailability | null = null;

/**
 * Scan each version's content directory and return a map of
 * version slug → Set of available doc slugs.
 * Results are cached for the build lifecycle.
 */
export async function getVersionAvailability(): Promise<VersionAvailability> {
  if (cached) return cached;

  const result: VersionAvailability = {};

  if (!settings.versions) {
    cached = result;
    return result;
  }

  for (const version of settings.versions) {
    const collectionName = `docs-v-${version.slug}` as CollectionKey;
    try {
      const docs = await getDocsCollection(collectionName);
      const slugs = new Set(
        docs.map((doc) => doc.data.slug ?? toRouteSlug(doc.id)),
      );
      result[version.slug] = slugs;
    } catch {
      // Collection may not exist or be empty
      result[version.slug] = new Set();
    }
  }

  cached = result;
  return result;
}

/**
 * Check if a specific doc slug exists in a given version.
 */
export function isSlugAvailable(
  availability: VersionAvailability,
  versionSlug: string,
  docSlug: string,
): boolean {
  return availability[versionSlug]?.has(docSlug) ?? false;
}
