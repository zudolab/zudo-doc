import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach } from "vitest";
import {
  resolveRunOptions,
  runDocSources,
  type DocSourcesPluginOptions,
  type DocSourcesRunResult,
} from "../run.js";

const temps: string[] = [];

afterEach(() => {
  for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/** A temporary project with a fake home directory beside it. */
export function makeProject(): { root: string; home: string } {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "doc-sources-")));
  temps.push(base);
  const root = path.join(base, "project");
  const home = path.join(base, "home");
  fs.mkdirSync(path.join(root, "src", "content", "docs"), { recursive: true });
  fs.mkdirSync(home, { recursive: true });
  return { root, home };
}

export function write(file: string, content: string | Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

export function read(file: string): string {
  return fs.readFileSync(file, "utf8");
}

export function exists(file: string): boolean {
  return fs.existsSync(file);
}

/** Sorted POSIX paths of every file below `dir`, relative to it. */
export function listTree(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(path.relative(dir, full).split(path.sep).join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

export function run(
  project: { root: string; home: string },
  plugin: DocSourcesPluginOptions,
): DocSourcesRunResult {
  const options = resolveRunOptions(
    { docsDir: "src/content/docs", defaultLocale: "en", ...plugin },
    { projectRoot: project.root, homeDir: () => project.home },
  );
  return runDocSources(options);
}

export function frontmatter(file: string): Record<string, string> {
  const match = read(file).match(/^---\n([\s\S]*?)\n---/);
  const fields: Record<string, string> = {};
  for (const line of match?.[1]?.split("\n") ?? []) {
    const index = line.indexOf(":");
    fields[line.slice(0, index)] = line.slice(index + 1).trim().replace(/^"(.*)"$/, "$1");
  }
  return fields;
}
