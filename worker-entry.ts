import { DurableObject } from "cloudflare:workers";
import adapterWorker from "./dist/_worker.js";

export interface AiChatDailySpendAdmission {
  allowed: boolean;
  count: number;
}

interface AdmissionRow extends Record<string, SqlStorageValue> {
  allowed: number;
  count: number;
}

const DAILY_COUNTER_ID = 1;

/**
 * Returns the stable Durable Object name for the UTC day containing `now`.
 * Callers may inject the time so rollover behavior is deterministic in tests.
 */
export function aiChatDailySpendCapObjectName(now: Date = new Date()): string {
  return `ai-chat-daily-spend-cap:${now.toISOString().slice(0, 10)}`;
}

/**
 * Exact paid-call admission counter. One object is addressed per UTC day and
 * each object stores exactly one counter row.
 */
export class AiChatDailySpendCap extends DurableObject<Cloudflare.Env> {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS daily_admission_counter (
        id INTEGER PRIMARY KEY CHECK (id = ${DAILY_COUNTER_ID}),
        count INTEGER NOT NULL CHECK (count > 0),
        last_admission_allowed INTEGER NOT NULL CHECK (last_admission_allowed IN (0, 1))
      )
    `);
  }

  admit(limit: number): AiChatDailySpendAdmission {
    if (!Number.isSafeInteger(limit) || limit <= 0) {
      throw new RangeError("limit must be a positive safe integer");
    }

    // SQLite evaluates all SET expressions against the pre-update row. This
    // single conditional mutation therefore records whether this call claimed
    // a slot and returns the resulting count without an awaited read/modify/
    // write sequence. A denied call writes only the result flag; count stays
    // unchanged.
    const row = this.ctx.storage.sql
      .exec<AdmissionRow>(
        `
          INSERT INTO daily_admission_counter (id, count, last_admission_allowed)
          VALUES (?, 1, 1)
          ON CONFLICT (id) DO UPDATE SET
            count = count + CASE WHEN count < ? THEN 1 ELSE 0 END,
            last_admission_allowed = CASE WHEN count < ? THEN 1 ELSE 0 END
          RETURNING count, last_admission_allowed AS allowed
        `,
        DAILY_COUNTER_ID,
        limit,
        limit,
      )
      .one();

    return { allowed: row.allowed === 1, count: row.count };
  }
}

// The adapter owns Assets dispatch and AsyncLocalStorage context propagation.
// Keep its handler object unchanged instead of wrapping or copying it here.
export default adapterWorker;
