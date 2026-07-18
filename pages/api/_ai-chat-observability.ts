export type AiChatOperationalOutcome = "admitted" | "denied" | "failed_closed";

interface ExactAdmissionLog {
  event: "ai_chat_paid_call_admission";
  guard: "exact_global_daily_cap";
  outcome: AiChatOperationalOutcome;
  utc_day: string;
  configured_limit: number;
  admitted_count?: number;
}

interface PerIpGuardLog {
  event: "ai_chat_request_guard";
  guard: "per_ip_kv";
  outcome: "denied" | "failed_closed";
  utc_day: string;
  window: "minute" | "day" | "unknown";
  configured_limit?: number;
  retry_after_seconds?: number;
}

interface InternalFailureLog {
  event: "ai_chat_request_failed";
  outcome: "failed_closed";
  utc_day: string;
  stage: "request_processing";
}

type AiChatOperationalLog = ExactAdmissionLog | PerIpGuardLog | InternalFailureLog;

function writeOperationalLog(entry: AiChatOperationalLog): void {
  // Passing the object itself keeps fields queryable in Workers Logs. The closed schema
  // makes it impossible for callers to attach prompts, responses, IP-derived
  // identifiers, object names, secrets, or raw error messages.
  if (entry.outcome === "failed_closed") {
    console.error(entry);
  } else if (entry.outcome === "denied") {
    console.warn(entry);
  } else {
    console.info(entry);
  }
}

export function aiChatUtcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function logExactAdmission(
  outcome: AiChatOperationalOutcome,
  now: Date,
  configuredLimit: number,
  admittedCount?: number,
): void {
  writeOperationalLog({
    event: "ai_chat_paid_call_admission",
    guard: "exact_global_daily_cap",
    outcome,
    utc_day: aiChatUtcDay(now),
    configured_limit: configuredLimit,
    ...(admittedCount === undefined ? {} : { admitted_count: admittedCount }),
  });
}

export function logPerIpGuard(
  outcome: "denied" | "failed_closed",
  now: Date,
  fields: {
    window: "minute" | "day" | "unknown";
    configuredLimit?: number;
    retryAfter?: number;
  },
): void {
  writeOperationalLog({
    event: "ai_chat_request_guard",
    guard: "per_ip_kv",
    outcome,
    utc_day: aiChatUtcDay(now),
    window: fields.window,
    ...(fields.configuredLimit === undefined
      ? {}
      : { configured_limit: fields.configuredLimit }),
    ...(fields.retryAfter === undefined
      ? {}
      : { retry_after_seconds: fields.retryAfter }),
  });
}

export function logInternalFailure(now: Date): void {
  writeOperationalLog({
    event: "ai_chat_request_failed",
    outcome: "failed_closed",
    utc_day: aiChatUtcDay(now),
    stage: "request_processing",
  });
}
