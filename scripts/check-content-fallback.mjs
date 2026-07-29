#!/usr/bin/env node
// scripts/check-content-fallback.mjs
//
// Guard check: fails if any built page shipped its body as a
// `<pre data-zfb-content-fallback>` blob instead of rendered content.
//
// Background (#3134): when zfb's bundler declines to wire a page's compiled
// MDX through the content bridge, it emits a *warning* and falls back to
// dumping the raw markdown into a single `<pre>` — no headings, no anchors,
// no components. `zfb build` still exits 0, so the broken page ships
// silently; #3134 reached production on /docs/reference/design-token-panel
// and was only noticed by reading build logs.
//
// The upstream trigger is not a content construct — an EN page failed while
// its byte-for-byte-equivalent JA mirror rendered fine, and the compiled JSX
// that zfb rejected parses cleanly under esbuild. It is sensitive to
// accumulated document shape, so an unrelated edit to an already-fine page
// can flip it. That is exactly why this needs a build-output gate rather
// than author-side discipline: the failure is invisible in the source.
// Tracked upstream as Takazudo/zudo-front-builder#2186; retire this guard
// only once that lands AND zfb fails the build itself.
//
// Known-exempt routes live in `.content-fallback-allowlist` (substring match
// on the dist-relative path, each entry justified by a `# reason:` comment).
//
// Usage: node scripts/check-content-fallback.mjs [dist-dir]
// Exit 0 = no page fell back. Exit 1 = at least one page shipped a blob.
//
// Requires a completed `pnpm build`.
//
// Wired into:
//   - scripts/run-b4push.sh (after the build step)
//   - .github/workflows/pr-checks.yml (build-site job, after pnpm build)
//   - .github/workflows/main-deploy.yml (build-site job, after pnpm build)
//   - .github/workflows/preview-deploy.yml (build-site job, after pnpm build)

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join, relative, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// The attribute zfb stamps on the fallback wrapper element
// (`<pre data-zfb-content-fallback="">`, see zfb's renderFallback()).
const FALLBACK_ATTR = "data-zfb-content-fallback";

// Match the actual fallback element, not the attribute name as text: pages
// that *document* the attribute carry it HTML-escaped inside <code> spans
// (`&lt;pre data-zfb-content-fallback>`), which must not count as a fallback.
const FALLBACK_ELEMENT_RE = new RegExp(`<pre\\b[^>]*\\b${FALLBACK_ATTR}\\b`);

/** True when the built HTML contains a real zfb fallback wrapper element. */
export function hasFallbackElement(html) {
  return FALLBACK_ELEMENT_RE.test(html);
}

const ALLOWLIST_FILE = resolve(ROOT, ".content-fallback-allowlist");

/** Substring patterns of dist-relative paths that are exempt. */
export function parseAllowlist(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

/**
 * Split fallback pages into allowlisted (`exempt`) and failing (`offenders`).
 * Paths are dist-relative; entries match as plain substrings so one entry
 * covers every locale of a route.
 */
export function partitionFallbacks(fallbackPaths, allowlist) {
  const exempt = [];
  const offenders = [];
  for (const p of fallbackPaths) {
    if (allowlist.some((a) => p.includes(a))) exempt.push(p);
    else offenders.push(p);
  }
  return { exempt, offenders };
}

function readAllowlist() {
  if (!existsSync(ALLOWLIST_FILE)) return [];
  return parseAllowlist(readFileSync(ALLOWLIST_FILE, "utf8"));
}

/** Recursively collect .html files under `dir`. */
function findHtmlFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findHtmlFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".html")) results.push(full);
  }
  return results;
}

function main() {
  const distDir = resolve(ROOT, process.argv[2] ?? "dist");

  if (!existsSync(distDir)) {
    console.error(`✗ Content-fallback check: ${relative(ROOT, distDir)}/ not found.`);
    console.error("  Run `pnpm build` first.");
    return 1;
  }

  const htmlFiles = findHtmlFiles(distDir);
  if (htmlFiles.length === 0) {
    console.error(`✗ Content-fallback check: no .html files under ${relative(ROOT, distDir)}/.`);
    console.error("  The build produced nothing to check — treat as a failure, not a pass.");
    return 1;
  }

  const allFallbacks = htmlFiles
    .filter((f) => hasFallbackElement(readFileSync(f, "utf8")))
    .map((f) => relative(distDir, f));

  const { exempt, offenders } = partitionFallbacks(allFallbacks, readAllowlist());

  if (exempt.length > 0) {
    console.log(
      `  (${exempt.length} allowlisted fallback page(s) ignored — see .content-fallback-allowlist)`,
    );
  }

  if (offenders.length === 0) {
    console.log(`✓ Content-fallback check: ${htmlFiles.length} pages, none fell back.`);
    return 0;
  }

  console.error(
    `✗ Content-fallback check: ${offenders.length} of ${htmlFiles.length} built pages ` +
      `shipped their body as a <pre ${FALLBACK_ATTR}> blob:`,
  );
  console.error("");
  for (const p of offenders) console.error(`  ${relative(ROOT, join(distDir, p))}`);
  console.error("");
  console.error(
    "These pages render with no headings, no anchors, and no components.\n" +
      "Find the cause in the build log:\n" +
      "\n" +
      "  pnpm build 2>&1 | grep 'content bridge'\n" +
      "\n" +
      "zfb names the offending source file there. The trigger is an upstream\n" +
      "bundler bug (zudolab/zudo-doc#3134) that depends on accumulated document\n" +
      "shape rather than on any single construct, so bisect by removing blocks\n" +
      "from the named file until the warning clears, then find the smallest\n" +
      "equivalent rewording of that block.",
  );
  return 1;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  process.exit(main());
}
