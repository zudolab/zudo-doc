// Guards against the tracked migration (migrations/0001_better_auth.sql)
// drifting from the GENERATED src/auth-schema.ts — a stale migration would
// otherwise pass every other test since createAuth() only touches columns
// Better Auth itself reads/writes.
import { env } from "cloudflare:test";
import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "../auth-schema";

const TABLES = {
  user: schema.user,
  session: schema.session,
  account: schema.account,
  verification: schema.verification,
} as const;

describe("Better Auth schema parity (auth-schema.ts vs. migrated D1 database)", () => {
  for (const [key, table] of Object.entries(TABLES)) {
    it(`"${key}" table and all its columns exist in the migrated database`, async () => {
      const tableName = getTableName(table);
      const { results } = await env.DB.prepare(`PRAGMA table_info("${tableName}")`).all<{
        name: string;
      }>();

      expect(results.length).toBeGreaterThan(0);

      const dbColumnNames = new Set(results.map((row) => row.name));
      const schemaColumnNames = Object.values(getTableColumns(table)).map((column) => column.name);

      for (const columnName of schemaColumnNames) {
        expect(dbColumnNames.has(columnName)).toBe(true);
      }
    });
  }
});
