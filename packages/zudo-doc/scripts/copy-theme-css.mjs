#!/usr/bin/env node
// Copy the authored stylesheet after tsup creates dist/.
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const dir = dirname(fileURLToPath(import.meta.url));
const src = resolve(dir, "../src/theme.css");
const dest = resolve(dir, "../dist/theme.css");
mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
process.stdout.write(`[copy-theme-css] dist/theme.css OK (${statSync(dest).size} bytes)\n`);
