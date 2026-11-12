import { describe, expect, expectTypeOf, it } from "vitest";
import * as mcp from "../index.js";
import type { McpHandlerOptions, ReadAsset } from "../index.js";

describe("@takazudo/zudo-doc/mcp exports", () => {
  it("keeps the published handler and corpus loader exports", () => {
    expect(mcp.createMcpHandler).toBeTypeOf("function");
    expect(mcp.AgentCorpusLoader).toBeTypeOf("function");
    expect(new mcp.CorpusUnavailable()).toBeInstanceOf(Error);
    expectTypeOf<McpHandlerOptions["read"]>().toEqualTypeOf<ReadAsset>();
  });

  it("adds the discovery helpers beside them", () => {
    expect(Object.keys(mcp).sort()).toEqual([
      "AI_CATALOG_MEDIA_TYPE",
      "AI_CATALOG_SPEC_VERSION",
      "AI_CATALOG_WELL_KNOWN_PATH",
      "AgentCorpusLoader",
      "CorpusUnavailable",
      "MCP_ENDPOINT_PATH",
      "MCP_SERVER_CARD_MEDIA_TYPE",
      "MCP_SERVER_CARD_PATH",
      "MCP_SERVER_CARD_SCHEMA",
      "MCP_SERVER_NAME",
      "MCP_SERVER_VERSION",
      "buildAiCatalog",
      "buildMcpServerCard",
      "createMcpHandler",
      "mcpBasePath",
      "mcpEndpointUrl",
      "mcpPublicOrigin",
      "mcpServerCardUrl",
      "respondWithDiscoveryDocument",
    ]);
  });
});
