import { beforeEach, describe, expect, it, vi } from "vitest";

const promptMocks = vi.hoisted(() => ({
  select: vi.fn(),
  multiselect: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@clack/prompts", () => ({
  select: promptMocks.select,
  multiselect: promptMocks.multiselect,
  isCancel: () => false,
  log: { info: promptMocks.info },
}));

import { runPrompts } from "../prompts.js";

describe("runPrompts — theme pack", () => {
  beforeEach(() => {
    promptMocks.select.mockReset().mockResolvedValue("graphite");
    promptMocks.multiselect.mockReset();
    promptMocks.info.mockReset();
  });

  it('describes "default" as an alias of Graphite and Classic as "classic"', async () => {
    const choices = await runPrompts({
      projectName: "my-docs",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: {},
      packageManager: "pnpm",
      githubUrl: "",
    });

    expect(choices.themePack).toBe("graphite");
    expect(promptMocks.select).toHaveBeenCalledTimes(1);
    const prompt = promptMocks.select.mock.calls[0]?.[0] as {
      message: string;
      options: Array<{ value: string; label: string; hint: string }>;
    };
    expect(prompt.message).toContain('"default" is an alias of Graphite');
    expect(prompt.message).toContain('Classic is "classic"');
    expect(prompt.message).not.toContain('"default" = Classic');
    const graphite = prompt.options.find((option) => option.value === "graphite");
    const classic = prompt.options.find((option) => option.value === "classic");
    expect(graphite?.hint).toContain('"default" is an alias of Graphite');
    expect(classic?.hint).toContain('slug "classic"');
  });
});

describe("runPrompts — agent export and MCP", () => {
  beforeEach(() => {
    promptMocks.select.mockReset().mockResolvedValue("cloudflare");
    promptMocks.multiselect.mockReset().mockResolvedValue(["mcp"]);
    promptMocks.info.mockReset();
  });

  it("visibly enables agent export and asks for the Cloudflare preset", async () => {
    const choices = await runPrompts({
      projectName: "my-docs",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      themePack: "classic",
      packageManager: "pnpm",
      githubUrl: "",
    });

    expect(choices.features).toEqual(["agentExport", "mcp"]);
    expect(choices.mcpDeploy).toBe("cloudflare");
    expect(promptMocks.select).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "MCP deployment preset:",
        options: [
          expect.objectContaining({ value: "cloudflare" }),
        ],
      }),
    );
    expect(promptMocks.info).toHaveBeenCalledWith(
      expect.stringContaining("enabling the static agent-readable documentation export"),
    );
  });

  it("rejects a CLI-disabled export before asking for an MCP deployment", async () => {
    await expect(
      runPrompts({
        projectName: "my-docs",
        defaultLang: "en",
        colorSchemeMode: "single",
        singleScheme: "Default Dark",
        themePack: "classic",
        packageManager: "pnpm",
        githubUrl: "",
        features: { mcp: true },
        explicitlyDisabledFeatures: ["agentExport"],
      }),
    ).rejects.toThrow(
      "MCP requires agentExport: true. Remove the explicit agent export disable or disable MCP.",
    );
    expect(promptMocks.select).not.toHaveBeenCalled();
  });
});
