import { env, exports } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import generatedWorker from "../dist/_worker.js";
import worker, {
  AiChatDailySpendCap,
  aiChatDailySpendCapObjectName,
} from "../worker-entry";

function cap(name: string) {
  return env.AI_CHAT_DAILY_SPEND_CAP.getByName(name);
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
