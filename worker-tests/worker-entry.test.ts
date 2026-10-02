import { env, exports } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import generatedWorker from "../dist/_worker.js";
import previewWorker from "../worker-preview-entry";
import worker, {
  AiChatDailySpendCap,
  aiChatDailySpendCapObjectName,
} from "../worker-entry";

function cap(name: string) {
  return env.AI_CHAT_DAILY_SPEND_CAP.getByName(name);
}

const mcpUrl = "https://example.com/mcp";
const previewExecutionContext = {
  waitUntil: (_promise: Promise<unknown>) => undefined,
  passThroughOnException: () => undefined,
  props: {},
} as ExecutionContext;

async function fetchPreview(request: Request): Promise<Response> {
  if (!previewWorker.fetch) throw new TypeError("Preview Worker does not export a fetch handler");
  return previewWorker.fetch(
    request as Parameters<typeof previewWorker.fetch>[0],
    env,
    previewExecutionContext,
  );
}

describe("custom Worker entry", () => {
  it("re-exports the generated adapter handler unchanged", () => {
    expect(worker).toBe(generatedWorker);
    expect(AiChatDailySpendCap).toBeTypeOf("function");
  });

  it("keeps generated static and dynamic route dispatch working", async () => {
    const staticResponse = await exports.default.fetch(
      new Request("https://example.com/robots.txt"),
    );
    expect(staticResponse.status).toBe(200);
    expect(await staticResponse.text()).toContain("User-agent:");

    const manifestResponse = await exports.default.fetch(
      new Request("https://example.com/agent/v1/manifest.json"),
    );
    expect(manifestResponse.status).toBe(200);
    const manifest = (await manifestResponse.json()) as {
      schemaVersion: number;
      site: { base: string };
      items: unknown[];
    };
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      site: { base: "/" },
    });
    expect(manifest.items.length).toBeGreaterThan(0);

    const dynamicResponse = await exports.default.fetch(
      new Request("https://example.com/api/ai-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(dynamicResponse.status).toBe(200);
    expect(dynamicResponse.headers.get("content-type")).toContain("application/json");
    await expect(dynamicResponse.json()).resolves.toEqual({
      response:
        "This feature is disabled on this demo. Need per project setup to enable this.",
    });
  });

  it("serves the stateless MCP protocol through the generated Worker", async () => {
    const client = new Client({ name: "worker-contract", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
      fetch: (input, init) =>
        exports.default.fetch(
          new Request(input, init) as Parameters<typeof exports.default.fetch>[0],
        ),
    });

    try {
      await client.connect(transport);
      const listed = await client.listTools();
      expect(listed.tools.map(({ name }) => name)).toEqual(["search", "fetch"]);

      const search = await client.callTool({
        name: "search",
        arguments: { query: "configuration" },
      });
      expect(search.isError).not.toBe(true);
      const found = (search.structuredContent as {
        results: Array<{ id: string; title: string; url: string }>;
      }).results;
      expect(found.length).toBeGreaterThan(0);

      const fetched = await client.callTool({
        name: "fetch",
        arguments: { id: found[0]!.id },
      });
      expect(fetched.isError).not.toBe(true);
      expect(fetched.structuredContent).toMatchObject({
        id: found[0]!.id,
        url: expect.stringMatching(/^https:\/\/zudo-doc\.takazudomodular\.com\//),
      });
      expect((fetched.structuredContent as { text: string }).text.length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  it("uses the locked MCP method contract", async () => {
    for (const method of ["GET", "HEAD", "DELETE"]) {
      const response = await exports.default.fetch(
        new Request(mcpUrl, { method }),
      );
      expect(response.status).toBe(405);
    }

    const options = await exports.default.fetch(
      new Request(mcpUrl, { method: "OPTIONS" }),
    );
    expect(options.status).toBe(204);
  });

  it("sends preview GET and HEAD to assets and preview POST to the MCP handler", async () => {
    for (const method of ["GET", "HEAD"]) {
      const assetResponse = await fetchPreview(new Request(mcpUrl, { method }));
      expect(assetResponse.status).toBe(404);
    }

    const post = await fetchPreview(
      new Request(mcpUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "preview-contract", version: "1.0.0" },
          },
        }),
      }),
    );
    expect(post.status).toBe(200);
    await expect(post.json()).resolves.toMatchObject({
      result: { serverInfo: { name: "zudo-doc" } },
    });
  });

  it("derives one stable object name per UTC date", () => {
    expect(aiChatDailySpendCapObjectName(new Date("2026-07-16T00:00:00.000Z"))).toBe(
      "ai-chat-daily-spend-cap:2026-07-16",
    );
    expect(aiChatDailySpendCapObjectName(new Date("2026-07-16T23:59:59.999Z"))).toBe(
      "ai-chat-daily-spend-cap:2026-07-16",
    );
    expect(aiChatDailySpendCapObjectName(new Date("2026-07-17T00:00:00.000Z"))).toBe(
      "ai-chat-daily-spend-cap:2026-07-17",
    );
  });
});

