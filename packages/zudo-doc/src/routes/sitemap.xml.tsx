// Package route entrypoint: /sitemap.xml — package-owned equivalent of
// pages/sitemap.xml.tsx (epic Package-First Finale #2356, A1 #2361).
//
// URL enumeration is delegated to `enumerateAllRoutes` (reconstructed in
// `_context` from `@takazudo/zudo-doc/route-enumerators`) so the sitemap cannot
// drift from the actual routes the page entrypoints build. Dormant unless
// `settings.packageOwnedRoutes` is on (Decision 6 precedence still applies).

import { settings, enumerateAllRoutes } from "./_context.js";

export const frontmatter = { title: "Sitemap" };
export const contentType = "application/xml";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export default function Sitemap(): string {
  if (!settings.sitemap) {
    // Package-owned injection (routes.ts) now gates `/sitemap.xml` on
    // `settings.sitemap` (#3931/#3933), so this branch is unreachable through
    // the normal injected route on a `sitemap: false` host. It stays reachable
    // only via a host-defined/manual route — e.g. a kept `pages/sitemap.xml.tsx`
    // that re-exports this entrypoint despite the feature being off — which is
    // exactly the misconfiguration this warning names.
    console.warn(
      "[zudo-doc] routes/sitemap.xml was rendered while settings.sitemap is false/unset; " +
        "emitting an empty <urlset>. Set settings.sitemap: true to enable it, or remove " +
        "the manual route that reached this entrypoint.",
    );
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;
  }

  const routeMap = enumerateAllRoutes();
  const siteUrlBase = (settings.siteUrl ?? "").replace(/\/$/, "");

  const urlEntries = [...routeMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([url, lastmod]) => `  <url>
    <loc>${escapeXml(siteUrlBase + url)}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;
}
