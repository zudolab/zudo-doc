import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export function parseFrontmatter(content: string) {
  try {
    return matter(content);
  } catch {
    return null;
  }
}

export function escapeTitle(s: string): string {
  // Backslashes must be escaped first — the value is embedded in
  // double-quoted YAML frontmatter where `\d` or `C:\path` is invalid.
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function writeCategoryIndex(
  outputDir: string,
  label: string,
  position: number,
  description: string,
): void {
  const mdx = `---
title: "${escapeTitle(label)}"
description: "${escapeTitle(description)}"
sidebar_position: ${position}
category_no_page: true
generated: true
---
`;
  fs.writeFileSync(path.join(outputDir, "index.mdx"), mdx);
}

/**
 * Writes an unlisted sub-page MDX file. Used for skill references, scripts,
 * and assets.
 *
 * The route is derived from the file's path within the content collection —
 * deliberately NOT from an explicit `slug:`. zfb's `resolveMarkdownLinks`
 * resolves relative links against the source file path, so the on-disk
 * location of these pages must match the URL the skill page links to. Writing
 * them at `<dir>/ref-<name>.mdx` (siblings of the skill's `index.mdx`) is what
 * makes the `./ref-<name>` links resolve (#2411).
 */
export function writeUnlistedSubPage(
  outputPath: string,
  title: string,
  body: string,
): void {
  fs.writeFileSync(
    outputPath,
    `---\ntitle: "${escapeTitle(title)}"\nunlisted: true\ngenerated: true\n---\n\n${body}\n`,
  );
}

/**
 * Guards that the given name/slug is not the reserved "index" value.
 * Throws with a contextual message if it is.
 */
export function assertNotIndexReserved(
  nameOrSlug: string,
  errorMessage: string,
): void {
  if (nameOrSlug === "index") {
    throw new Error(errorMessage);
  }
}
