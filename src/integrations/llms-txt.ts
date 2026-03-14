import type { AstroIntegration } from "astro";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { settings } from "../config/settings";

/** Strip markdown formatting to produce plain text */
function stripMarkdown(md: string): string {
  return (
    md
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`]+`/g, "")
      // Remove HTML tags
      .replace(/<[^>]+>/g, "")
      // Remove headings markers
      .replace(/^#{1,6}\s+/gm, "")
      // Remove emphasis/bold markers
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
      .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
      // Remove images (must run before link removal)
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      // Remove links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Remove blockquote markers
      .replace(/^>\s+/gm, "")
      // Remove horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, "")
      // Remove list markers
      .replace(/^[\s]*[-*+]\s+/gm, "")
      .replace(/^[\s]*\d+\.\s+/gm, "")
      // Remove import statements
      .replace(/^import\s+.*$/gm, "")
      // Remove export statements
      .replace(/^export\s+.*$/gm, "")
      // Collapse whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** Strip frontmatter, imports, and exports from markdown content (keep structure) */
function stripFrontmatterAndImports(content: string): string {
  return (
    content
      // Remove import statements
      .replace(/^import\s+.*$/gm, "")
      // Remove export statements
      .replace(/^export\s+.*$/gm, "")
      // Remove JSX/HTML component tags (admonitions, etc.)
      .replace(/<[A-Z][a-zA-Z]*[^>]*>/g, "")
      .replace(/<\/[A-Z][a-zA-Z]*>/g, "")
      // Collapse excessive blank lines
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** Walk a directory and collect all .md/.mdx files */
function collectMdFiles(
  dir: string,
): Array<{ filePath: string; slug: string }> {
  const results: Array<{ filePath: string; slug: string }> = [];

  function walk(currentDir: string, baseDir: string): void {
    let entries;
    try {
      entries = readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, baseDir);
      } else if (/\.mdx?$/.test(entry.name) && !entry.name.startsWith("_")) {
        const rel = fullPath
          .slice(baseDir.length + 1)
          .replace(/\.mdx?$/, "")
          .replace(/\/index$/, "");
        results.push({ filePath: fullPath, slug: rel });
      }
    }
  }

  walk(dir, dir);
  return results;
}

/** Compute a URL from a slug and locale */
function slugToUrl(slug: string, locale: string | null): string {
  const base = settings.base.replace(/\/$/, "");
  if (locale) {
    return `${base}/${locale}/docs/${slug}`;
  }
  return `${base}/docs/${slug}`;
}

interface DocEntry {
  title: string;
  description: string;
  url: string;
  content: string;
  sidebarPosition: number | undefined;
}

/** Build doc entries for a content directory */
function buildDocEntries(
  contentDir: string,
  locale: string | null,
): DocEntry[] {
  const absDir = resolve(contentDir);
  const files = collectMdFiles(absDir);
  const entries: DocEntry[] = [];

  for (const { filePath, slug } of files) {
    try {
      const raw = readFileSync(filePath, "utf-8");
      const { data, content } = matter(raw);

      // Skip excluded/draft/unlisted pages
      if (data.search_exclude || data.draft || data.unlisted) continue;

      let description = data.description ?? "";
      if (!description) {
        const stripped = stripMarkdown(content);
        description = stripped.split("\n").find((l) => l.trim().length > 0) ?? "";
      }

      entries.push({
        title: data.title ?? slug,
        description,
        url: slugToUrl(slug, locale),
        content: stripFrontmatterAndImports(content),
        sidebarPosition: data.sidebar_position,
      });
    } catch {
      // Skip files that can't be parsed
    }
  }

  // Sort by sidebar_position (entries without position go last)
  entries.sort((a, b) => {
    const posA = a.sidebarPosition ?? Number.MAX_SAFE_INTEGER;
    const posB = b.sidebarPosition ?? Number.MAX_SAFE_INTEGER;
    return posA - posB;
  });

  return entries;
}

/** Generate llms.txt content */
function generateLlmsTxt(entries: DocEntry[]): string {
  const lines: string[] = [];
  lines.push(`# ${settings.siteName}`);
  lines.push("");
  lines.push(`> ${settings.siteDescription}`);
  lines.push("");
  lines.push("## Docs");
  lines.push("");

  for (const entry of entries) {
    lines.push(`- [${entry.title}](${entry.url}): ${entry.description}`);
  }

  lines.push("");
  return lines.join("\n");
}

/** Generate llms-full.txt content */
function generateLlmsFullTxt(entries: DocEntry[]): string {
  const lines: string[] = [];
  lines.push(`# ${settings.siteName}`);
  lines.push("");
  lines.push(`> ${settings.siteDescription}`);

  for (const entry of entries) {
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(`# ${entry.title}`);
    lines.push("");
    lines.push(`> Source: ${entry.url}`);
    lines.push("");
    lines.push(entry.content);
  }

  lines.push("");
  return lines.join("\n");
}

interface DevResponse {
  setHeader: (k: string, v: string) => void;
  end: (s: string) => void;
  statusCode: number;
}

/** Send generated llms content as a text response */
function sendLlmsResponse(
  res: DevResponse,
  entries: DocEntry[],
  isFull: boolean,
): void {
  const content = isFull
    ? generateLlmsFullTxt(entries)
    : generateLlmsTxt(entries);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(content);
}

/** Serve llms.txt files in dev middleware */
function serveLlmsTxt(url: string | undefined, res: DevResponse): boolean {
  const base = settings.base.replace(/\/$/, "");

  // Match locale-prefixed paths: /{locale}/llms.txt, /{locale}/llms-full.txt
  if (settings.locales) {
    for (const code of Object.keys(settings.locales)) {
      const config = settings.locales[code as keyof typeof settings.locales];
      if (
        url === `${base}/${code}/llms.txt` ||
        url === `${base}/${code}/llms-full.txt`
      ) {
        const entries = buildDocEntries(config.dir, code);
        sendLlmsResponse(res, entries, url.endsWith("llms-full.txt"));
        return true;
      }
    }
  }

  // Match default locale paths: /llms.txt, /llms-full.txt
  if (url === `${base}/llms.txt` || url === `${base}/llms-full.txt`) {
    const entries = buildDocEntries(settings.docsDir, null);
    sendLlmsResponse(res, entries, url.endsWith("llms-full.txt"));
    return true;
  }

  return false;
}

export function llmsTxtIntegration(): AstroIntegration {
  return {
    name: "llms-txt",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);

        // Default locale
        const defaultEntries = buildDocEntries(settings.docsDir, null);
        writeFileSync(join(outDir, "llms.txt"), generateLlmsTxt(defaultEntries));
        writeFileSync(
          join(outDir, "llms-full.txt"),
          generateLlmsFullTxt(defaultEntries),
        );
        logger.info(
          `Generated llms.txt and llms-full.txt (${defaultEntries.length} pages)`,
        );

        // Locale docs
        if (settings.locales) {
          for (const [code, config] of Object.entries(settings.locales)) {
            const localeEntries = buildDocEntries(config.dir, code);
            const localeDir = join(outDir, code);
            mkdirSync(localeDir, { recursive: true });
            writeFileSync(
              join(localeDir, "llms.txt"),
              generateLlmsTxt(localeEntries),
            );
            writeFileSync(
              join(localeDir, "llms-full.txt"),
              generateLlmsFullTxt(localeEntries),
            );
            logger.info(
              `Generated ${code}/llms.txt and ${code}/llms-full.txt (${localeEntries.length} pages)`,
            );
          }
        }
      },

      "astro:config:setup": ({ updateConfig, command }) => {
        if (command !== "dev") return;

        updateConfig({
          vite: {
            plugins: [
              {
                name: "llms-txt-dev",
                configureServer(server) {
                  server.middlewares.use((req, res, next) => {
                    try {
                      const served = serveLlmsTxt(req.url, res);
                      if (!served) {
                        next();
                      }
                    } catch (err) {
                      res.statusCode = 500;
                      res.setHeader("Content-Type", "text/plain");
                      res.end(
                        err instanceof Error
                          ? err.message
                          : "Internal error",
                      );
                    }
                  });
                },
              },
            ],
          },
        });
      },
    },
  };
}
