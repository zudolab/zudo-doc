#!/usr/bin/env node
// @takazudo/zudo-doc/bin/zudo-doc.mjs
//
// Package bin: `zudo-doc eject <component>` swizzle CLI.
//
// Self-contained ESM — runs on plain `node` with NO `tsx` requirement. The eject
// logic is imported from the package's COMPILED `../dist/eject/index.js`, and the
// only runtime deps are `minimist` + `picocolors` (declared deps of this package,
// so they are present transitively in any consumer's node_modules). This is the
// key difference from the tsx-runner pattern used by `bin/tags-audit.mjs`:
// tags-audit must load the *project's* TypeScript config files at runtime (hence
// tsx), whereas eject only copies files + rewrites imports — no TS eval needed —
// so it works in a default generated project that never installed tsx (#2367).
//
// Usage:
//   zudo-doc eject <component>   # eject a component's TS source into the project
//   zudo-doc --help              # show help

import minimist from "minimist";
import pc from "picocolors";
import { eject, EJECTABLE } from "../dist/eject/index.js";

const argv = minimist(process.argv.slice(2), {
  boolean: ["help"],
  alias: { h: "help" },
});

function printHelp() {
  const validNames = Object.keys(EJECTABLE).sort().join(", ");
  console.log(`
${pc.bold("Usage:")} zudo-doc <subcommand> [options]

${pc.bold("Subcommands:")}
  eject <component>   Copy a component's TS source into your project and
                      rewrite imports so it resolves locally.

${pc.bold("Ejectable components:")}
  ${validNames}

${pc.bold("Options:")}
  -h, --help   Show this help message

${pc.bold("Examples:")}
  ${pc.dim("# Eject the header component")}
  zudo-doc eject header

  ${pc.dim("# Eject the theme-toggle component")}
  zudo-doc eject theme-toggle
`);
}

async function main() {
  if (argv["help"] || argv._.length === 0) {
    printHelp();
    process.exit(0);
  }

  const [subcommand, componentArg] = argv._;

  if (subcommand !== "eject") {
    console.error(
      pc.red(`Unknown subcommand "${subcommand}".`) +
        `\nRun \`zudo-doc --help\` for usage.`,
    );
    process.exit(1);
  }

  if (!componentArg) {
    console.error(
      pc.red(`Missing component name.`) +
        `\nUsage: zudo-doc eject <component>` +
        `\nRun \`zudo-doc --help\` for the list of ejectable components.`,
    );
    process.exit(1);
  }

  await eject(componentArg, { cwd: process.cwd() });
}

main().catch((err) => {
  console.error(pc.red(String(err)));
  process.exit(1);
});
