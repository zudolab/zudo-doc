import * as p from "@clack/prompts";
import { SINGLE_SCHEMES, FEATURES, SUPPORTED_LANGS, THEME_PACKS } from "./constants.js";
import type { PresetHeaderRightItem, PresetMetaTagsConfig } from "./preset.js";
import { validateProjectName } from "./utils.js";

export interface UserChoices {
  projectName: string;
  defaultLang: string;
  colorSchemeMode: "single" | "light-dark";
  // For single mode
  singleScheme?: string;
  // For light/dark mode
  lightScheme?: string;
  darkScheme?: string;
  respectPrefersColorScheme?: boolean;
  defaultMode?: "light" | "dark";
  // Theme pack slug (ADR #2818 Decision 7). "default" = the stock look.
  themePack?: string;
  // Features
  features: string[];
  // Feature values explicitly disabled via --no-<flag> on the CLI. Used to
  // emit a warning when an auto-enable (e.g. bodyFootUtil forces docHistory)
  // overrides an explicit user choice. Never populated by interactive prompts.
  explicitlyDisabledFeatures?: string[];
  // GitHub repository URL — drives the GitHub link in the header and the
  // "View source on GitHub" link in the body-foot util area. Empty = disabled.
  githubUrl?: string;
  // Enable remark-cjk-friendly plugin (intelligent spacing around CJK text).
  // Preset-only for now — no interactive prompt.
  cjkFriendly?: boolean;
  // Minify production HTML output. Preset-only for now; generated projects
  // default to true and can override it in zfb.config.ts later.
  minifyHtml?: boolean;
  // Package manager
  packageManager: "pnpm" | "npm" | "yarn" | "bun";
  // Header-right items override. Preset-only — no interactive prompt because
  // the array-of-discriminated-union shape does not fit `--flag` style prompts
  // or CLI args. When omitted, zfb-config-gen.ts keeps the package default.
  headerRightItems?: PresetHeaderRightItem[];
  // Meta tags config. Preset-only — no interactive prompt.
  // When omitted, zfb-config-gen.ts keeps the package defaults.
  metaTags?: PresetMetaTagsConfig;
}

export interface PartialChoices {
  projectName?: string;
  defaultLang?: string;
  colorSchemeMode?: "single" | "light-dark";
  singleScheme?: string;
  lightScheme?: string;
  darkScheme?: string;
  respectPrefersColorScheme?: boolean;
  defaultMode?: "light" | "dark";
  themePack?: string;
  features?: Partial<Record<string, boolean>>;
  // Feature values explicitly disabled via --no-<flag> on the CLI. Threaded
  // through to UserChoices so scaffold.ts can warn on forced auto-enables.
  explicitlyDisabledFeatures?: string[];
  githubUrl?: string;
  cjkFriendly?: boolean;
  minifyHtml?: boolean;
  packageManager?: "pnpm" | "npm" | "yarn" | "bun";
  headerRightItems?: PresetHeaderRightItem[];
  // Meta tags config. Preset-only — no interactive prompt.
  metaTags?: PresetMetaTagsConfig;
}