describe("AiChatDailySpendCap", () => {
  it("initializes a fresh SQLite object with one counter row", async () => {
    const stub = cap("fresh");

    await expect(stub.admit(3)).resolves.toEqual({ allowed: true, count: 1 });

    await runInDurableObject(stub, async (instance: AiChatDailySpendCap, state) => {
      expect(instance).toBeInstanceOf(AiChatDailySpendCap);
      const rows = state.storage.sql
        .exec<{ id: number; count: number }>(
          "SELECT id, count FROM daily_admission_counter",
        )
        .toArray();
      expect(rows).toEqual([{ id: 1, count: 1 }]);
      expect(state.storage.sql.databaseSize).toBeGreaterThan(0);
    });
  });

  it("admits repeatedly through the limit and then holds the resulting count", async () => {
    const stub = cap("repeated");

    await expect(stub.admit(2)).resolves.toEqual({ allowed: true, count: 1 });
    await expect(stub.admit(2)).resolves.toEqual({ allowed: true, count: 2 });
    await expect(stub.admit(2)).resolves.toEqual({ allowed: false, count: 2 });
    await expect(stub.admit(2)).resolves.toEqual({ allowed: false, count: 2 });
  });

  it("blocks after lowering a limit and resumes up to a raised limit", async () => {
    const stub = cap("limit-changes");

    await expect(stub.admit(4)).resolves.toEqual({ allowed: true, count: 1 });
    await expect(stub.admit(4)).resolves.toEqual({ allowed: true, count: 2 });
    await expect(stub.admit(1)).resolves.toEqual({ allowed: false, count: 2 });
    await expect(stub.admit(3)).resolves.toEqual({ allowed: true, count: 3 });
    await expect(stub.admit(3)).resolves.toEqual({ allowed: false, count: 3 });
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53])(
    "rejects invalid limit %s without creating a counter row",
    async (limit) => {
      const stub = cap(`invalid-${String(limit)}`);

      await runInDurableObject(stub, async (instance: AiChatDailySpendCap, state) => {
        let errorMessage: string | undefined;
        try {
          instance.admit(limit);
        } catch (error) {
          errorMessage = error instanceof Error ? error.message : String(error);
        }
        expect(errorMessage).toBe("limit must be a positive safe integer");

        const rowCount = state.storage.sql
          .exec<{ count: number }>("SELECT COUNT(*) AS count FROM daily_admission_counter")
          .one().count;
        expect(rowCount).toBe(0);
      });
    },
  );

  it("admits exactly N of more-than-N concurrent calls", async () => {
    const stub = cap("concurrent");
    const results = await Promise.all(Array.from({ length: 25 }, () => stub.admit(7)));

    expect(results.filter(({ allowed }) => allowed)).toHaveLength(7);
    expect(results.filter(({ allowed }) => !allowed)).toHaveLength(18);
    expect(results.every(({ count }) => count >= 1 && count <= 7)).toBe(true);
    expect(await stub.admit(7)).toEqual({ allowed: false, count: 7 });
  });

  it("propagates SQLite storage failures without returning an admission", async () => {
    const stub = cap("storage-error");
    await stub.admit(2);

    await runInDurableObject(stub, async (_instance, state) => {
      state.storage.sql.exec(`
        CREATE TRIGGER force_admission_storage_error
        BEFORE UPDATE ON daily_admission_counter
        BEGIN
          SELECT RAISE(ABORT, 'forced admission storage error');
        END
      `);
    });

    const errorMessage = await runInDurableObject(
      stub,
      async (instance: AiChatDailySpendCap) => {
        try {
          instance.admit(2);
          return undefined;
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      },
    );
    expect(errorMessage).toContain("forced admission storage error");
  });
});
