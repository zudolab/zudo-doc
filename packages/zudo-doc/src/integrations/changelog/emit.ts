import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { generateChangelogMarkdown } from "./generate.js";
import { loadChangelogEntries } from "./load.js";
import type { ChangelogEmitOptions, ChangelogEmitResult } from "./types.js";

export function emitChangelogs(options: ChangelogEmitOptions): ChangelogEmitResult {
  const written: string[] = [];

  for (const config of options.changelogs) {
    const sourceDir = resolve(options.projectRoot, config.sourceDir);
    const outputFile = resolve(options.projectRoot, config.outputFile);
    const entries = loadChangelogEntries({ sourceDir });
    if (entries.length === 0) {
      const nestedMdxDirs = findNestedMdxDirs(sourceDir);
      if (nestedMdxDirs.length > 0) {
        options.logger?.warn?.(
          `Changelog sourceDir "${config.sourceDir}" (${sourceDir}) yielded 0 releases but contains .mdx files in sub-directories: ${nestedMdxDirs.join(
            ", ",
          )}. In a multi-changelog layout, each changelogs[] entry must point at a per-package directory (for example "${config.sourceDir}/<name>") whose per-release files are non-index .mdx files; the loader intentionally skips index.mdx.`,
        );
      }
    }
    const markdown = generateChangelogMarkdown(entries, {
      title: config.title,
      packageName: config.packageName,
    });

    mkdirSync(dirname(outputFile), { recursive: true });
    writeFileSync(outputFile, markdown);
    written.push(outputFile);
    options.logger?.info(`Generated ${config.outputFile} (${entries.length} releases)`);
  }

  return { written };
}

function findNestedMdxDirs(sourceDir: string): string[] {
  return readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) =>
      readdirSync(join(sourceDir, entry.name), { withFileTypes: true }).some(
        (nestedEntry) => nestedEntry.isFile() && nestedEntry.name.endsWith(".mdx"),
      ),
    )
    .map((entry) => entry.name)
    .sort();
}
