import path from "path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { parseArgs, printHelp, validateArgs } from "./cli.js";
import { FEATURES } from "./constants.js";
import { loadPreset } from "./preset.js";
import { runPrompts, type PartialChoices } from "./prompts.js";
import { scaffold } from "./scaffold.js";
import { installDependencies, initGitRepo, pmRunCommand } from "./utils.js";

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

  // Build PartialChoices: preset first, then CLI args override
  const prefilled: PartialChoices = {};

  // Load preset if provided (base layer — CLI flags override below)
  if (args.preset) {
    try {
      const presetChoices = loadPreset(args.preset);
      Object.assign(prefilled, presetChoices);
    } catch (err) {
      p.log.error(
        `Failed to load preset: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  }

  // CLI args override preset values
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
  if (args.githubUrl !== undefined) prefilled.githubUrl = args.githubUrl;

  // Build feature overrides from explicit flags — driven by FEATURES constant
  const featureFlags: Partial<Record<string, boolean>> = {};
  for (const f of FEATURES) {
    const val = args[f.value as keyof typeof args];
    if (val !== undefined) featureFlags[f.value] = val as boolean;
  }
  if (Object.keys(featureFlags).length > 0) {
    prefilled.features = { ...prefilled.features, ...featureFlags };
  }
  // Record which features were explicitly disabled via --no-<flag> so
  // scaffold.ts can warn when an auto-enable overrides that explicit choice.
  const explicitlyDisabled = Object.entries(featureFlags)
    .filter(([, v]) => v === false)
    .map(([k]) => k);
  if (explicitlyDisabled.length > 0) {
    prefilled.explicitlyDisabledFeatures = explicitlyDisabled;
  }

  // With --yes or --preset: fill all unspecified options with defaults
  if (args.yes || args.preset) {
    prefilled.projectName ??= "my-docs";
    prefilled.defaultLang ??= "en";
    prefilled.colorSchemeMode ??= "light-dark";
    if (prefilled.colorSchemeMode === "light-dark") {
      prefilled.lightScheme ??= "Default Light";
      prefilled.darkScheme ??= "Default Dark";
      prefilled.defaultMode ??= "dark";
      prefilled.respectPrefersColorScheme ??= true;
    } else {
      prefilled.singleScheme ??= "Default Dark";
    }
    prefilled.packageManager ??= "pnpm";
    prefilled.githubUrl ??= "";
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
  } else if (args.yes || args.preset) {
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

  // Initialize a git repository (default on; --no-git to opt out). doc-history
  // reads `git log` for each page's Created/Updated/Author block, so a project
  // without git renders empty history. Runs after install so the lockfile is
  // part of the initial commit; auto-skips if the target is already inside a
  // repo or if git is unavailable.
  const shouldInitGit = args.git ?? true;
  if (shouldInitGit) {
    const s3 = p.spinner();
    s3.start("Initializing git repository...");
    const result = initGitRepo(targetDir);
    switch (result.status) {
      case "ok":
        s3.stop("Initialized git repository with an initial commit.");
        break;
      case "skipped-existing-repo":
        s3.stop("Already inside a git repository — skipped git init.");
        break;
      case "skipped-no-git":
        s3.stop("git not found — skipped git init.");
        break;
      case "failed":
        s3.stop("Could not initialize git — continuing without it.");
        break;
    }
  }

  p.outro(
    `${pc.green("Done!")} Your project is ready at ${pc.cyan(choices.projectName)}`,
  );

  console.log();
  console.log(`  ${pc.bold("Next steps:")}`);
  console.log(`  cd ${choices.projectName}`);
  console.log(`  ${pmRunCommand(choices.packageManager, "dev")}`);
  console.log();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
