import { describe, it, expect } from "vitest";
import {
  FEATURES,
  buildJson,
  buildCliCommand,
  DEFAULT_HEADER_RIGHT_ITEMS,
  type FormState,
  type HeaderRightItemSpec,
} from "../lib/preset-generator-logic";

function makeState(overrides: Partial<FormState> = {}): FormState {
  return {
    projectName: "my-docs",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    lightScheme: "Default Light",
    darkScheme: "Default Dark",
    defaultMode: "dark",
    respectPrefersColorScheme: true,
    features: [],
    cjkFriendly: false,
    packageManager: "pnpm",
    headerRightItems: [...DEFAULT_HEADER_RIGHT_ITEMS],
    ...overrides,
  };
}

describe("buildJson", () => {
  it("includes projectName, defaultLang, colorSchemeMode, features, packageManager", () => {
    const json = buildJson(makeState());
    expect(json).toHaveProperty("projectName", "my-docs");
    expect(json).toHaveProperty("defaultLang", "en");
    expect(json).toHaveProperty("colorSchemeMode", "single");
    expect(json).toHaveProperty("features");
    expect(json).toHaveProperty("packageManager", "pnpm");
  });

  it("single scheme includes singleScheme, excludes light-dark fields", () => {
    const json = buildJson(makeState({ colorSchemeMode: "single", singleScheme: "Dracula" }));
    expect(json).toHaveProperty("singleScheme", "Dracula");
    expect(json).not.toHaveProperty("lightScheme");
    expect(json).not.toHaveProperty("darkScheme");
    expect(json).not.toHaveProperty("defaultMode");
    expect(json).not.toHaveProperty("respectPrefersColorScheme");
  });

  it("light-dark mode includes scheme fields, excludes singleScheme", () => {
    const json = buildJson(makeState({
      colorSchemeMode: "light-dark",
      lightScheme: "GitHub Light",
      darkScheme: "GitHub Dark",
      defaultMode: "dark",
      respectPrefersColorScheme: false,
    }));
    expect(json).toHaveProperty("lightScheme", "GitHub Light");
    expect(json).toHaveProperty("darkScheme", "GitHub Dark");
    expect(json).toHaveProperty("defaultMode", "dark");
    expect(json).toHaveProperty("respectPrefersColorScheme", false);
    expect(json).not.toHaveProperty("singleScheme");
  });

  it("empty projectName defaults to 'my-docs'", () => {
    const json = buildJson(makeState({ projectName: "" }));
    expect(json.projectName).toBe("my-docs");
  });

  it("features array passes through unchanged", () => {
    const features = ["search", "i18n", "docHistory"];
    const json = buildJson(makeState({ features }));
    expect(json.features).toEqual(features);
  });

  it("empty features array passes through", () => {
    const json = buildJson(makeState({ features: [] }));
    expect(json.features).toEqual([]);
  });

  it("all features enabled", () => {
    const allValues = FEATURES.map((f) => f.value);
    const json = buildJson(makeState({ features: allValues }));
    expect(json.features).toEqual(allValues);
    expect((json.features as string[]).length).toBe(FEATURES.length);
  });
});

