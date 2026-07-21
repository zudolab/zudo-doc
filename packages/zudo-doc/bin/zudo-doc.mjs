#!/usr/bin/env node
// @takazudo/zudo-doc/bin/zudo-doc.mjs
//
// Package bin: `zudo-doc eject <component>` swizzle CLI, plus
// `zudo-doc theme list|apply <slug>` (issue #2824; ADR
// docs/adr/theme-packs.md), plus `zudo-doc eject logo` (issue #3050; epic
// #3047).
//
// Self-contained ESM — runs on plain `node` with NO `tsx` requirement. The
// eject, theme-cli, and eject-logo logic are imported from the package's
// COMPILED `../dist/eject/index.js` / `../dist/theme-cli/index.js` /
// `../dist/eject-logo/index.js`, and the only runtime deps are `minimist` +
// `picocolors` (declared deps of this package, so they are present
// transitively in any consumer's node_modules). This is the key difference
// from the tsx-runner pattern used by `bin/tags-audit.mjs`: tags-audit must
// load the *project's* TypeScript config files at runtime (hence tsx),
// whereas eject/theme-cli/eject-logo only copy files / rewrite text — no TS
// eval needed — so all three work in a default generated project that never
// installed tsx (#2367).
//
// `eject logo` is special-cased below, BEFORE the EJECTABLE lookup — it is
// NOT a source-copy swizzle (EJECTABLE's contract), it renders a fresh SVG
// and rewrites a config field, so it does not belong in that map.
//
// Usage:
//   zudo-doc eject <component>   # eject a component's TS source into the project
//   zudo-doc eject logo          # render public/img/logo.svg + rewrite the logo field
//   zudo-doc theme list          # list installed theme packs + the active one
//   zudo-doc theme apply <slug>  # rewrite zfb.config.ts's themePack field
//   zudo-doc --help              # show help

import minimist from "minimist";
import pc from "picocolors";
import { eject, EJECTABLE } from "../dist/eject/index.js";
import { ejectLogo } from "../dist/eject-logo/index.js";
import { applyThemePack, formatThemeList, listThemePacks } from "../dist/theme-cli/index.js";

const argv = minimist(process.argv.slice(2), {
  string: ["seed"],
  boolean: ["help", "force"],
  alias: { h: "help" },
});

function printHelp() {
  const validNames = Object.keys(EJECTABLE).sort().join(", ");
  console.log(`
${pc.bold("Usage:")} zudo-doc <subcommand> [options]

${pc.bold("Subcommands:")}
  eject <component>    Copy a component's TS source into your project and
                       rewrite imports so it resolves locally.
  eject logo [--seed <name>] [--force]
                       Render public/img/logo.svg and rewrite zfb.config.ts's
                       logo field to point at it.
  theme list           List the installed theme packs and which one is active.
  theme apply <slug>   Rewrite zfb.config.ts's themePack field to <slug>.

${pc.bold("Ejectable components:")}
  ${validNames}

${pc.bold("Options:")}
  -h, --help     Show this help message
  --seed <name>  (eject logo) Seed for the generated logo, overriding siteName
  --force        (eject logo) Overwrite an existing public/img/logo.svg

${pc.bold("Examples:")}
  ${pc.dim("# Eject the header component")}
  zudo-doc eject header

  ${pc.dim("# Eject the theme-toggle component")}
  zudo-doc eject theme-toggle

  ${pc.dim("# Eject the logo as a standalone SVG")}
  zudo-doc eject logo

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

async function runEjectLogo() {
  const hasSeedFlag = Object.prototype.hasOwnProperty.call(argv, "seed");
  if (hasSeedFlag && argv.seed.length === 0) {
    console.error(
      pc.red(`Missing value for --seed.`) +
        `\nUsage: zudo-doc eject logo [--seed <name>] [--force]`,
    );
    process.exit(1);
  }

  const result = await ejectLogo({
    cwd: process.cwd(),
    seed: hasSeedFlag ? argv.seed : undefined,
    force: argv.force,
  });

  if (!result.ok) {
    console.error(pc.red(result.message));
    process.exit(1);
  }
  console.log(pc.green(result.message));
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

  if (subcommand === "eject" && rest[0] === "logo") return runEjectLogo();
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
