import type {
  AiChatDailySpendAdmission,
  AiChatEnv,
} from "./_ai-chat-types";

const MS_PER_DAY = 86_400_000;

/** Stable Durable Object name for the UTC day containing `now`. */
export function aiChatDailySpendCapObjectName(now: Date = new Date()): string {
  return `ai-chat-daily-spend-cap:${now.toISOString().slice(0, 10)}`;
}

/** Seconds until the next UTC day, suitable for Retry-After. */
export function secondsUntilNextUtcDay(now: Date = new Date()): number {
  const millisecondsIntoDay = now.getTime() % MS_PER_DAY;
  return Math.max(1, Math.ceil((MS_PER_DAY - millisecondsIntoDay) / 1000));
}

/**
 * Claims one exact paid-call admission for the current UTC day.
 *
 * Every configuration/binding/RPC failure throws so the non-demo handler can
 * fail closed. A successful admission is never refunded by this layer.
 */
export async function admitAiChatPaidCall(
  limit: number,
  env: AiChatEnv,
  now: Date = new Date(),
): Promise<AiChatDailySpendAdmission> {
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new RangeError("aiChatGlobalDailyLimit must be a positive safe integer or false");
  }

  const namespace = env.AI_CHAT_DAILY_SPEND_CAP;
  if (!namespace || typeof namespace.getByName !== "function") {
    throw new Error("AI_CHAT_DAILY_SPEND_CAP binding is unavailable");
  }

  const stub = namespace.getByName(aiChatDailySpendCapObjectName(now));
  if (!stub || typeof stub.admit !== "function") {
    throw new Error("AI_CHAT_DAILY_SPEND_CAP RPC stub is unavailable");
  }

  const result = await stub.admit(limit);
  if (
    typeof result !== "object" ||
    result === null ||
    typeof result.allowed !== "boolean" ||
    !Number.isSafeInteger(result.count) ||
    result.count < 1
  ) {
    throw new Error("AI_CHAT_DAILY_SPEND_CAP returned an invalid admission result");
  }

  return result;
}
