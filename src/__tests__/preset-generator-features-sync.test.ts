import { describe, it, expect } from "vitest";
import { FEATURES as UI_FEATURES } from "../lib/preset-generator-logic";
import { FEATURES as CLI_FEATURES } from "../../packages/create-zudo-doc/src/constants";
import { parseArgs } from "../../packages/create-zudo-doc/src/cli";

describe("FEATURES drift detection", () => {
  it("same count of features in UI and CLI", () => {
    expect(
      UI_FEATURES.length,
      `UI has ${UI_FEATURES.length} features, CLI has ${CLI_FEATURES.length}. Run /l-sync-create-zudo-doc`,
    ).toBe(CLI_FEATURES.length);
  });

  it("same value fields in same order", () => {
    const uiValues = UI_FEATURES.map((f) => f.value);
    const cliValues = CLI_FEATURES.map((f) => f.value);
    expect(uiValues).toEqual(cliValues);
  });

  it("same label fields in same order", () => {
    const uiLabels = UI_FEATURES.map((f) => f.label);
    const cliLabels = CLI_FEATURES.map((f) => f.label);
    expect(uiLabels).toEqual(cliLabels);
  });

  it("same default fields", () => {
    const uiDefaults = UI_FEATURES.map((f) => ({ value: f.value, default: f.default }));
    const cliDefaults = CLI_FEATURES.map((f) => ({ value: f.value, default: f.default }));
    expect(uiDefaults).toEqual(cliDefaults);
  });

  describe("every cliFlag has a working parseArgs handler", () => {
    it.each(UI_FEATURES.map((f) => [f.value, f.cliFlag]))(
      "--%s flag is parsed by CLI",
      (value, cliFlag) => {
        const enabled = parseArgs([`--${cliFlag}`]);
        expect(
          enabled[value as keyof typeof enabled],
          `parseArgs(["--${cliFlag}"]) should set ${value} to true. Did you add wasPassed("${cliFlag}") to cli.ts?`,
        ).toBe(true);

        const disabled = parseArgs([`--no-${cliFlag}`]);
        expect(
          disabled[value as keyof typeof disabled],
          `parseArgs(["--no-${cliFlag}"]) should set ${value} to false`,
        ).toBe(false);
      },
    );
  });
});
