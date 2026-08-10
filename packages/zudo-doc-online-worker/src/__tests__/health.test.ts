import { describe, expect, it } from "vitest";
import app from "../index";

describe("GET /api/health", () => {
  it("returns 200 with a status payload", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("CORS", () => {
  it("allows a preflight from the SPA's dev origin and exposes set-auth-token", async () => {
    const res = await app.request("/api/health", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:4323",
        "Access-Control-Request-Method": "GET",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:4323");
    expect(res.headers.get("access-control-expose-headers")).toContain("set-auth-token");
  });

  it("allows the SPA's 127.0.0.1 dev origin", async () => {
    const res = await app.request("/api/health", {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:4323",
        "Access-Control-Request-Method": "GET",
      },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:4323");
  });

  it("refuses an unlisted origin", async () => {
    const res = await app.request("/api/health", {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.example.com",
        "Access-Control-Request-Method": "GET",
      },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
