/**
 * serve-snapshots.test.ts
 *
 * Tests for serve-snapshots.mjs covering:
 *  1. resolveFilePath() — pure path-resolution logic
 *  2. HTTP server routing — start a real server on a test port, fetch URLs
 *  3. SIGTERM handling — spawn the script, send SIGTERM, verify clean exit
 *
 * Ports used: 14400–14403 (well above the config defaults of 4400/4401 to
 * avoid collisions with any running harness instance).
 */

import { mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { get as httpGet, IncomingMessage } from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { resolveFilePath, startServer } from "../serve-snapshots.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCRIPT_PATH = resolve(__dirname, "../serve-snapshots.mjs");

// ── Helpers ───────────────────────────────────────────────────────────────────

function fetchUrl(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpGet(url, (res: IncomingMessage) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () =>
        resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString() }),
      );
      res.on("error", reject);
    });
    req.on("error", reject);
  });
}

// ── resolveFilePath — pure unit tests ─────────────────────────────────────────

describe("resolveFilePath – path resolution", () => {
  const snap = "/snap";
  const prefix = "/pj/zudo-doc/";

  it("root / → index.html", () => {
    expect(resolveFilePath("/", snap, "")).toBe("/snap/index.html");
  });

  it("empty path → index.html", () => {
    expect(resolveFilePath("", snap, "")).toBe("/snap/index.html");
  });

  it("trailing-slash path → dir/index.html", () => {
    expect(resolveFilePath("/docs/intro/", snap, "")).toBe(
      "/snap/docs/intro/index.html",
    );
  });

  it("path with extension → direct file", () => {
    expect(resolveFilePath("/sitemap.xml", snap, "")).toBe("/snap/sitemap.xml");
  });

  it("robots.txt → direct file", () => {
    expect(resolveFilePath("/robots.txt", snap, "")).toBe("/snap/robots.txt");
  });

  it("favicon.ico → direct file", () => {
    expect(resolveFilePath("/favicon.ico", snap, "")).toBe("/snap/favicon.ico");
  });

  it("no-extension slug → dir/index.html (SSG convention)", () => {
    expect(resolveFilePath("/docs/intro", snap, "")).toBe(
      "/snap/docs/intro/index.html",
    );
  });

  it("strips query string before resolving", () => {
    expect(resolveFilePath("/sitemap.xml?v=abc123", snap, "")).toBe(
      "/snap/sitemap.xml",
    );
  });

  it("strips fragment before resolving", () => {
    expect(resolveFilePath("/docs/intro/#heading", snap, "")).toBe(
      "/snap/docs/intro/index.html",
    );
  });

  it("strips sitePrefix from path (trailing-slash prefix)", () => {
    expect(resolveFilePath("/pj/zudo-doc/docs/intro/", snap, prefix)).toBe(
      "/snap/docs/intro/index.html",
    );
  });

  it("strips sitePrefix from path (prefix without trailing slash in opts)", () => {
    expect(resolveFilePath("/pj/zudo-doc/docs/intro/", snap, "/pj/zudo-doc")).toBe(
      "/snap/docs/intro/index.html",
    );
  });

  it("sitePrefix exact match → root index.html", () => {
    expect(resolveFilePath("/pj/zudo-doc/", snap, prefix)).toBe("/snap/index.html");
  });

  it("path not starting with prefix is served as-is", () => {
    expect(resolveFilePath("/docs/intro/", snap, prefix)).toBe(
      "/snap/docs/intro/index.html",
    );
  });
});

// ── HTTP server routing ───────────────────────────────────────────────────────

const PORT_BASE = 14400;

