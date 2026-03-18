import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import http from "node:http";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Helper to fetch JSON and return typed data */
async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = res.headers.get("content-type")?.includes("json")
    ? ((await res.json()) as Record<string, any>)
    : null;
  return { res, data };
}

// Mock git-history module before importing server
vi.mock("../git-history.js", () => ({
  collectContentFiles: vi.fn().mockReturnValue([
    { filePath: "/fake/docs/getting-started.mdx", slug: "getting-started" },
    { filePath: "/fake/docs/guides/page-1.mdx", slug: "guides/page-1" },
  ]),
  getDocHistory: vi.fn().mockImplementation((_filePath, slug) => ({
    slug,
    filePath: "src/content/docs/" + slug + ".mdx",
    entries: [
      {
        hash: "abc1234567890",
        date: "2024-01-15T10:00:00Z",
        author: "Test User",
        message: "Initial commit",
        content: "# Test\n\nContent here",
      },
    ],
  })),
}));

// Import after mocks are set up
const { startServer } = await import("../server.js");

let server: http.Server;
let baseUrl: string;
let refreshInterval: ReturnType<typeof setInterval>;

beforeAll(async () => {
  // Capture the setInterval created by startServer so we can clear it
  const originalSetInterval = globalThis.setInterval;
  vi.spyOn(globalThis, "setInterval").mockImplementation(
    (...args: Parameters<typeof setInterval>) => {
      refreshInterval = originalSetInterval(...args);
      return refreshInterval;
    },
  );

  // Intercept createServer to capture the server instance
  const originalCreateServer = http.createServer;
  vi.spyOn(http, "createServer").mockImplementation(
    (...args: Parameters<typeof http.createServer>) => {
      server = originalCreateServer.apply(http, args);
      return server;
    },
  );

  // Suppress console.log during server start
  vi.spyOn(console, "log").mockImplementation(() => {});

  const ready = new Promise<void>((resolve) => {
    // Intercept listen to use port 0 and capture assigned port
    const originalListen = http.Server.prototype.listen;
    vi.spyOn(http.Server.prototype, "listen").mockImplementation(function (
      this: http.Server,
      ...args: unknown[]
    ) {
      const cb =
        typeof args[args.length - 1] === "function" ? args.pop() : null;
      originalListen.call(this, 0, () => {
        const addr = this.address();
        if (addr && typeof addr === "object") {
          baseUrl = `http://localhost:${addr.port}`;
        }
        if (cb) (cb as () => void)();
        resolve();
      });
      return this;
    });
  });

  startServer({
    port: 0,
    contentDir: "/fake/docs",
    locales: [],
    maxEntries: 50,
  });

  await ready;

  // Verify server started successfully
  if (!baseUrl) {
    throw new Error("Server failed to bind — baseUrl was not assigned");
  }

  // Restore mocks used only for setup
  vi.mocked(http.createServer).mockRestore();
  vi.mocked(http.Server.prototype.listen).mockRestore();
  vi.mocked(globalThis.setInterval).mockRestore();
  vi.mocked(console.log).mockRestore();
});

afterAll(() => {
  // Clear the file-index refresh interval to prevent open handles
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  if (server) {
    server.close();
  }
});

describe("Server routes", () => {
  it("GET /health returns 200 with status ok", async () => {
    const { res, data } = await fetchJson(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(data).toEqual({ status: "ok" });
  });

  it("GET /health has CORS headers", async () => {
    const { res } = await fetchJson(`${baseUrl}/health`);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toBe(
      "GET, OPTIONS",
    );
  });

  it("GET /doc-history/getting-started.json returns 200 with history", async () => {
    const { res, data } = await fetchJson(
      `${baseUrl}/doc-history/getting-started.json`,
    );
    expect(res.status).toBe(200);
    expect(data!.slug).toBe("getting-started");
    expect(data!.filePath).toBe("src/content/docs/getting-started.mdx");
    expect(data!.entries).toHaveLength(1);
    expect(data!.entries[0].hash).toBe("abc1234567890");
    expect(data!.entries[0].author).toBe("Test User");
  });

  it("GET /doc-history/guides/page-1.json returns 200 for nested slug", async () => {
    const { res, data } = await fetchJson(
      `${baseUrl}/doc-history/guides/page-1.json`,
    );
    expect(res.status).toBe(200);
    expect(data!.slug).toBe("guides/page-1");
  });

  it("GET /doc-history/nonexistent.json returns 404", async () => {
    const { res, data } = await fetchJson(
      `${baseUrl}/doc-history/nonexistent.json`,
    );
    expect(res.status).toBe(404);
    expect(data!.error).toContain("No doc found");
  });

  it("OPTIONS /anything returns 204 with CORS headers", async () => {
    const res = await fetch(`${baseUrl}/anything`, { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toBe(
      "GET, OPTIONS",
    );
    expect(res.headers.get("access-control-allow-headers")).toBe(
      "Content-Type",
    );
  });

  it("GET /unknown-path returns 404", async () => {
    const { res, data } = await fetchJson(`${baseUrl}/unknown-path`);
    expect(res.status).toBe(404);
    expect(data!.error).toBe("Not found");
  });

  it("all responses have CORS headers", async () => {
    const paths = ["/health", "/doc-history/getting-started.json", "/unknown"];
    for (const path of paths) {
      const { res } = await fetchJson(`${baseUrl}${path}`);
      expect(
        res.headers.get("access-control-allow-origin"),
        `CORS header missing for ${path}`,
      ).toBe("*");
    }
  });
});
