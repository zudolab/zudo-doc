/**
 * Transaction-layer contract, exercised against a real (temporary) directory.
 *
 * `node:fs/promises` is wrapped rather than replaced: every call still hits the
 * disk, and the wrapper only records the order of renames so the
 * "project.json last" invariant can be asserted directly instead of inferred.
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { renameLog } = vi.hoisted(() => ({ renameLog: [] as string[] }));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    rename: async (from: string, to: string) => {
      renameLog.push(String(to));
      return actual.rename(from, to);
    },
  };
});

import {
  PROJECT_FILE,
  STAGING_DIR,
  Transaction,
  recoverStagedCommit,
} from "../store/tx";

let dir: string;

beforeEach(async () => {
  renameLog.length = 0;
  dir = await mkdtemp(path.join(tmpdir(), "zdo-tx-"));
  await mkdir(path.join(dir, "pages"), { recursive: true });
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function read(rel: string): Promise<string | null> {
  return readFile(path.join(dir, rel), "utf8").catch(() => null);
}

async function seedProject(revision: number): Promise<void> {
  await writeFile(
    path.join(dir, PROJECT_FILE),
    JSON.stringify({ schemaVersion: 1, title: "T", revision }),
    "utf8",
  );
  await writeFile(path.join(dir, "outline.json"), '{"before":true}', "utf8");
}

describe("Transaction.commit", () => {
  it("lands every staged file and clears the staging directory", async () => {
    await seedProject(1);

    const tx = new Transaction(dir, 1, 2);
    tx.write("outline.json", '{"after":true}');
    tx.write("pages/page-1.md", "new page");
    tx.write(PROJECT_FILE, JSON.stringify({ schemaVersion: 1, title: "T", revision: 2 }));
    await tx.commit();

    expect(await read("outline.json")).toBe('{"after":true}');
    expect(await read("pages/page-1.md")).toBe("new page");
    expect(await read(`${STAGING_DIR}/commit.json`)).toBeNull();
  });

  it("renames project.json last, so a partial commit is detectable", async () => {
    await seedProject(1);

    const tx = new Transaction(dir, 1, 2);
    tx.write("outline.json", '{"after":true}');
    tx.write("pages/page-1.md", "new page");
    tx.write(PROJECT_FILE, "{}");
    await tx.commit();

    const promotions = renameLog.filter((target) => !target.includes(STAGING_DIR));
    expect(promotions.at(-1)).toBe(path.join(dir, PROJECT_FILE));
    expect(promotions).toHaveLength(3);
  });

  it("moves removed files to trash instead of deleting them", async () => {
    await seedProject(1);
    await writeFile(path.join(dir, "pages/page-1.md"), "doomed", "utf8");

    const tx = new Transaction(dir, 1, 2);
    tx.move("pages/page-1.md", "trash/2026/page-1.md");
    tx.write(PROJECT_FILE, "{}");
    await tx.commit();

    expect(await read("pages/page-1.md")).toBeNull();
    expect(await read("trash/2026/page-1.md")).toBe("doomed");
  });

  it("does nothing at all when no change was queued", async () => {
    await seedProject(1);
    await new Transaction(dir, 1, 2).commit();
    expect(renameLog).toEqual([]);
  });

  it("refuses a path that escapes the project directory", () => {
    const tx = new Transaction(dir, 1, 2);
    expect(() => tx.write("../escape.json", "x")).toThrow(/escapes/);
  });
});

describe("recoverStagedCommit", () => {
  it("reports nothing to do when no commit was in flight", async () => {
    await seedProject(1);
    expect(await recoverStagedCommit(dir)).toBe("none");
  });

  it("discards a staging directory that never reached its manifest", async () => {
    await seedProject(1);
    await mkdir(path.join(dir, STAGING_DIR, "next"), { recursive: true });
    await writeFile(path.join(dir, STAGING_DIR, "next/outline.json"), "half", "utf8");

    expect(await recoverStagedCommit(dir)).toBe("discarded");
    expect(await read("outline.json")).toBe('{"before":true}');
    expect(await read(`${STAGING_DIR}/next/outline.json`)).toBeNull();
  });

  it("treats a commit whose project.json already landed as finished", async () => {
    await seedProject(2);
    await stageInterruptedCommit({ baseRevision: 1, nextRevision: 2 });

    expect(await recoverStagedCommit(dir)).toBe("completed");
    // The post-commit content survives; only the staging leftovers are gone.
    expect(await read("outline.json")).toBe('{"after":true}');
    expect(await read(`${STAGING_DIR}/commit.json`)).toBeNull();
  });

  it("rolls an interrupted commit back to the pre-commit state", async () => {
    // project.json still claims revision 1, so the commit never finished even
    // though outline.json was already replaced and a page file was created.
    await seedProject(1);
    await stageInterruptedCommit({ baseRevision: 1, nextRevision: 2 });

    expect(await recoverStagedCommit(dir)).toBe("rolled-back");
    expect(await read("outline.json")).toBe('{"before":true}');
    expect(await read(PROJECT_FILE)).toContain('"revision":1');
    // The page file did not exist before the commit, so it must not survive it.
    expect(await read("pages/page-1.md")).toBeNull();
    expect(await read(`${STAGING_DIR}/commit.json`)).toBeNull();
  });

  it("restores a page file that an interrupted commit had already trashed", async () => {
    await seedProject(1);
    await mkdir(path.join(dir, STAGING_DIR, "prev/pages"), { recursive: true });
    await writeFile(path.join(dir, STAGING_DIR, "prev/pages/page-9.md"), "original", "utf8");
    await writeFile(
      path.join(dir, STAGING_DIR, "commit.json"),
      JSON.stringify({ baseRevision: 1, nextRevision: 2, paths: ["pages/page-9.md"] }),
      "utf8",
    );

    expect(await recoverStagedCommit(dir)).toBe("rolled-back");
    expect(await read("pages/page-9.md")).toBe("original");
  });

  it("is a no-op the second time", async () => {
    await seedProject(1);
    await stageInterruptedCommit({ baseRevision: 1, nextRevision: 2 });

    await recoverStagedCommit(dir);
    expect(await recoverStagedCommit(dir)).toBe("none");
  });

  /**
   * Builds the on-disk shape a crash between the outline rename and the
   * project.json rename would leave behind.
   */
  async function stageInterruptedCommit(revisions: {
    baseRevision: number;
    nextRevision: number;
  }): Promise<void> {
    const staging = path.join(dir, STAGING_DIR);
    await mkdir(path.join(staging, "next"), { recursive: true });
    await mkdir(path.join(staging, "prev"), { recursive: true });

    await writeFile(path.join(staging, "prev/outline.json"), '{"before":true}', "utf8");
    await writeFile(
      path.join(staging, `prev/${PROJECT_FILE}`),
      JSON.stringify({ schemaVersion: 1, title: "T", revision: revisions.baseRevision }),
      "utf8",
    );
    await writeFile(
      path.join(staging, `next/${PROJECT_FILE}`),
      JSON.stringify({ schemaVersion: 1, title: "T", revision: revisions.nextRevision }),
      "utf8",
    );
    await writeFile(
      path.join(staging, "commit.json"),
      JSON.stringify({ ...revisions, paths: ["outline.json", "pages/page-1.md", PROJECT_FILE] }),
      "utf8",
    );

    // The renames the interrupted commit had already performed.
    await writeFile(path.join(dir, "outline.json"), '{"after":true}', "utf8");
    await writeFile(path.join(dir, "pages/page-1.md"), "created mid-commit", "utf8");
  }
});
