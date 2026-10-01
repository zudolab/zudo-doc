#!/usr/bin/env node
// Prepack guard for the copied authored stylesheet.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const dir = dirname(fileURLToPath(import.meta.url));
try {
  const source = readFileSync(resolve(dir, "../src/theme.css"), "utf8");
  const shipped = readFileSync(resolve(dir, "../dist/theme.css"), "utf8");
  if (!source || source !== shipped) throw new Error("dist/theme.css is empty or stale");
  if (/@theme\b|--color-\*:\s*initial/.test(shipped)) throw new Error("Tailwind theme directive remains");
  process.stdout.write(`[check-theme-css] dist/theme.css OK (${Buffer.byteLength(shipped)} bytes)\n`);
} catch (error) {
  process.stderr.write(`[check-theme-css] ${error.message}; rebuild @takazudo/zudo-doc\n`);
  process.exitCode = 1;
}
