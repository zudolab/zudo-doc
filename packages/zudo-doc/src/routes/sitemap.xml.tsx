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
