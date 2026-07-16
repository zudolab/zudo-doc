#!/usr/bin/env node
// @takazudo/zudo-doc/bin/zudo-doc.mjs
//
// Package bin: `zudo-doc eject <component>` swizzle CLI, plus
// `zudo-doc theme list|apply <slug>` (issue #2824; ADR
// docs/adr/theme-packs.md).
//
// Self-contained ESM — runs on plain `node` with NO `tsx` requirement. Both
// the eject and theme-cli logic are imported from the package's COMPILED
// `../dist/eject/index.js` / `../dist/theme-cli/index.js`, and the only
// runtime deps are `minimist` + `picocolors` (declared deps of this package,
// so they are present transitively in any consumer's node_modules). This is
// the key difference from the tsx-runner pattern used by `bin/tags-audit.mjs`:
// tags-audit must load the *project's* TypeScript config files at runtime (hence
// tsx), whereas eject/theme-cli only copy files / rewrite text — no TS eval
// needed — so both work in a default generated project that never installed
// tsx (#2367).
//
// Usage:
//   zudo-doc eject <component>   # eject a component's TS source into the project
//   zudo-doc theme list          # list installed theme packs + the active one
//   zudo-doc theme apply <slug>  # rewrite zfb.config.ts's themePack field
//   zudo-doc --help              # show help

import minimist from "minimist";
import pc from "picocolors";
import { eject, EJECTABLE } from "../dist/eject/index.js";
import { applyThemePack, formatThemeList, listThemePacks } from "../dist/theme-cli/index.js";

const argv = minimist(process.argv.slice(2), {
  boolean: ["help"],
  alias: { h: "help" },
});

function printHelp() {
  const validNames = Object.keys(EJECTABLE).sort().join(", ");
  console.log(`
${pc.bold("Usage:")} zudo-doc <subcommand> [options]

${pc.bold("Subcommands:")}
  eject <component>    Copy a component's TS source into your project and
                       rewrite imports so it resolves locally.
  theme list           List the installed theme packs and which one is active.
  theme apply <slug>   Rewrite zfb.config.ts's themePack field to <slug>.

${pc.bold("Ejectable components:")}
  ${validNames}

${pc.bold("Options:")}
  -h, --help   Show this help message

${pc.bold("Examples:")}
  ${pc.dim("# Eject the header component")}
  zudo-doc eject header

  ${pc.dim("# Eject the theme-toggle component")}
  zudo-doc eject theme-toggle

  ${pc.dim("# List installed theme packs")}
  zudo-doc theme list

  ${pc.dim("# Switch to the foundry theme pack")}
  zudo-doc theme apply foundry
`);
}

async function runEject(componentArg) {
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

async function runThemeList() {
  const result = await listThemePacks({ cwd: process.cwd() });
  console.log(formatThemeList(result));
}

async function runThemeApply(slugArg) {
  if (!slugArg) {
    console.error(
      pc.red(`Missing theme pack slug.`) + `\nUsage: zudo-doc theme apply <slug>`,
    );
    process.exit(1);
  }

  const result = await applyThemePack(slugArg, { cwd: process.cwd() });
  if (!result.ok) {
    console.error(pc.red(result.message));
    process.exit(1);
  }
  console.log(pc.green(result.message));
}

async function runTheme(themeArgs) {
  const [action, arg] = themeArgs;

  if (action === "list") return runThemeList();
  if (action === "apply") return runThemeApply(arg);

  console.error(
    pc.red(`Unknown "theme" action "${action}".`) +
      `\nUsage: zudo-doc theme list` +
      `\n       zudo-doc theme apply <slug>`,
  );
  process.exit(1);
}

async function main() {
  if (argv["help"] || argv._.length === 0) {
    printHelp();
    process.exit(0);
  }

  const [subcommand, ...rest] = argv._;

  if (subcommand === "eject") return runEject(rest[0]);
  if (subcommand === "theme") return runTheme(rest);

  console.error(
    pc.red(`Unknown subcommand "${subcommand}".`) +
      `\nRun \`zudo-doc --help\` for usage.`,
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(pc.red(String(err)));
  process.exit(1);
});
