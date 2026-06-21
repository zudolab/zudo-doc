/**
 * ai-chat-cors.test.ts
 *
 * Unit tests for pages/api/_ai-chat-cors.ts.
 *
 * Covered:
 *   - resolveAllowOrigin — demo-mode wildcard, exact allow-list match, null for
 *     no-match and absent origin
 *   - corsHeaders — static header presence, allow-origin passthrough, Vary header
 *     for non-wildcard origins, absence of allow-origin when null
 *   - handleOptions — 204 status, empty body, CORS headers present
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — declared before module import
// ---------------------------------------------------------------------------

const mockSettingsValues = {
  aiChatDemoMode: false,
  aiChatAllowedOrigins: [] as string[],
};

vi.mock("@/config/settings", () => ({
  get settings() {
    return mockSettingsValues;
  },
}));

// ---------------------------------------------------------------------------
// Import module under test (after mocks)
// ---------------------------------------------------------------------------

import { resolveAllowOrigin, corsHeaders, handleOptions } from "../../../pages/api/_ai-chat-cors";

// ---------------------------------------------------------------------------
// beforeEach
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockSettingsValues.aiChatDemoMode = false;
  mockSettingsValues.aiChatAllowedOrigins = [];
});

// ---------------------------------------------------------------------------
// resolveAllowOrigin
// ---------------------------------------------------------------------------

describe("resolveAllowOrigin — demo mode", () => {
  it("returns '*' regardless of origin when aiChatDemoMode=true", () => {
    mockSettingsValues.aiChatDemoMode = true;
    expect(resolveAllowOrigin("https://example.com")).toBe("*");
  });

  it("returns '*' even when no origin is provided in demo mode", () => {
    mockSettingsValues.aiChatDemoMode = true;
    expect(resolveAllowOrigin(null)).toBe("*");
  });
});

describe("resolveAllowOrigin — non-demo with allowlist", () => {
  it("echoes the origin when it is in aiChatAllowedOrigins", () => {
    mockSettingsValues.aiChatAllowedOrigins = [
      "https://docs.example.com",
      "https://other.example.com",
    ];
    expect(resolveAllowOrigin("https://docs.example.com")).toBe(
      "https://docs.example.com",
    );
  });

  it("echoes a second allowed origin correctly", () => {
    mockSettingsValues.aiChatAllowedOrigins = [
      "https://docs.example.com",
      "https://other.example.com",
    ];
    expect(resolveAllowOrigin("https://other.example.com")).toBe(
      "https://other.example.com",
    );
  });

  it("returns null for an origin not in the allowlist", () => {
    mockSettingsValues.aiChatAllowedOrigins = ["https://docs.example.com"];
    expect(resolveAllowOrigin("https://attacker.example.com")).toBeNull();
  });

  it("returns null when origin is null and allowlist is non-empty", () => {
    mockSettingsValues.aiChatAllowedOrigins = ["https://docs.example.com"];
    expect(resolveAllowOrigin(null)).toBeNull();
  });

  it("returns null when allowlist is empty and origin is provided", () => {
    mockSettingsValues.aiChatAllowedOrigins = [];
    expect(resolveAllowOrigin("https://any.example.com")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// corsHeaders
// ---------------------------------------------------------------------------

describe("corsHeaders — static headers", () => {
  it("always includes Access-Control-Allow-Methods: POST, OPTIONS", () => {
    const h = corsHeaders("*");
    expect(h["Access-Control-Allow-Methods"]).toContain("POST");
    expect(h["Access-Control-Allow-Methods"]).toContain("OPTIONS");
  });

  it("always includes Access-Control-Allow-Headers: Content-Type", () => {
    const h = corsHeaders("*");
    expect(h["Access-Control-Allow-Headers"]).toContain("Content-Type");
  });

  it("always includes Access-Control-Expose-Headers: Retry-After", () => {
    const h = corsHeaders("*");
    expect(h["Access-Control-Expose-Headers"]).toContain("Retry-After");
  });

  it("always includes Access-Control-Max-Age", () => {
    const h = corsHeaders("*");
    expect(h["Access-Control-Max-Age"]).toBeDefined();
  });
});

describe("corsHeaders — allow-origin passthrough", () => {
  it("sets Access-Control-Allow-Origin to '*' when allowOrigin='*'", () => {
    const h = corsHeaders("*");
    expect(h["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("sets Access-Control-Allow-Origin to the echoed origin for exact match", () => {
    const h = corsHeaders("https://docs.example.com");
    expect(h["Access-Control-Allow-Origin"]).toBe("https://docs.example.com");
  });

  it("omits Access-Control-Allow-Origin when allowOrigin=null", () => {
    const h = corsHeaders(null);
    expect(Object.prototype.hasOwnProperty.call(h, "Access-Control-Allow-Origin")).toBe(
      false,
    );
  });
});

describe("corsHeaders — Vary header", () => {
  it("adds Vary: Origin for a specific (non-wildcard) allowOrigin", () => {
    const h = corsHeaders("https://docs.example.com");
    expect(h["Vary"]).toBe("Origin");
  });

  it("does NOT add Vary header when allowOrigin='*'", () => {
    const h = corsHeaders("*");
    expect(Object.prototype.hasOwnProperty.call(h, "Vary")).toBe(false);
  });

  it("does NOT add Vary header when allowOrigin=null", () => {
    const h = corsHeaders(null);
    expect(Object.prototype.hasOwnProperty.call(h, "Vary")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// handleOptions
// ---------------------------------------------------------------------------

describe("handleOptions", () => {
  it("returns a 204 response", () => {
    const res = handleOptions("*");
    expect(res.status).toBe(204);
  });

  it("returns a null body (no content)", async () => {
    const res = handleOptions("*");
    const text = await res.text();
    expect(text).toBe("");
  });

  it("includes CORS headers in the response", () => {
    const res = handleOptions("https://docs.example.com");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://docs.example.com",
    );
  });

  it("works with null allowOrigin (no Allow-Origin header)", () => {
    const res = handleOptions(null);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
