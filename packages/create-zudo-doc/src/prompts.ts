import * as p from "@clack/prompts";
import { LIGHT_DARK_PAIRINGS, SINGLE_SCHEMES, FEATURES, SUPPORTED_LANGS } from "./constants.js";
import type { PresetHeaderRightItem } from "./preset.js";

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
  // Features
  features: string[];
  // GitHub repository URL — drives the GitHub link in the header and the
  // "View source on GitHub" link in the body-foot util area. Empty = disabled.
  githubUrl?: string;
  // Enable remark-cjk-friendly plugin (intelligent spacing around CJK text).
  // Preset-only for now — no interactive prompt.
  cjkFriendly?: boolean;
  // Package manager
  packageManager: "pnpm" | "npm" | "yarn" | "bun";
  // Header-right items override. Preset-only — no interactive prompt because
  // the array-of-discriminated-union shape does not fit `--flag` style prompts
  // or CLI args. When omitted, settings-gen.ts emits the existing hardcoded
  // fallback.
  headerRightItems?: PresetHeaderRightItem[];
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
  features?: Partial<Record<string, boolean>>;
  githubUrl?: string;
  cjkFriendly?: boolean;
  packageManager?: "pnpm" | "npm" | "yarn" | "bun";
  headerRightItems?: PresetHeaderRightItem[];
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
        if (!value.trim()) return "Project name is required";
        if (/^[./]|\.\./.test(value))
          return "Project name must not contain path traversal characters";
        if (/[<>:"|?*\\]/.test(value))
          return "Project name contains invalid characters";
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
      const pairingChoice = await p.select({
        message: "Choose a light/dark pairing:",
        options: [
          ...LIGHT_DARK_PAIRINGS.map((pair) => ({
            value: pair.label,
            label: `${pair.light} + ${pair.dark}`,
            hint: pair.label,
          })),
          {
            value: "custom",
            label: "Pick individually",
            hint: "Choose light and dark schemes separately",
          },
        ],
      });
      if (p.isCancel(pairingChoice)) process.exit(0);

      if (pairingChoice === "custom") {
        const lightSchemes = SINGLE_SCHEMES.filter((s) =>
          ["Light", "Latte", "Dawn"].some((k) => s.includes(k)),
        );
        const darkSchemes = SINGLE_SCHEMES.filter(
          (s) => !["Light", "Latte", "Dawn"].some((k) => s.includes(k)),
        );

        const light = await p.select({
          message: "Choose light scheme:",
          options: lightSchemes.map((s) => ({ value: s, label: s })),
        });
        if (p.isCancel(light)) process.exit(0);
        lightScheme = light;

        const dark = await p.select({
          message: "Choose dark scheme:",
          options: darkSchemes.map((s) => ({ value: s, label: s })),
        });
        if (p.isCancel(dark)) process.exit(0);
        darkScheme = dark;
      } else {
        const pairing = LIGHT_DARK_PAIRINGS.find(
          (pair) => pair.label === pairingChoice,
        );
        if (pairing) {
          lightScheme = pairing.light;
          darkScheme = pairing.dark;
        }
      }
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
    features,
    githubUrl,
    cjkFriendly: prefilled.cjkFriendly,
    packageManager,
    headerRightItems: prefilled.headerRightItems,
  };
}
