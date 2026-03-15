import minimist from "minimist";
import pc from "picocolors";
import { SINGLE_SCHEMES, SUPPORTED_LANGS } from "./constants.js";

export interface CliArgs {
  name?: string;
  lang?: string;
  colorSchemeMode?: "single" | "light-dark";
  scheme?: string;
  lightScheme?: string;
  darkScheme?: string;
  defaultMode?: "light" | "dark";
  respectSystemPreference?: boolean;
  i18n?: boolean;
  search?: boolean;
  sidebarFilter?: boolean;
  claudeResources?: boolean;
  colorSchemePreview?: boolean;
  pm?: "pnpm" | "npm" | "yarn" | "bun";
  install?: boolean;
  yes?: boolean;
  help?: boolean;
}

export function parseArgs(argv: string[] = process.argv.slice(2)): CliArgs {
  const raw = minimist(argv, {
    string: [
      "name",
      "lang",
      "color-scheme-mode",
      "scheme",
      "light-scheme",
      "dark-scheme",
      "default-mode",
      "pm",
    ],
    // Do NOT declare booleans here — minimist would default them to false,
    // making it impossible to distinguish "not passed" from "--no-flag".
    // Instead we detect explicit usage by checking whether the original argv
    // contains the flag (or its --no- variant).
    alias: {
      h: "help",
      y: "yes",
    },
  });

  /** Check if a boolean flag was explicitly passed in argv. */
  function wasPassed(flag: string): boolean {
    return argv.some(
      (a) => a === `--${flag}` || a === `--no-${flag}`,
    );
  }

  const args: CliArgs = {};

  // Project name: first positional arg or --name
  if (raw.name) {
    args.name = raw.name;
  } else if (raw._.length > 0 && typeof raw._[0] === "string") {
    args.name = raw._[0];
  }

  if (raw.lang) args.lang = raw.lang;
  if (raw["color-scheme-mode"]) args.colorSchemeMode = raw["color-scheme-mode"];
  if (raw.scheme) args.scheme = raw.scheme;
  if (raw["light-scheme"]) args.lightScheme = raw["light-scheme"];
  if (raw["dark-scheme"]) args.darkScheme = raw["dark-scheme"];
  if (raw["default-mode"]) args.defaultMode = raw["default-mode"];
  if (raw.pm) args.pm = raw.pm;

  // Boolean flags — only set if explicitly passed in argv
  if (wasPassed("respect-system-preference")) {
    args.respectSystemPreference = raw["respect-system-preference"] !== false;
  }
  if (wasPassed("i18n")) args.i18n = raw["i18n"] !== false;
  if (wasPassed("search")) args.search = raw["search"] !== false;
  if (wasPassed("sidebar-filter")) {
    args.sidebarFilter = raw["sidebar-filter"] !== false;
  }
  if (wasPassed("claude-resources")) {
    args.claudeResources = raw["claude-resources"] !== false;
  }
  if (wasPassed("color-scheme-preview")) {
    args.colorSchemePreview = raw["color-scheme-preview"] !== false;
  }
  if (wasPassed("install")) args.install = raw["install"] !== false;
  if (raw.yes || raw.y) args.yes = true;
  if (raw.help || raw.h) args.help = true;

  return args;
}

export function printHelp(): void {
  const langList = SUPPORTED_LANGS.map((l) => l.value).join(", ");
  console.log(`
${pc.bold("Usage:")} create-zudo-doc [project-name] [options]

${pc.bold("Options:")}
  --name <name>                Project name (or first positional arg)
  --lang <code>                Default language (${langList})
                               Default: en
  --color-scheme-mode <mode>   single | light-dark
  --scheme <name>              Color scheme (single mode)
  --light-scheme <name>        Light scheme (light-dark mode)
  --dark-scheme <name>         Dark scheme (light-dark mode)
  --default-mode <mode>        light | dark (light-dark mode)
  --[no-]respect-system-preference
                               Respect OS color scheme preference
  --[no-]i18n                  Multi-language support
  --[no-]search                Pagefind full-text search
  --[no-]sidebar-filter        Sidebar filter
  --[no-]claude-resources      Claude Code docs generation
  --[no-]color-scheme-preview  Runtime scheme switcher in header
  --pm <manager>               pnpm | npm | yarn | bun
  --[no-]install               Install dependencies after scaffolding
  -y, --yes                    Use defaults for unspecified options, skip prompts
  -h, --help                   Show this help message

${pc.bold("Examples:")}
  ${pc.dim("# Interactive mode (default)")}
  create-zudo-doc

  ${pc.dim("# Non-interactive with defaults")}
  create-zudo-doc my-docs --yes

  ${pc.dim("# Fully specified")}
  create-zudo-doc my-docs --lang ja --scheme Dracula --no-i18n --pm pnpm --install

  ${pc.dim("# Light/dark mode with custom schemes")}
  create-zudo-doc my-docs --color-scheme-mode light-dark \\
    --light-scheme "GitHub Light" --dark-scheme "GitHub Dark" \\
    --default-mode dark --yes
`);
}

export function validateArgs(args: CliArgs): string | null {
  if (args.lang) {
    const validLangs = SUPPORTED_LANGS.map((l) => l.value);
    if (!validLangs.includes(args.lang)) {
      return `Invalid language "${args.lang}". Supported: ${validLangs.join(", ")}`;
    }
  }

  if (args.colorSchemeMode && !["single", "light-dark"].includes(args.colorSchemeMode)) {
    return `Invalid color-scheme-mode "${args.colorSchemeMode}". Must be "single" or "light-dark"`;
  }

  if (args.scheme && !SINGLE_SCHEMES.includes(args.scheme)) {
    return `Unknown color scheme "${args.scheme}"`;
  }

  if (args.lightScheme && !SINGLE_SCHEMES.includes(args.lightScheme)) {
    return `Unknown light scheme "${args.lightScheme}"`;
  }

  if (args.darkScheme && !SINGLE_SCHEMES.includes(args.darkScheme)) {
    return `Unknown dark scheme "${args.darkScheme}"`;
  }

  if (args.defaultMode && !["light", "dark"].includes(args.defaultMode)) {
    return `Invalid default-mode "${args.defaultMode}". Must be "light" or "dark"`;
  }

  if (args.pm && !["pnpm", "npm", "yarn", "bun"].includes(args.pm)) {
    return `Invalid package manager "${args.pm}". Must be pnpm, npm, yarn, or bun`;
  }

  // Validate scheme combinations
  if (args.colorSchemeMode === "single" && (args.lightScheme || args.darkScheme)) {
    return `--light-scheme and --dark-scheme are only valid with --color-scheme-mode light-dark`;
  }

  if (args.colorSchemeMode === "light-dark" && args.scheme) {
    return `--scheme is only valid with --color-scheme-mode single`;
  }

  if (args.name) {
    if (/^[./]|\.\./.test(args.name)) {
      return "Project name must not contain path traversal characters";
    }
    if (/[<>:"|?*\\]/.test(args.name)) {
      return "Project name contains invalid characters";
    }
  }

  return null;
}
