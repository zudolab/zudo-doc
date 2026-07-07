import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { generateChangelogMarkdown } from "./generate.js";
import { loadChangelogEntries } from "./load.js";
import type { ChangelogEmitOptions, ChangelogEmitResult } from "./types.js";

export function emitChangelogs(options: ChangelogEmitOptions): ChangelogEmitResult {
  const written: string[] = [];

  for (const config of options.changelogs) {
    const sourceDir = resolve(options.projectRoot, config.sourceDir);
    const outputFile = resolve(options.projectRoot, config.outputFile);
    const entries = loadChangelogEntries({ sourceDir });
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
