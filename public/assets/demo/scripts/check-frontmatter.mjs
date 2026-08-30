#!/usr/bin/env node

import { readFileSync } from "node:fs";

const [filePath] = process.argv.slice(2);

if (!filePath) {
  console.error("Usage: check-frontmatter.mjs <markdown-file>");
  process.exitCode = 2;
} else {
  try {
    const fields = readFrontmatter(filePath);
    const required = ["title", "description"];
    const missing = required.filter((field) => !fields.has(field));

    if (missing.length > 0) {
      console.error(`${filePath}: missing ${missing.join(" and ")}`);
      process.exitCode = 1;
    } else {
      console.log(`${filePath}: frontmatter is valid`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${filePath}: ${message}`);
    process.exitCode = 2;
  }
}

/** Read the simple key/value fields this documentation example needs. */
function readFrontmatter(filePath) {
  const source = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = source.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    throw new Error("frontmatter must start with ---");
  }

  const closingLine = lines.findIndex(
    (line, index) => index > 0 && /^(?:---|\.\.\.)\s*$/.test(line.trim()),
  );
  if (closingLine === -1) throw new Error("frontmatter has no closing delimiter");

  const fields = new Map();
  for (const line of lines.slice(1, closingLine)) {
    const match = /^\s*([A-Za-z][\w-]*)\s*:\s*(.*?)\s*$/.exec(line);
    const value = match?.[2]?.replace(/\s+#.*$/, "").trim();
    if (match && value && !/^(['"])\1$/.test(value)) fields.set(match[1], value);
  }
  return fields;
}
