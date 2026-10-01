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
