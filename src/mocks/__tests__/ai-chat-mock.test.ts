import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { server } from "../server";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("AI Chat Mock", () => {
  it("returns a mock response", async () => {
    const response = await fetch("http://localhost/api/ai-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Hello",
        history: [],
      }),
    });

    const data = await response.json();
    expect(data).toHaveProperty("response");
    expect(typeof data.response).toBe("string");
    expect(data.response.length).toBeGreaterThan(0);
  });
});
