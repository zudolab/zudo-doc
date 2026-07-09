#!/usr/bin/env node
// scripts/check-virtual-modules.mjs
//
// Presence guard for the GENERATED virtual-modules.d.ts (built from
// src/routes/_virtual.d.ts by copy-virtual-modules.mjs in the tsup onSuccess
// chain, #2656) — run as a prepack hook so a build that skipped the copy step
// fails loudly instead of publishing a package whose tsconfig.base.json
// `files` reference dangles for consumers. Also asserts the rewritten bare
// specifier landed (a copy without the rewrite would fail consumer tsc).
// Consumer-level regression proof lives in the Wave-5 confirm case
// (zudolab/zudo-doc#2659), which must exercise the self-referencing
// `import("@takazudo/zudo-doc/factory-context")` specifier end-to-end.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(__dirname, "../virtual-modules.d.ts");

let content = "";
try {
  content = readFileSync(FILE, "utf-8");
} catch {
  process.stderr.write(
    `\n[check-virtual-modules] ERROR: virtual-modules.d.ts is missing.\n` +
      `  Run \`pnpm --filter @takazudo/zudo-doc build\` first so the tsup\n` +
      `  onSuccess hook (copy-virtual-modules.mjs) generates it, then retry.\n\n`,
  );
  process.exit(1);
}

const required = [
  'declare module "virtual:zudo-doc-route-context"',
  'declare module "virtual:zudo-doc-chrome-bindings"',
  'import("@takazudo/zudo-doc/factory-context")',
];
for (const needle of required) {
  if (!content.includes(needle)) {
    process.stderr.write(
      `\n[check-virtual-modules] ERROR: virtual-modules.d.ts is missing \`${needle}\`.\n` +
        `  Re-run \`pnpm --filter @takazudo/zudo-doc build\` and check copy-virtual-modules.mjs.\n\n`,
    );
    process.exit(1);
  }
}

process.stdout.write(`[check-virtual-modules] virtual-modules.d.ts OK (${content.length} bytes)\n`);
