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

describe("createZudoDoc — contentSignals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const options = {
    projectName: "api-content-signals",
    colorSchemeMode: "single" as const,
    singleScheme: "Default Dark",
    features: [],
    packageManager: "pnpm" as const,
  };

  it("passes valid signals into scaffolding", async () => {
    const contentSignals = { search: true, aiInput: true, aiTrain: false };
    await createZudoDoc({ ...options, contentSignals });
    expect(scaffold).toHaveBeenCalledWith(expect.objectContaining({ contentSignals }));
  });

  it("rejects an invalid shape before scaffolding", async () => {
    await expect(
      createZudoDoc({ ...options, contentSignals: { aiTrain: "no" } as never }),
    ).rejects.toThrow(/"contentSignals.aiTrain" must be a boolean/);
    expect(scaffold).not.toHaveBeenCalled();
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
