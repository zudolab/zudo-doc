/**
 * Boot smoke for `pnpm dev:server`.
 *
 * This is the one test that opens a real socket, because it is the one claim
 * the in-process suite cannot make: that `startServer` actually binds, serves,
 * and lets go. Port 0 asks the OS for a free port, so the test can never
 * collide with a running dev server, and the listener is closed in `finally`.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { startServer } from "../index";
import type { ProjectSummary } from "../store/file-store";

let dataDir: string;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "zdo-boot-"));
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

describe("startServer", () => {
  it("binds loopback, serves the seeded project, and closes cleanly", async () => {
    const server = await startServer({ dataDir, port: 0, hostname: "127.0.0.1" });
    expect(server.port).toBeGreaterThan(0);

    try {
      const response = await fetch(`http://127.0.0.1:${server.port}/api/projects`);
      expect(response.status).toBe(200);

      const projects = (await response.json()) as ProjectSummary[];
      // An empty data directory is seeded with the sample base on boot.
      expect(projects).toEqual([
        { slug: "aurora-docs", title: "Aurora Docs", revision: 1 },
      ]);
    } finally {
      await server.close();
    }

    // Nothing is listening any more, so the connection is refused outright.
    await expect(
      fetch(`http://127.0.0.1:${server.port}/api/projects`),
    ).rejects.toThrow();
  });
});
