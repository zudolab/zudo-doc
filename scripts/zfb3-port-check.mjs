#!/usr/bin/env node
import { readFileSync, mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve, relative, join, sep } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repo = resolve(fileURLToPath(new URL("..", import.meta.url)));
const pkg = resolve(repo, "packages/zudo-doc");
const manifest = JSON.parse(readFileSync(resolve(pkg, "package.json"), "utf8"));
const sourcePaths = Object.fromEntries(Object.entries(manifest.exports).flatMap(([key, entry]) => {
  const target = typeof entry === "string" ? entry : entry.default;
  if (!target?.startsWith("./dist/")) return [];
  const relativeTarget = target.slice(7);
  const isCode = relativeTarget.endsWith(".js");
  const stem = isCode ? relativeTarget.slice(0, -3) : relativeTarget;
  const source = isCode
    ? [".ts", ".tsx", ".js", ".jsx"].map((ext) => resolve(pkg, "src", stem + ext)).find(existsSync) ?? resolve(pkg, "src", stem + ".ts")
    : resolve(pkg, "src", stem);
  return [[`@takazudo/zudo-doc${key === "." ? "" : key.slice(1)}`, [source]]];
}));

function projectPaths(project) {
  const read = ts.readConfigFile(project, ts.sys.readFile);
  if (read.error) throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText, "\n"));
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, resolve(project, ".."));
  if (parsed.errors.length) throw new Error(parsed.errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")).join("\n"));
  return parsed.options.paths ?? {};
}

export function run(paths, { command = process.execPath } = {}) {
  if (!paths.length) throw new Error("Usage: node scripts/zfb3-port-check.mjs <paths…>");
  const owned = paths.map((path) => resolve(path));
  const dir = mkdtempSync(join(tmpdir(), "zfb3-port-check-"));
  let failed = false;
  let ownedCount = 0;
  let unrelatedCount = 0;
  try {
    for (const project of [resolve(pkg, "tsconfig.json"), resolve(repo, "tsconfig.json")]) {
      const config = join(dir, `${project === resolve(pkg, "tsconfig.json") ? "package" : "host"}.json`);
      writeFileSync(config, JSON.stringify({
        extends: project,
        // The package base lists generated declaration shims absent in the red window.
        files: [],
        compilerOptions: {
          baseUrl: repo,
          typeRoots: [resolve(repo, "node_modules/@types"), resolve(pkg, "node_modules/@types")],
          paths: { ...projectPaths(project), ...sourcePaths },
          noEmit: true,
        },
      }));
      const result = spawnSync(command, [resolve(repo, "node_modules/typescript/bin/tsc"), "--noEmit", "--pretty", "false", "-p", config], { cwd: repo, encoding: "utf8" });
      const lines = `${result.stdout ?? ""}${result.stderr ?? ""}`.split(/\r?\n/).filter(Boolean);
      if (result.error || result.signal || result.status === null) {
        failed = true;
        console.error(`${relative(repo, project)}: compiler invocation failed: ${result.error?.message ?? result.signal}`);
      }
      for (const line of lines) {
        // TypeScript indents related-information lines beneath the owning diagnostic.
        if (/^\s+/.test(line)) continue;
        const match = /^(.*?)\(\d+,\d+\): error TS\d+:/.exec(line);
        if (!match) {
          failed = true;
          console.error(`${relative(repo, project)}: compiler/config: ${line}`);
          continue;
        }
        const diagnosticPath = resolve(repo, match[1]);
        if (owned.some((path) => diagnosticPath === path || diagnosticPath.startsWith(path + sep))) {
          ownedCount++;
          failed = true;
          console.error(`${relative(repo, project)}: ${line}`);
        } else {
          unrelatedCount++;
        }
      }
      if (result.status !== 0 && lines.length === 0) {
        failed = true;
        console.error(`${relative(repo, project)}: compiler exited ${result.status} without diagnostics`);
      }
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
  console.log(`Port check: ${ownedCount} owned diagnostic(s); ${unrelatedCount} unrelated diagnostic(s) from migration window.`);
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = run(process.argv.slice(2)); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