describe("HTTP server routing", () => {
  let snapshotDir: string;
  let server: Awaited<ReturnType<typeof startServer>>;

  beforeAll(async () => {
    snapshotDir = join(tmpdir(), `serve-snapshots-routing-${Date.now()}`);
    await mkdir(join(snapshotDir, "docs", "intro"), { recursive: true });
    await mkdir(join(snapshotDir, "pj", "zudo-doc", "docs", "guide"), {
      recursive: true,
    });
    await writeFile(
      join(snapshotDir, "index.html"),
      "<html><body>root</body></html>",
    );
    await writeFile(
      join(snapshotDir, "docs", "intro", "index.html"),
      "<html><body>intro page</body></html>",
    );
    await writeFile(
      join(snapshotDir, "sitemap.xml"),
      [
        '<?xml version="1.0"?>',
        "<urlset>",
        "<url><loc>/docs/intro/</loc></url>",
        "<url><loc>/docs/guide/</loc></url>",
        "</urlset>",
      ].join("\n"),
    );
    await writeFile(join(snapshotDir, "robots.txt"), "User-agent: *\nAllow: /\n");

    server = await startServer({
      snapshotDir,
      port: PORT_BASE,
      sitePrefix: "",
    });
  });

  afterAll(async () => {
    await server.close();
    await rm(snapshotDir, { recursive: true, force: true });
  });

  it("serves / as root index.html", async () => {
    const { status, body } = await fetchUrl(`http://127.0.0.1:${PORT_BASE}/`);
    expect(status).toBe(200);
    expect(body).toContain("root");
  });

  it("serves trailing-slash path as dir/index.html", async () => {
    const { status, body } = await fetchUrl(
      `http://127.0.0.1:${PORT_BASE}/docs/intro/`,
    );
    expect(status).toBe(200);
    expect(body).toContain("intro page");
  });

  it("serves .xml file directly with correct MIME type", async () => {
    const { status, body } = await fetchUrl(
      `http://127.0.0.1:${PORT_BASE}/sitemap.xml`,
    );
    expect(status).toBe(200);
    expect(body).toContain("<urlset>");
  });

  it("serves robots.txt directly", async () => {
    const { status, body } = await fetchUrl(
      `http://127.0.0.1:${PORT_BASE}/robots.txt`,
    );
    expect(status).toBe(200);
    expect(body).toContain("User-agent");
  });

  it("returns 404 for missing paths", async () => {
    const { status } = await fetchUrl(
      `http://127.0.0.1:${PORT_BASE}/nonexistent/page/`,
    );
    expect(status).toBe(404);
  });
});

// ── sitePrefix stripping (separate server instance) ───────────────────────────

describe("HTTP server — sitePrefix stripping", () => {
  let snapshotDir: string;
  let server: Awaited<ReturnType<typeof startServer>>;

  beforeAll(async () => {
    snapshotDir = join(tmpdir(), `serve-snapshots-prefix-${Date.now()}`);
    await mkdir(join(snapshotDir, "docs", "intro"), { recursive: true });
    await writeFile(
      join(snapshotDir, "docs", "intro", "index.html"),
      "<html><body>intro via prefix</body></html>",
    );
    await writeFile(
      join(snapshotDir, "sitemap.xml"),
      "<urlset><url><loc>/pj/zudo-doc/docs/intro/</loc></url></urlset>",
    );

    server = await startServer({
      snapshotDir,
      port: PORT_BASE + 1,
      sitePrefix: "/pj/zudo-doc/",
    });
  });

  afterAll(async () => {
    await server.close();
    await rm(snapshotDir, { recursive: true, force: true });
  });

  it("strips sitePrefix and serves prefixed URL correctly", async () => {
    const { status, body } = await fetchUrl(
      `http://127.0.0.1:${PORT_BASE + 1}/pj/zudo-doc/docs/intro/`,
    );
    expect(status).toBe(200);
    expect(body).toContain("intro via prefix");
  });

  it("also serves /sitemap.xml without prefix (root file)", async () => {
    const { status, body } = await fetchUrl(
      `http://127.0.0.1:${PORT_BASE + 1}/sitemap.xml`,
    );
    expect(status).toBe(200);
    expect(body).toContain("<urlset>");
  });
});

// ── SIGTERM / SIGINT handling ─────────────────────────────────────────────────

describe("signal handling", () => {
  it(
    "handles SIGTERM and exits with code 0",
    async () => {
      const fixtureDir = join(tmpdir(), `sigterm-test-${Date.now()}`);
      await mkdir(fixtureDir, { recursive: true });
      await writeFile(join(fixtureDir, "index.html"), "<html>ok</html>");

      const child = spawn(
        "node",
        [
          SCRIPT_PATH,
          `--port-a=${PORT_BASE + 2}`,
          `--port-b=${PORT_BASE + 3}`,
          `--snapshot-a=${fixtureDir}`,
          `--snapshot-b=${fixtureDir}`,
          "--site-prefix=",
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );

      // Collect stderr for debugging if the test fails.
      const stderrLines: string[] = [];
      child.stderr?.on("data", (chunk: Buffer) => {
        stderrLines.push(chunk.toString());
      });

      // Wait for both "serving" log lines before sending the signal.
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error(`server did not start within 5s; stderr: ${stderrLines.join("")}`)),
          5000,
        );
        let serveCount = 0;
        child.stdout?.on("data", (chunk: Buffer) => {
          if (chunk.toString().includes("[S3] serving")) {
            serveCount++;
            if (serveCount >= 2) {
              clearTimeout(timeout);
              resolve();
            }
          }
        });
        child.on("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      // Send SIGTERM.
      child.kill("SIGTERM");

      // Verify clean exit.
      const exitCode = await new Promise<number>((resolve) => {
        child.on("exit", (code) => resolve(code ?? -1));
      });

      await rm(fixtureDir, { recursive: true, force: true });

      expect(exitCode).toBe(0);
    },
    10_000,
  );
});
