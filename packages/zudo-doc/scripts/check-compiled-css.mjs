#!/usr/bin/env node
// Regenerate into an isolated output and byte-compare, so prepack rejects a
// stale dist/compiled.css rather than merely checking that it exists.

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertCompiledCss, generateCompiledCss } from "./gen-compiled-css.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expectedPath = resolve(packageRoot, "dist/compiled.css");
const tempRoot = mkdtempSync(resolve(tmpdir(), "zudo-doc-compiled-css-check-"));

try {
  const actualPath = resolve(tempRoot, "compiled.css");
  generateCompiledCss(actualPath);
  const expected = readFileSync(expectedPath);
  const actual = readFileSync(actualPath);
  const bytes = assertCompiledCss(expected.toString("utf8"), { packageRoot });
  if (!expected.equals(actual)) {
    throw new Error(
      "dist/compiled.css is stale; run `pnpm --filter @takazudo/zudo-doc build`",
    );
  }
  process.stdout.write(
    `[check-compiled-css] dist/compiled.css OK (${bytes} bytes)\n`,
  );
} catch (error) {
  process.stderr.write(`\n[check-compiled-css] ERROR: ${error.message}\n\n`);
  process.exitCode = 1;
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
