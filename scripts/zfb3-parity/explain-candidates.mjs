#!/usr/bin/env node
// Run with: node --import tsx scripts/zfb3-parity/explain-candidates.mjs
// An isolated project avoids importing the intentionally red package dist/.
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { packageWindConfig } from "../../packages/zudo-doc/src/wind/index.ts";

const candidates = [
  "bg-bg", "bg-zd-surface", "text-fg", "text-body", "p-hsp-md",
  "gap-vsp-sm", "font-sans", "font-semibold", "leading-none",
  "tracking-wide", "rounded-lg", "shadow-lg", "z-modal",
  "ease-in-out", "opacity-50", "hover:bg-accent", "focus-visible:outline-2",
  "sm:block", "lg:hidden", "xl:flex", "translate-x-1/2",
  "w-[24px]",
];
const root = mkdtempSync(join(tmpdir(), "zudo-wind-explain-"));
try {
  writeFileSync(join(root, "zfb.config.ts"), `export default { wind: ${JSON.stringify(packageWindConfig)} };\n`);
  const cli = resolve("node_modules/.bin/zfb");
  let failures = 0;
  for (const candidate of candidates) {
    const result = spawnSync(cli, ["wind", "explain", candidate, "--project-root", root], { encoding: "utf8" });
    const output = `${result.stdout}${result.stderr}`;
    if (result.status !== 0 || !/outcome: resolved utility/.test(output)) {
      failures++;
      process.stderr.write(`${candidate}: ${output.trim()}\n`);
    } else {
      process.stdout.write(`${candidate}: resolved\n`);
    }
  }
  for (const name of ["theme", "content", "features"]) {
    const input = resolve(`packages/zudo-doc/src/${name}.css`);
    const outputFile = join(root, `${name}.out.css`);
    const result = spawnSync(cli, ["css", "--input", input, "--output", outputFile, "--project-root", root, "--no-auto-source"], { encoding: "utf8" });
    const output = `${result.stdout}${result.stderr}`;
    if (result.status !== 0 || output.includes("ZW009")) {
      failures++;
      process.stderr.write(`${name}.css: ${output.trim()}\n`);
    } else {
      process.stdout.write(`${name}.css: no ZW009\n`);
    }
  }
  process.exitCode = failures ? 1 : 0;
} finally {
  rmSync(root, { recursive: true, force: true });
}
