#!/usr/bin/env node
// @takazudo/zudo-doc/bin/zudo-doc.mjs
//
// Package bin: `zudo-doc eject <component>` swizzle CLI, plus
// `zudo-doc theme list|apply <slug>` (issue #2824; ADR
// docs/adr/theme-packs.md), `zudo-doc eject logo` (issue #3050; epic #3047),
// and the strict `zudo-doc check images` post-build gate (issue #4185).
//
// Self-contained ESM — runs on plain `node` with NO `tsx` requirement. The
// eject, theme-cli, eject-logo, and image-check logic are imported from the
// package's COMPILED `../dist/...` files. The bin never loads package
// TypeScript source or requires `tsx`. This is the key difference from the
// tsx-runner pattern used by `bin/tags-audit.mjs`: tags-audit must load the
// *project's* TypeScript config files at runtime (hence tsx), whereas these
// commands only copy files, rewrite text, or scan already-built HTML.
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
//   zudo-doc check images        # fail when built HTML references a missing asset
//   zudo-doc --help              # show help

import minimist from "minimist";
import pc from "picocolors";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { eject, EJECTABLE } from "../dist/eject/index.js";
import { ejectLogo } from "../dist/eject-logo/index.js";
import { scanImgSrcs } from "../dist/plugins/internal/img-src-check/index.js";
import { applyThemePack, formatThemeList, listThemePacks } from "../dist/theme-cli/index.js";

const argv = minimist(process.argv.slice(2), {
  string: ["allowlist", "base", "dist", "seed"],
  boolean: ["help", "force"],
  alias: { h: "help" },
});

const CHECK_IMAGES_USAGE = `Usage: zudo-doc check images [options]

Options:
  -h, --help              Show this help message
  --dist <dir>            Built HTML directory (default: dist)
  --base <path>           Public URL base (default: /)
  --allowlist <file>      File of <page>:<url> exceptions`;

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
  check images [options]
                       Fail when built HTML references a missing local asset.

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

  ${pc.dim("# Check built HTML for missing local images and assets")}
  zudo-doc check images
`);
}

function printCheckImagesHelp() {
  console.log(CHECK_IMAGES_USAGE);
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

function readImageAllowlist(allowlistPath) {
  if (!allowlistPath) return new Set();

  // Keep this parser in lockstep with scripts/check-links.js: trim each line,
  // ignore blank/comment-only lines, and compare the remaining entries
  // literally. The image checker key is the compact `<page>:<url>` form.
  const path = resolve(process.cwd(), allowlistPath);
  if (!existsSync(path)) return new Set();
  const text = readFileSync(path, "utf8");
  return new Set(
    text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#")),
  );
}

function imageAllowlistKey(reference) {
  return `${reference.pagePath}:${reference.src}`;
}

function runCheckImages(checkArgs) {
  const knownArgvKeys = new Set(["_", "allowlist", "base", "dist", "force", "h", "help"]);
  const unknownOption = Object.keys(argv).find((key) => !knownArgvKeys.has(key));
  const unsupportedOption = unknownOption ?? (argv.force ? "force" : undefined);
  if (unsupportedOption !== undefined) {
    console.error(pc.red(`Unknown option "--${unsupportedOption}".`) + `\n${CHECK_IMAGES_USAGE}`);
    process.exit(1);
  }

  const [unexpected] = checkArgs;
  if (unexpected !== undefined) {
    console.error(pc.red(`Unexpected argument "${unexpected}".`) + `\n${CHECK_IMAGES_USAGE}`);
    process.exit(1);
  }

  const distArg = argv.dist ?? "dist";
  const baseArg = argv.base ?? "/";
  const allowlistArg = argv.allowlist;
  if (typeof distArg !== "string" || distArg.length === 0) {
    console.error(pc.red("Missing value for --dist.") + `\n${CHECK_IMAGES_USAGE}`);
    process.exit(1);
  }
  if (typeof baseArg !== "string" || baseArg.length === 0) {
    console.error(pc.red("Missing value for --base.") + `\n${CHECK_IMAGES_USAGE}`);
    process.exit(1);
  }
  if (allowlistArg !== undefined && (typeof allowlistArg !== "string" || allowlistArg.length === 0)) {
    console.error(pc.red("Missing value for --allowlist.") + `\n${CHECK_IMAGES_USAGE}`);
    process.exit(1);
  }

  const outDir = resolve(process.cwd(), distArg ?? "dist");
  try {
    if (!statSync(outDir).isDirectory()) throw new Error("not a directory");
  } catch {
    console.error(
      pc.red(`Build output directory not found: ${outDir}.`) +
        "\nRun the build first, then run `zudo-doc check images` again.",
    );
    process.exit(1);
  }

  const allowlist = readImageAllowlist(allowlistArg);
  const result = scanImgSrcs({ outDir, base: baseArg });
  const broken = result.broken.filter((reference) => !allowlist.has(imageAllowlistKey(reference)));

  for (const reference of broken) {
    // The CLI's contract is deliberately compact and stable, unlike the
    // plugin logger's prefixed prose.
    const element = reference.element ? `${reference.element} ` : "";
    console.log(`${reference.pagePath}: ${element}${reference.src} (${reference.reason})`);
  }

  if (broken.length > 0) {
    console.log(
      `Found ${broken.length} broken image reference${broken.length === 1 ? "" : "s"} in ${result.htmlFileCount} HTML file${result.htmlFileCount === 1 ? "" : "s"} after allowlist.`,
    );
    process.exit(1);
  }

  const allowlisted = result.broken.length - broken.length;
  const allowlistNote = allowlisted > 0 ? `; ${allowlisted} allowlisted` : "";
  console.log(
    `No broken image references found (${result.htmlFileCount} HTML file${result.htmlFileCount === 1 ? "" : "s"}, ${result.imageCount} local reference${result.imageCount === 1 ? "" : "s"}${allowlistNote}).`,
  );
}

async function main() {
  if (argv._[0] === "check" && argv._[1] === "images" && argv["help"]) {
    printCheckImagesHelp();
    process.exit(0);
  }

  if (argv["help"] || argv._.length === 0) {
    printHelp();
    process.exit(0);
  }

  const [subcommand, ...rest] = argv._;

  if (subcommand === "eject" && rest[0] === "logo") return runEjectLogo();
  if (subcommand === "eject") return runEject(rest[0]);
  if (subcommand === "theme") return runTheme(rest);
  if (subcommand === "check" && rest[0] === "images") return runCheckImages(rest.slice(1));

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
