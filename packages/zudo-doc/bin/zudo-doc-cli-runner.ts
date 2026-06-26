#!/usr/bin/env -S tsx
/**
 * @takazudo/zudo-doc/bin/zudo-doc-cli-runner.ts
 *
 * TypeScript runner for the zudo-doc package bin. Spawned by
 * bin/zudo-doc.mjs via tsx so it can import the eject logic from this
 * package's compiled dist/.
 *
 * This file is published as-is in the package's `bin/` directory.
 * Do NOT compile it — it is only ever run through tsx.
 *
 * Subcommands:
 *   eject <component>   Copy a component's TS source into your project
 */

import minimist from "minimist";
import pc from "picocolors";
import { eject, EJECTABLE } from "@takazudo/zudo-doc/eject";

const argv = minimist(process.argv.slice(2), {
  boolean: ["help"],
  alias: { h: "help" },
});

function printHelp(): void {
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

async function main(): Promise<void> {
  if (argv["help"] || argv._.length === 0) {
    printHelp();
    process.exit(0);
  }

  const [subcommand, componentArg] = argv._ as string[];

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

main().catch((err: unknown) => {
  console.error(pc.red(String(err)));
  process.exit(1);
});