export async function runPrompts(
  prefilled: PartialChoices = {},
): Promise<UserChoices> {
  // 1. Project name
  let projectName: string;
  if (prefilled.projectName) {
    projectName = prefilled.projectName;
  } else {
    const result = await p.text({
      message: "What is your project name?",
      placeholder: "my-docs",
      defaultValue: "my-docs",
      validate(value) {
        return validateProjectName(value) ?? undefined;
      },
    });
    if (p.isCancel(result)) process.exit(0);
    projectName = result;
  }

  // 2. Default language
  let defaultLang: string;
  if (prefilled.defaultLang) {
    defaultLang = prefilled.defaultLang;
  } else {
    const result = await p.select({
      message: "Default language:",
      options: SUPPORTED_LANGS.map((l) => ({
        value: l.value,
        label: `${l.label} (${l.value})`,
      })),
      initialValue: "en",
    });
    if (p.isCancel(result)) process.exit(0);
    defaultLang = result;
  }

  // 3. Color scheme mode
  let colorSchemeMode: "single" | "light-dark";
  if (prefilled.colorSchemeMode) {
    colorSchemeMode = prefilled.colorSchemeMode;
  } else {
    const result = await p.select({
      message: "Color scheme mode:",
      options: [
        {
          value: "light-dark" as const,
          label: "Light & Dark (toggle)",
          hint: "Users can switch between light and dark themes",
        },
        {
          value: "single" as const,
          label: "Single scheme",
          hint: "One color scheme for the entire site",
        },
      ],
    });
    if (p.isCancel(result)) process.exit(0);
    colorSchemeMode = result;
  }

  let singleScheme: string | undefined;
  let lightScheme: string | undefined;
  let darkScheme: string | undefined;
  let respectPrefersColorScheme = prefilled.respectPrefersColorScheme ?? true;
  let defaultMode: "light" | "dark" = prefilled.defaultMode ?? "dark";

  if (colorSchemeMode === "single") {
    if (prefilled.singleScheme) {
      singleScheme = prefilled.singleScheme;
    } else {
      const scheme = await p.select({
        message: "Choose a color scheme:",
        options: SINGLE_SCHEMES.map((s) => ({ value: s, label: s })),
      });
      if (p.isCancel(scheme)) process.exit(0);
      singleScheme = scheme;
    }
  } else {
    if (prefilled.lightScheme && prefilled.darkScheme) {
      lightScheme = prefilled.lightScheme;
      darkScheme = prefilled.darkScheme;
    } else {
      // Only the Default pairing exists — auto-assign, no prompt.
      lightScheme = "Default Light";
      darkScheme = "Default Dark";
    }

    // Default mode
    if (prefilled.defaultMode === undefined) {
      const modeResult = await p.select({
        message: "Default color mode:",
        options: [
          {
            value: "dark" as const,
            label: "Dark",
            hint: "Start in dark mode",
          },
          {
            value: "light" as const,
            label: "Light",
            hint: "Start in light mode",
          },
        ],
      });
      if (p.isCancel(modeResult)) process.exit(0);
      defaultMode = modeResult;
    }

    // Respect system preference
    if (prefilled.respectPrefersColorScheme === undefined) {
      const respect = await p.confirm({
        message: "Respect system color scheme preference?",
        initialValue: true,
      });
      if (p.isCancel(respect)) process.exit(0);
      respectPrefersColorScheme = respect;
    }
  }

  // 3.5 Theme pack (ADR #2818 Decision 7) — placed between the color-scheme
  // block above and the features multiselect below (locked spec, #2823).
  let themePack: string;
  if (prefilled.themePack) {
    themePack = prefilled.themePack;
  } else {
    const result = await p.select({
      message: "Theme pack:",
      options: THEME_PACKS.map((t) => ({
        value: t.slug,
        label: t.label,
        hint: t.hint,
      })),
      initialValue: "default",
    });
    if (p.isCancel(result)) process.exit(0);
    themePack = result;
  }

  // 4. Features
  let features: string[];
  if (prefilled.features) {
    // Build features from explicit overrides + defaults
    features = FEATURES.filter((f) => {
      if (f.value in prefilled.features!) {
        return prefilled.features![f.value];
      }
      return f.default;
    }).map((f) => f.value);
  } else {
    const result = await p.multiselect({
      message: "Include extra features:",
      options: FEATURES.map((f) => ({
        value: f.value,
        label: f.label,
        hint: f.hint,
      })),
      initialValues: FEATURES.filter((f) => f.default).map((f) => f.value),
      required: false,
    });
    if (p.isCancel(result)) process.exit(0);
    features = result;
  }

  // 5. GitHub URL (drives header GitHub icon + view-source link)
  let githubUrl: string | undefined = prefilled.githubUrl;
  if (githubUrl === undefined) {
    const result = await p.text({
      message: "GitHub repository URL (optional, leave blank to disable):",
      placeholder: "https://github.com/you/your-repo",
      defaultValue: "",
      validate(value) {
        if (!value) return;
        if (!/^https?:\/\//.test(value))
          return "URL must start with http(s)://";
      },
    });
    if (p.isCancel(result)) process.exit(0);
    githubUrl = result;
  }

  // 6. Package manager
  let packageManager: "pnpm" | "npm" | "yarn" | "bun";
  if (prefilled.packageManager) {
    packageManager = prefilled.packageManager;
  } else {
    const result = await p.select({
      message: "Package manager:",
      options: [
        { value: "pnpm" as const, label: "pnpm", hint: "Recommended" },
        { value: "npm" as const, label: "npm" },
        { value: "yarn" as const, label: "yarn" },
        { value: "bun" as const, label: "bun" },
      ],
    });
    if (p.isCancel(result)) process.exit(0);
    packageManager = result;
  }

  return {
    projectName,
    defaultLang,
    colorSchemeMode,
    singleScheme,
    lightScheme,
    darkScheme,
    respectPrefersColorScheme,
    defaultMode,
    themePack,
    features,
    explicitlyDisabledFeatures: prefilled.explicitlyDisabledFeatures,
    githubUrl,
    cjkFriendly: prefilled.cjkFriendly,
    minifyHtml: prefilled.minifyHtml,
    packageManager,
    headerRightItems: prefilled.headerRightItems,
    metaTags: prefilled.metaTags,
  };
}
