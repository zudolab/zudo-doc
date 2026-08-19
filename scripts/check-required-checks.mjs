#!/usr/bin/env node
// File-only guard for the intended required-checks set. This script must stay
// dependency-free and must never query GitHub: it runs in unauthenticated,
// offline local environments as well as PR CI.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const paths = {
    workflow: resolve(ROOT, ".github/workflows/pr-checks.yml"),
    manifest: resolve(ROOT, ".required-checks-manifest"),
    allowlist: resolve(ROOT, ".required-checks-allowlist"),
  };

  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    const key = option?.match(/^--(workflow|manifest|allowlist)$/)?.[1];
    if (!key || !value) {
      throw new Error(
        "Usage: node scripts/check-required-checks.mjs [--workflow PATH] [--manifest PATH] [--allowlist PATH]",
      );
    }
    paths[key] = resolve(process.cwd(), value);
  }

  return paths;
}

function unquoteYamlScalar(value, location) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"')) {
    if (!trimmed.endsWith('"')) {
      throw new Error(`${location}: unterminated double-quoted job name`);
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      throw new Error(`${location}: unsupported double-quoted job name`);
    }
  }
  if (trimmed.startsWith("'")) {
    if (!trimmed.endsWith("'")) {
      throw new Error(`${location}: unterminated single-quoted job name`);
    }
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }
  return trimmed.replace(/\s+#.*$/, "").trim();
}

function parseWorkflowJobNames(source, path) {
  const lines = source.split(/\r?\n/);
  const jobsLine = lines.findIndex((line) => line === "jobs:");
  if (jobsLine === -1) {
    throw new Error(`${path}: missing top-level jobs mapping`);
  }

  const jobs = [];
  let currentJob = null;

  for (let index = jobsLine + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[^\s#][^:]*:/.test(line)) break;

    const jobMatch = line.match(/^  ([A-Za-z0-9_-]+):(?:\s+#.*)?$/);
    if (jobMatch) {
      if (currentJob && !currentJob.name) {
        throw new Error(
          `${path}:${currentJob.line}: job "${currentJob.id}" has no explicit name`,
        );
      }
      currentJob = { id: jobMatch[1], line: index + 1, name: null };
      jobs.push(currentJob);
      continue;
    }

    const nameMatch = line.match(/^    name:\s*(.+)$/);
    if (currentJob && nameMatch) {
      if (currentJob.name) {
        throw new Error(
          `${path}:${index + 1}: job "${currentJob.id}" has more than one name`,
        );
      }
      const name = unquoteYamlScalar(
        nameMatch[1],
        `${path}:${index + 1}`,
      );
      if (!name || name.includes("${{")) {
        throw new Error(
          `${path}:${index + 1}: job "${currentJob.id}" must have a static, non-empty name`,
        );
      }
      currentJob.name = name;
    }
  }

  if (currentJob && !currentJob.name) {
    throw new Error(
      `${path}:${currentJob.line}: job "${currentJob.id}" has no explicit name`,
    );
  }
  if (jobs.length === 0) {
    throw new Error(`${path}: jobs mapping is empty or could not be parsed`);
  }

  return jobs.map((job) => job.name);
}

function parseManifest(source, path) {
  const entries = [];
  for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.includes("#")) {
      throw new Error(
        `${path}:${index + 1}: manifest entries may not have inline comments`,
      );
    }
    entries.push(line);
  }
  return entries;
}

function parseAllowlist(source, path) {
  const entries = [];
  for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(.+?)\s+# reason:\s+(.+)$/);
    if (!match) {
      throw new Error(
        `${path}:${index + 1}: every allowlist entry must end with "# reason: <why>"`,
      );
    }
    entries.push(match[1].trim());
  }
  return entries;
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

function quotedList(values) {
  return values.map((value) => `  - ${value}`).join("\n");
}

function main() {
  const paths = parseArgs(process.argv.slice(2));
  const jobNames = parseWorkflowJobNames(
    readFileSync(paths.workflow, "utf8"),
    paths.workflow,
  );
  const manifest = parseManifest(
    readFileSync(paths.manifest, "utf8"),
    paths.manifest,
  );
  const allowlist = parseAllowlist(
    readFileSync(paths.allowlist, "utf8"),
    paths.allowlist,
  );

  const errors = [];
  for (const [label, values] of [
    ["workflow job names", jobNames],
    ["manifest entries", manifest],
    ["allowlist entries", allowlist],
  ]) {
    const duplicates = duplicateValues(values);
    if (duplicates.length > 0) {
      errors.push(`Duplicate ${label}:\n${quotedList(duplicates)}`);
    }
  }

  const jobs = new Set(jobNames);
  const required = new Set(manifest);
  const allowed = new Set(allowlist);
  const overlap = [...required].filter((name) => allowed.has(name)).sort();
  const unlisted = [...jobs]
    .filter((name) => !required.has(name) && !allowed.has(name))
    .sort();
  const staleRequired = [...required].filter((name) => !jobs.has(name)).sort();
  const staleAllowed = [...allowed].filter((name) => !jobs.has(name)).sort();

  if (overlap.length > 0) {
    errors.push(
      `Jobs cannot be both required and allowlisted:\n${quotedList(overlap)}`,
    );
  }
  if (unlisted.length > 0) {
    errors.push(
      `Workflow jobs missing from both manifest and allowlist:\n${quotedList(unlisted)}`,
    );
  }
  if (staleRequired.length > 0) {
    errors.push(
      `Required checks absent from the workflow:\n${quotedList(staleRequired)}`,
    );
  }
  if (staleAllowed.length > 0) {
    errors.push(
      `Allowlisted checks absent from the workflow:\n${quotedList(staleAllowed)}`,
    );
  }

  if (errors.length > 0) {
    console.error("Required checks manifest guard FAILED:\n");
    console.error(errors.join("\n\n"));
    return 1;
  }

  console.log(
    `OK — required checks manifest covers ${jobNames.length} PR jobs ` +
      `(${manifest.length} required, ${allowlist.length} allowlisted).`,
  );
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`Required checks manifest guard FAILED: ${error.message}`);
  process.exitCode = 1;
}