describe("buildCliCommand", () => {
  it("starts with pm create zudo-doc projectName", () => {
    const cmd = buildCliCommand(makeState());
    expect(cmd).toMatch(/^pnpm create zudo-doc my-docs /);
  });

  it("includes --lang flag", () => {
    const cmd = buildCliCommand(makeState({ defaultLang: "ja" }));
    expect(cmd).toContain("--lang ja");
  });

  it("single scheme includes --scheme, no light/dark flags", () => {
    const cmd = buildCliCommand(makeState({ colorSchemeMode: "single", singleScheme: "Dracula" }));
    expect(cmd).toContain('--color-scheme-mode single');
    expect(cmd).toContain('--scheme "Dracula"');
    expect(cmd).not.toContain("--light-scheme");
    expect(cmd).not.toContain("--dark-scheme");
    expect(cmd).not.toContain("--default-mode");
    expect(cmd).not.toContain("--respect-system-preference");
    expect(cmd).not.toContain("--no-respect-system-preference");
  });

  it("light-dark mode includes scheme flags", () => {
    const cmd = buildCliCommand(makeState({
      colorSchemeMode: "light-dark",
      lightScheme: "GitHub Light",
      darkScheme: "GitHub Dark",
      defaultMode: "dark",
      respectPrefersColorScheme: true,
    }));
    expect(cmd).toContain('--color-scheme-mode light-dark');
    expect(cmd).toContain('--light-scheme "GitHub Light"');
    expect(cmd).toContain('--dark-scheme "GitHub Dark"');
    expect(cmd).toContain("--default-mode dark");
    expect(cmd).toContain("--respect-system-preference");
  });

  it("respectPrefersColorScheme false produces --no-respect-system-preference", () => {
    const cmd = buildCliCommand(makeState({
      colorSchemeMode: "light-dark",
      respectPrefersColorScheme: false,
    }));
    expect(cmd).toContain("--no-respect-system-preference");
  });

  it.each(FEATURES.map((f) => [f.value, f.cliFlag]))(
    "enabled feature %s produces --%s flag",
    (value, cliFlag) => {
      const cmd = buildCliCommand(makeState({ features: [value] }));
      expect(cmd).toContain(`--${cliFlag}`);
      expect(cmd).not.toContain(`--no-${cliFlag}`);
    },
  );

  it.each(FEATURES.map((f) => [f.value, f.cliFlag]))(
    "disabled feature %s produces --no-%s flag",
    (value, cliFlag) => {
      const cmd = buildCliCommand(makeState({ features: [] }));
      expect(cmd).toContain(`--no-${cliFlag}`);
    },
  );

  it("project name with spaces gets double-quoted", () => {
    const cmd = buildCliCommand(makeState({ projectName: "my docs" }));
    expect(cmd).toContain('"my docs"');
  });

  it("command line ends with --yes (before the trailing comment line)", () => {
    const cmd = buildCliCommand(makeState());
    // The command itself ends with --yes; a documentation comment line about
    // headerRightItems may follow on a separate shell-comment line.
    const firstLine = cmd.split("\n")[0]!;
    expect(firstLine).toMatch(/--yes$/);
  });

  it("includes a trailing # comment about headerRightItems being preset-only", () => {
    const cmd = buildCliCommand(makeState());
    expect(cmd).toContain(
      "# headerRightItems: use a JSON preset (--preset) — array configs are not expressible as CLI flags",
    );
  });

  it("includes --pm flag", () => {
    const cmd = buildCliCommand(makeState({ packageManager: "npm" }));
    expect(cmd).toContain("--pm npm");
  });
});

describe("headerRightItems — DEFAULT_HEADER_RIGHT_ITEMS", () => {
  it("matches the canonical default order from src/config/settings.ts", () => {
    // This is the live default from src/config/settings.ts and the user-facing
    // guide at src/content/docs/guides/header-right-items.mdx. Keep both sides
    // in sync — preset-generator drift here would surprise scaffold users.
    expect(DEFAULT_HEADER_RIGHT_ITEMS).toEqual([
      { kind: "component", name: "version-switcher" },
      { kind: "trigger", name: "design-token-panel" },
      { kind: "trigger", name: "ai-chat" },
      { kind: "component", name: "github-link" },
      { kind: "component", name: "theme-toggle" },
      { kind: "component", name: "search" },
      { kind: "component", name: "language-switcher" },
    ]);
  });
});

describe("buildJson — headerRightItems mapping", () => {
  it("maps {kind: 'component'} → {type: 'component', component: <name>}", () => {
    const items: HeaderRightItemSpec[] = [
      { kind: "component", name: "github-link" },
    ];
    const json = buildJson(makeState({ headerRightItems: items }));
    expect(json.headerRightItems).toEqual([
      { type: "component", component: "github-link" },
    ]);
  });

  it("maps {kind: 'trigger'} → {type: 'trigger', trigger: <name>}", () => {
    const items: HeaderRightItemSpec[] = [
      { kind: "trigger", name: "ai-chat" },
    ];
    const json = buildJson(makeState({ headerRightItems: items }));
    expect(json.headerRightItems).toEqual([
      { type: "trigger", trigger: "ai-chat" },
    ]);
  });

  it("emits the canonical default headerRightItems for the default state", () => {
    const json = buildJson(makeState());
    expect(json.headerRightItems).toEqual([
      { type: "component", component: "version-switcher" },
      { type: "trigger", trigger: "design-token-panel" },
      { type: "trigger", trigger: "ai-chat" },
      { type: "component", component: "github-link" },
      { type: "component", component: "theme-toggle" },
      { type: "component", component: "search" },
      { type: "component", component: "language-switcher" },
    ]);
  });

  it("preserves reordered items in the JSON output", () => {
    const reordered: HeaderRightItemSpec[] = [
      { kind: "component", name: "theme-toggle" },
      { kind: "component", name: "github-link" },
      { kind: "trigger", name: "design-token-panel" },
    ];
    const json = buildJson(makeState({ headerRightItems: reordered }));
    expect(json.headerRightItems).toEqual([
      { type: "component", component: "theme-toggle" },
      { type: "component", component: "github-link" },
      { type: "trigger", trigger: "design-token-panel" },
    ]);
  });

  it("emits headerRightItems even when it equals the default (always present)", () => {
    const json = buildJson(makeState());
    expect(json).toHaveProperty("headerRightItems");
  });
});
