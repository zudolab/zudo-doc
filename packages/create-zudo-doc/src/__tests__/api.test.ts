import { beforeEach, describe, expect, it, vi } from "vitest";

const scaffoldMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("../scaffold.js", () => ({ scaffold: scaffoldMock }));

import { createZudoDoc } from "../api.js";
import { scaffold } from "../scaffold.js";

describe("createZudoDoc — agent export and MCP choices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes normalized export and Cloudflare choices into scaffolding", async () => {
    await createZudoDoc({
      projectName: "api-mcp-normalization",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["mcp"],
      packageManager: "pnpm",
    });

    expect(scaffold).toHaveBeenCalledWith(
      expect.objectContaining({
        features: expect.arrayContaining(["agentExport", "mcp"]),
        mcpDeploy: "cloudflare",
      }),
    );
  });
});

describe("createZudoDoc — retired Tauri features", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([["tauri"], ["tauriDev"]])("rejects %s before scaffolding", async (feature) => {
    await expect(
      createZudoDoc({
        projectName: "api-retired",
        colorSchemeMode: "single",
        singleScheme: "Default Dark",
        features: ["search", feature],
        packageManager: "pnpm",
      }),
    ).rejects.toThrow(/Tauri desktop app support was retired/);
    expect(scaffold).not.toHaveBeenCalled();
  });
});
