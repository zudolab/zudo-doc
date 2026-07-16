import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  logExactAdmission,
  logInternalFailure,
  logPerIpGuard,
} from "../../../pages/api/_ai-chat-observability";

function loggedEntries(spy: ReturnType<typeof vi.spyOn>): Array<Record<string, unknown>> {
  return spy.mock.calls.map(([entry]) => entry as Record<string, unknown>);
}

describe("AI chat operational logs", () => {
  let info: ReturnType<typeof vi.spyOn>;
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("emits exact-cap admitted, denied, and failed-closed events", () => {
    const now = new Date("2026-07-16T23:59:30.000Z");

    logExactAdmission("admitted", now, 7, 1);
    logExactAdmission("denied", now, 7, 7);
    logExactAdmission("failed_closed", now, 7);

    expect(loggedEntries(info)).toEqual([
      {
        event: "ai_chat_paid_call_admission",
        guard: "exact_global_daily_cap",
        outcome: "admitted",
        utc_day: "2026-07-16",
        configured_limit: 7,
        admitted_count: 1,
      },
    ]);
    expect(loggedEntries(warn)).toEqual([
      {
        event: "ai_chat_paid_call_admission",
        guard: "exact_global_daily_cap",
        outcome: "denied",
        utc_day: "2026-07-16",
        configured_limit: 7,
        admitted_count: 7,
      },
    ]);
    expect(loggedEntries(error)).toEqual([
      {
        event: "ai_chat_paid_call_admission",
        guard: "exact_global_daily_cap",
        outcome: "failed_closed",
        utc_day: "2026-07-16",
        configured_limit: 7,
      },
    ]);
  });

  it("distinguishes per-IP quota denial from KV failed-closed", () => {
    const now = new Date("2026-07-16T12:00:00.000Z");

    logPerIpGuard("denied", now, {
      window: "minute",
      configuredLimit: 10,
      retryAfter: 45,
    });
    logPerIpGuard("failed_closed", now, { window: "unknown" });

    expect(loggedEntries(warn)).toEqual([
      {
        event: "ai_chat_request_guard",
        guard: "per_ip_kv",
        outcome: "denied",
        utc_day: "2026-07-16",
        window: "minute",
        configured_limit: 10,
        retry_after_seconds: 45,
      },
    ]);
    expect(loggedEntries(error)).toEqual([
      {
        event: "ai_chat_request_guard",
        guard: "per_ip_kv",
        outcome: "failed_closed",
        utc_day: "2026-07-16",
        window: "unknown",
      },
    ]);
  });

  it("keeps the closed log schema free of sensitive and reversible fields", () => {
    const now = new Date("2026-07-16T12:00:00.000Z");

    logExactAdmission("failed_closed", now, 500);
    logPerIpGuard("failed_closed", now, { window: "unknown" });
    logInternalFailure(now);

    const serialized = JSON.stringify([
      ...info.mock.calls.flat(),
      ...warn.mock.calls.flat(),
      ...error.mock.calls.flat(),
    ]);
    for (const forbidden of [
      "prompt",
      "response",
      "ip_hash",
      "203.0.113.42",
      "secret",
      "token",
      "error",
      "object_name",
      "identifier",
    ]) {
      expect(serialized.toLowerCase()).not.toContain(forbidden);
    }
  });
});
