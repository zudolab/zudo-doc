import * as p from "@clack/prompts";
import { LIGHT_DARK_PAIRINGS, SINGLE_SCHEMES, FEATURES } from "./constants.js";

export interface UserChoices {
  projectName: string;
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
  // Package manager
  packageManager: "pnpm" | "npm" | "yarn" | "bun";
}

export async function runPrompts(): Promise<UserChoices> {
  // 1. Project name
  const projectName = await p.text({
    message: "What is your project name?",
    placeholder: "my-docs",
    defaultValue: "my-docs",
    validate(value) {
      if (!value.trim()) return "Project name is required";
      if (/^[./]|\.\./.test(value)) return "Project name must not contain path traversal characters";
      if (/[<>:"|?*\\]/.test(value)) return "Project name contains invalid characters";
    },
  });
  if (p.isCancel(projectName)) process.exit(0);

  // 2. Color scheme mode
  const colorSchemeMode = await p.select({
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
  if (p.isCancel(colorSchemeMode)) process.exit(0);

  let singleScheme: string | undefined;
  let lightScheme: string | undefined;
  let darkScheme: string | undefined;
  let respectPrefersColorScheme = true;
  let defaultMode: "light" | "dark" = "dark";

  if (colorSchemeMode === "single") {
    // 2b. Single scheme selection
    const scheme = await p.select({
      message: "Choose a color scheme:",
      options: SINGLE_SCHEMES.map((s) => ({ value: s, label: s })),
    });
    if (p.isCancel(scheme)) process.exit(0);
    singleScheme = scheme;
  } else {
    // 2a. Light/dark pairing selection
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

    // Default mode
    const modeResult = await p.select({
      message: "Default color mode:",
      options: [
        { value: "dark" as const, label: "Dark", hint: "Start in dark mode" },
        {
          value: "light" as const,
          label: "Light",
          hint: "Start in light mode",
        },
      ],
    });
    if (p.isCancel(modeResult)) process.exit(0);
    defaultMode = modeResult;

    // Respect system preference
    const respect = await p.confirm({
      message: "Respect system color scheme preference?",
      initialValue: true,
    });
    if (p.isCancel(respect)) process.exit(0);
    respectPrefersColorScheme = respect;
  }

  // 3. Features
  const features = await p.multiselect({
    message: "Include extra features:",
    options: FEATURES.map((f) => ({
      value: f.value,
      label: f.label,
      hint: f.hint,
    })),
    initialValues: FEATURES.filter((f) => f.default).map((f) => f.value),
    required: false,
  });
  if (p.isCancel(features)) process.exit(0);

  // 4. Package manager
  const packageManager = await p.select({
    message: "Package manager:",
    options: [
      { value: "pnpm" as const, label: "pnpm", hint: "Recommended" },
      { value: "npm" as const, label: "npm" },
      { value: "yarn" as const, label: "yarn" },
      { value: "bun" as const, label: "bun" },
    ],
  });
  if (p.isCancel(packageManager)) process.exit(0);

  return {
    projectName,
    colorSchemeMode,
    singleScheme,
    lightScheme,
    darkScheme,
    respectPrefersColorScheme,
    defaultMode,
    features,
    packageManager,
  };
}
