import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "./mdx.js";

export interface ResourceLocaleConfig {
  dir: string;
}

export interface ResolveLocaleDirsOptions {
  /** Project root used to resolve project-relative content directories. */
  projectRoot: string;
  /** Default-locale content directory, already resolved or project-relative. */
  docsDir: string;
  /** Additional locale directories, keyed by locale code. */
  locales?: Record<string, ResourceLocaleConfig>;
}

/**
 * Resolve additional locale content roots using the same rules as the
 * generator's default `docsDir`: absolute values pass through, while relative
 * values resolve against `projectRoot`.
 *
 * Generated locale indexes are written into these roots by a later emission
 * step. Rejecting duplicate roots here is important because a recursive clean
 * or a generated index for one locale must never target another locale's tree.
 */
export function resolveLocaleDirs({
  projectRoot,
  docsDir,
  locales,
}: ResolveLocaleDirsOptions): Record<string, ResourceLocaleConfig> | undefined {
  if (locales === undefined) return undefined;

  const defaultDir = resolveConfiguredDir(projectRoot, docsDir);
  const roots = new Map<string, string>([[path.normalize(defaultDir), "default docsDir"]]);
  const resolved: Record<string, ResourceLocaleConfig> = {};

  for (const [locale, config] of Object.entries(locales)) {
    if (config === null || typeof config !== "object" || typeof config.dir !== "string") {
      throw new TypeError(
        `resource-docs: locale "${locale}" must configure a content directory as { dir: string }`,
      );
    }
    const dir = resolveConfiguredDir(projectRoot, config.dir);
    const normalizedDir = path.normalize(dir);
    const previous = roots.get(normalizedDir);
    if (previous !== undefined) {
      throw new Error(
        `resource-docs: locale "${locale}" directory "${dir}" overlaps ${previous} at "${defaultDir === dir ? defaultDir : normalizedDir}". Configure a distinct content directory (or remove/rename the conflicting locale).`,
      );
    }
    roots.set(normalizedDir, `locale "${locale}"`);
    resolved[locale] = { dir };
  }

  return resolved;
}

function resolveConfiguredDir(projectRoot: string, input: string): string {
  return path.isAbsolute(input) ? input : path.resolve(projectRoot, input);
}

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function cleanDir(dir: string): void {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Write one generated locale index without deleting or overwriting authored
 * content. A missing file is created; an existing file is only replaced when
 * its frontmatter explicitly carries `generated: true`.
 */
export function writeGeneratedIndex(absPath: string, mdx: string): void {
  if (fs.existsSync(absPath)) {
    let existing: string;
    try {
      existing = fs.readFileSync(absPath, "utf8");
    } catch (error) {
      throw new Error(
        `resource-docs: cannot inspect existing locale index "${absPath}" before writing (${error instanceof Error ? error.message : String(error)}). Remove or rename the file, then retry.`,
      );
    }

    const parsed = parseFrontmatter(existing);
    if (parsed?.data.generated !== true) {
      throw new Error(
        `resource-docs: refusing to overwrite authored locale index "${absPath}" because its frontmatter does not contain generated: true. Remove or rename the file, then retry.`,
      );
    }
  }

  ensureDir(path.dirname(absPath));
  fs.writeFileSync(absPath, mdx);
}

/**
 * Remove a generated locale index that is no longer backed by a source
 * category. Authored files are intentionally left untouched: locale trees
 * can contain downstream overrides and are never recursively cleaned.
 */
export function removeGeneratedIndex(absPath: string): void {
  if (!fs.existsSync(absPath)) return;

  let existing: string;
  try {
    existing = fs.readFileSync(absPath, "utf8");
  } catch (error) {
    throw new Error(
      `resource-docs: cannot inspect existing locale index "${absPath}" before removing it (${error instanceof Error ? error.message : String(error)}). Remove or rename the file, then retry.`,
    );
  }

  if (parseFrontmatter(existing)?.data.generated === true) {
    fs.unlinkSync(absPath);
  }
}

export function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .sort();
}
