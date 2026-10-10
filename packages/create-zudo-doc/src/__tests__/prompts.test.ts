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
      themePack: "default",
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
        themePack: "default",
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
