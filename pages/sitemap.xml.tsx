// Port of `src/integrations/sitemap.ts` onto zfb's pages-style filename
// convention.
//
// Filename → output extension mapping (zfb convention): the
// second-to-last `.`-separated segment of the stem becomes the output
// extension, so `sitemap.xml.tsx` builds `dist/sitemap.xml`. The
// explicit `contentType` export pins the dev-server `Content-Type`
// header to `application/xml` regardless of the filename hint.
//
// The Astro integration walks every `.html` file under `dist/` after
// the build finishes and emits one `<url>` entry per route. zfb runs
// each page in isolation, so the equivalent here is to walk every
// loaded content collection through `zfb/content` and reproduce the
// same URL set the docs / locale / version routes consume. The XML
// formatter (escaping, sorted entries, today-only `<lastmod>`) mirrors
// the original integration byte-for-byte modulo timestamps.
//
// No plugin registration is required — the filename convention drives
// route discovery and `contentType` drives the response header. See
// `https://takazudomodular.com/pj/zudo-front-builder/concepts/non-html-pages`.

import { getCollection } from "zfb/content";
import { settings } from "@/config/settings";

export const frontmatter = { title: "Sitemap" };
export const contentType = "application/xml";

type DocData = {
  draft?: boolean;
  slug?: string;
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build a directory-style URL (always trailing slash) from path
 * segments. Mirrors Astro's `trailingSlash: true` build, which is what
 * the original integration recovered from `index.html` paths.
 */
function buildUrl(...segments: string[]): string {
  const joined = segments
    .filter((s) => s !== "")
    .join("/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  return joined === "" ? "/" : `/${joined}/`;
}

/** Apply `settings.base` (matches the original integration). */
function withBase(path: string): string {
  const base = settings.base.replace(/\/$/, "");
  if (base && base !== "/") {
    return base + path;
  }
  return path;
}

async function collectDocsUrls(
  collectionName: string,
  pathPrefix: readonly string[],
): Promise<string[]> {
  const entries = (await getCollection(collectionName)) as Array<{
    slug: string;
    data: DocData;
  }>;
  // Match the original integration's "walk every emitted HTML file"
  // behaviour: only `draft` is filtered (Astro excludes drafts from the
  // build itself, so they never reach `dist/`). `unlisted` and
  // `standalone` pages do reach `dist/` and therefore appear in today's
  // sitemap — preserve that bug-for-bug to keep the output byte-equal.
  const urls: string[] = [];
  for (const entry of entries) {
    if (entry.data.draft) continue;
    const slug = entry.data.slug ?? entry.slug;
    urls.push(buildUrl(...pathPrefix, slug));
  }
  return urls;
}

export default async function Sitemap(): Promise<string> {
  const urls: string[] = [];

  // Site root.
  urls.push(buildUrl());

  // Default-locale docs (mirrors `src/pages/docs/[...slug].astro`).
  urls.push(...(await collectDocsUrls("docs", ["docs"])));

  // Per-locale docs (mirrors `src/pages/[locale]/docs/[...slug].astro`).
  for (const code of Object.keys(settings.locales)) {
    urls.push(buildUrl(code));
    urls.push(...(await collectDocsUrls(`docs-${code}`, [code, "docs"])));
  }

  // Versioned docs (mirrors `src/pages/v/[version]/docs/[...slug].astro`).
  if (settings.versions) {
    for (const version of settings.versions) {
      urls.push(
        ...(await collectDocsUrls(`docs-v-${version.slug}`, ["v", version.slug, "docs"])),
      );
      if (version.locales) {
        for (const code of Object.keys(version.locales)) {
          urls.push(
            ...(await collectDocsUrls(
              `docs-v-${version.slug}-${code}`,
              [code, "v", version.slug, "docs"],
            )),
          );
        }
      }
    }
  }

  const finalUrls = urls.map(withBase);

  const today = new Date().toISOString().split("T")[0];
  const siteUrlBase = (settings.siteUrl ?? "").replace(/\/$/, "");
  const urlEntries = finalUrls
    .sort()
    .map(
      (url) => `  <url>
    <loc>${escapeXml(siteUrlBase + url)}</loc>
    <lastmod>${today}</lastmod>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;
}
