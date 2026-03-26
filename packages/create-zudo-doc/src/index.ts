import path from "path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { parseArgs, printHelp, validateArgs } from "./cli.js";
import { FEATURES } from "./constants.js";
import { runPrompts, type PartialChoices } from "./prompts.js";
import { scaffold } from "./scaffold.js";
import { installDependencies } from "./utils.js";

async function main() {
  const args = parseArgs();

  // Handle --help
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Validate args
  const error = validateArgs(args);
  if (error) {
    console.error(pc.red(`Error: ${error}`));
    process.exit(1);
  }

  console.log();
  p.intro(pc.bgCyan(pc.black(" create-zudo-doc ")));

  // Build PartialChoices from CLI args
  const prefilled: PartialChoices = {};

  if (args.name) prefilled.projectName = args.name;
  if (args.lang) prefilled.defaultLang = args.lang;
  if (args.colorSchemeMode) prefilled.colorSchemeMode = args.colorSchemeMode;
  if (args.scheme) {
    prefilled.colorSchemeMode = prefilled.colorSchemeMode ?? "single";
    prefilled.singleScheme = args.scheme;
  }
  if (args.lightScheme) prefilled.lightScheme = args.lightScheme;
  if (args.darkScheme) prefilled.darkScheme = args.darkScheme;
  if (args.defaultMode !== undefined) prefilled.defaultMode = args.defaultMode;
  if (args.respectSystemPreference !== undefined) {
    prefilled.respectPrefersColorScheme = args.respectSystemPreference;
  }
  if (args.pm) prefilled.packageManager = args.pm;

  // Build feature overrides from explicit flags
  const featureFlags: Partial<Record<string, boolean>> = {};
  if (args.i18n !== undefined) featureFlags.i18n = args.i18n;
  if (args.search !== undefined) featureFlags.search = args.search;
  if (args.sidebarFilter !== undefined) featureFlags.sidebarFilter = args.sidebarFilter;
  if (args.colorTweakPanel !== undefined) featureFlags.colorTweakPanel = args.colorTweakPanel;
  if (args.sidebarResizer !== undefined) featureFlags.sidebarResizer = args.sidebarResizer;
  if (args.versioning !== undefined) featureFlags.versioning = args.versioning;
  if (args.claudeResources !== undefined) featureFlags.claudeResources = args.claudeResources;
  if (Object.keys(featureFlags).length > 0) {
    prefilled.features = featureFlags;
  }

  // With --yes: fill all unspecified options with defaults
  if (args.yes) {
    prefilled.projectName ??= "my-docs";
    prefilled.defaultLang ??= "en";
    prefilled.colorSchemeMode ??= "light-dark";
    if (prefilled.colorSchemeMode === "light-dark") {
      prefilled.lightScheme ??= "Default Light";
      prefilled.darkScheme ??= "Default Dark";
      prefilled.defaultMode ??= "dark";
      prefilled.respectPrefersColorScheme ??= true;
    } else {
      prefilled.singleScheme ??= "Dracula";
    }
    prefilled.packageManager ??= "pnpm";
    // For features: set defaults for any not explicitly specified
    const featureDefaults: Partial<Record<string, boolean>> = {};
    for (const f of FEATURES) {
      featureDefaults[f.value] = f.default;
    }
    prefilled.features = { ...featureDefaults, ...prefilled.features };
  }

  const choices = await runPrompts(prefilled);
  const targetDir = path.resolve(process.cwd(), choices.projectName);

  const s = p.spinner();
  s.start("Scaffolding project...");

  try {
    await scaffold(choices);
    s.stop("Project scaffolded!");
  } catch (err) {
    s.stop("Scaffolding failed!");
    p.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Install dependencies
  let shouldInstall: boolean;
  if (args.install !== undefined) {
    shouldInstall = args.install;
  } else if (args.yes) {
    // In non-interactive mode, default to installing dependencies
    shouldInstall = true;
  } else {
    const result = await p.confirm({
      message: "Install dependencies?",
      initialValue: true,
    });

    if (p.isCancel(result)) {
      p.outro(
        `Done! cd ${choices.projectName} and install dependencies manually.`,
      );
      return;
    }
    shouldInstall = result;
  }

  if (shouldInstall) {
    const s2 = p.spinner();
    s2.start(`Installing dependencies with ${choices.packageManager}...`);
    try {
      installDependencies(targetDir, choices.packageManager);
      s2.stop("Dependencies installed!");
    } catch {
      s2.stop("Installation failed. Run install manually.");
    }
  }

  p.outro(
    `${pc.green("Done!")} Your project is ready at ${pc.cyan(choices.projectName)}`,
  );

  console.log();
  console.log(`  ${pc.bold("Next steps:")}`);
  console.log(`  cd ${choices.projectName}`);
  const runCmd =
    choices.packageManager === "npm" ? "npm run" : choices.packageManager;
  console.log(`  ${runCmd} dev`);
  console.log();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
