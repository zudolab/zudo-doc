import { describe, it, expect } from "vitest";
import { FEATURES, buildCliCommand, type FormState } from "../lib/preset-generator-logic";
import { parseArgs } from "../../packages/create-zudo-doc/src/cli";

/**
 * Split a CLI command string (as produced by buildCliCommand) into an argv
 * array, correctly handling double-quoted arguments.
 * Strips the leading "{pm} create zudo-doc" prefix (3 tokens).
 */
function cliCommandToArgv(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const ch of command) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === " " && !inQuotes) {
      if (current) tokens.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);

  // Strip prefix: "{pm} create zudo-doc" = 3 tokens
  return tokens.slice(3);
}

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
    features: FEATURES.filter((f) => f.default).map((f) => f.value),
    packageManager: "pnpm",
    ...overrides,
  };
}

function verifyRoundtrip(state: FormState) {
  const command = buildCliCommand(state);
  const argv = cliCommandToArgv(command);
  const parsed = parseArgs(argv);

  expect(parsed.name).toBe(state.projectName || "my-docs");
  expect(parsed.lang).toBe(state.defaultLang);
  expect(parsed.colorSchemeMode).toBe(state.colorSchemeMode);
  expect(parsed.pm).toBe(state.packageManager);
  expect(parsed.yes).toBe(true);

  for (const f of FEATURES) {
    const expected = state.features.includes(f.value);
    expect(
      parsed[f.value as keyof typeof parsed],
      `Feature ${f.value} (--${f.cliFlag}): expected ${expected}`,
    ).toBe(expected);
  }
}

describe("roundtrip: buildCliCommand → parseArgs", () => {
  it("default state (search + sidebarFilter on)", () => {
    verifyRoundtrip(makeState());
  });

  it("all features enabled, single scheme", () => {
    verifyRoundtrip(makeState({
      features: FEATURES.map((f) => f.value),
      colorSchemeMode: "single",
      singleScheme: "Dracula",
    }));
  });

  it("all features disabled, light-dark scheme", () => {
    verifyRoundtrip(makeState({
      features: [],
      colorSchemeMode: "light-dark",
      lightScheme: "GitHub Light",
      darkScheme: "GitHub Dark",
    }));
  });

  it("mixed features", () => {
    const half = FEATURES.slice(0, 7).map((f) => f.value);
    verifyRoundtrip(makeState({ features: half }));
  });

  it("project name with spaces", () => {
    verifyRoundtrip(makeState({ projectName: "my cool docs" }));
  });

  describe("each feature individually", () => {
    it.each(FEATURES.map((f) => [f.value, f.cliFlag]))(
      "only %s enabled roundtrips correctly",
      (value) => {
        verifyRoundtrip(makeState({ features: [value] }));
      },
    );
  });
});
