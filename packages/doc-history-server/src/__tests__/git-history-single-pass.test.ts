import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";

// #2517: the preBuild meta pass replaced its per-file `git log --follow` fan-out
// with ONE streaming `git log --full-history --name-status` walk, reconstructing
// rename chains in user space. These tests are the real correctness guard (the
// single-corpus parity check under-tests rename-heavy repos): the pure parser is
// exercised directly, and the walk-level cases lock in the one-spawn / cwd /
// no-repo contracts.

const FAKE_REPO_ROOT = "/fake/repo/root";
const NUL = "\x00"; // git expands the `%x00` format token to this in its output

/** Build one commit block: `<NUL><hash>\n<date>\n<author>` + name-status lines. */
function commit(
  hash: string,
  date: string,
  author: string,
  records: string[] = [],
): string {
  const header = `${NUL}${hash}\n${date}\n${author}\n`;
  // git emits a blank line between the header and the record block; header-only
  // (merge) commits emit no blank line and no records.
  const body = records.length > 0 ? `\n${records.map((r) => `${r}\n`).join("")}` : "";
  return header + body;
}

/** Join commit blocks newest-first, exactly as `git log` streams them. */
function log(...blocks: string[]): string {
  return blocks.join("");
}

describe("parseFirstLastMeta — pure parser + rename reconstruction (#2517)", () => {
  let parseFirstLastMeta: typeof import("../git-history.js")["parseFirstLastMeta"];

  beforeEach(async () => {
    ({ parseFirstLastMeta } = await import("../git-history.js"));
  });

  it("maps A/M records to oldest=A commit, newest=latest M (author from oldest)", () => {
    const out = log(
      commit("c3", "2024-03-01T00:00:00Z", "Newy", ["M\tfoo.mdx"]),
      commit("c2", "2024-02-01T00:00:00Z", "Mid", ["M\tfoo.mdx"]),
      commit("c1", "2024-01-01T00:00:00Z", "Alice", ["A\tfoo.mdx"]),
    );
    const map = parseFirstLastMeta(out);
    expect(map.get("foo.mdx")).toEqual({
      oldest: { author: "Alice", date: "2024-01-01T00:00:00Z" },
      newest: { author: "Newy", date: "2024-03-01T00:00:00Z" },
    });
  });

  it("follows a single rename: the pre-rename A attributes to the current path", () => {
    const out = log(
      commit("c3", "2024-03-01T00:00:00Z", "Newy", ["M\tnew.mdx"]),
      commit("c2", "2024-02-01T00:00:00Z", "Mover", ["R100\told.mdx\tnew.mdx"]),
      commit("c1", "2024-01-01T00:00:00Z", "Alice", ["A\told.mdx"]),
    );
    const map = parseFirstLastMeta(out);
    expect(map.get("new.mdx")).toEqual({
      oldest: { author: "Alice", date: "2024-01-01T00:00:00Z" },
      newest: { author: "Newy", date: "2024-03-01T00:00:00Z" },
    });
    // The old path is not a standalone key — it chained onto new.mdx.
    expect(map.has("old.mdx")).toBe(false);
  });

  it("follows a chain of multiple renames back to the original A", () => {
    const out = log(
      commit("c4", "2024-04-01T00:00:00Z", "Newy", ["M\tc.mdx"]),
      commit("c3", "2024-03-01T00:00:00Z", "R2", ["R100\tb.mdx\tc.mdx"]),
      commit("c2", "2024-02-01T00:00:00Z", "R1", ["R100\ta.mdx\tb.mdx"]),
      commit("c1", "2024-01-01T00:00:00Z", "Alice", ["A\ta.mdx"]),
    );
    const map = parseFirstLastMeta(out);
    expect(map.get("c.mdx")).toEqual({
      oldest: { author: "Alice", date: "2024-01-01T00:00:00Z" },
      newest: { author: "Newy", date: "2024-04-01T00:00:00Z" },
    });
    expect([...map.keys()]).toEqual(["c.mdx"]);
  });

  it("reconstructs a synthetic mass-rename commit (many R records at once)", () => {
    // One commit renames three files simultaneously (the `-l0` case the walk
    // must survive without diff.renameLimit degrading R → D+A).
    const out = log(
      commit("c2", "2024-02-01T00:00:00Z", "Mover", [
        "R100\told/a.mdx\tnew/a.mdx",
        "R100\told/b.mdx\tnew/b.mdx",
        "R100\told/c.mdx\tnew/c.mdx",
      ]),
      commit("c1", "2024-01-01T00:00:00Z", "Alice", [
        "A\told/a.mdx",
        "A\told/b.mdx",
        "A\told/c.mdx",
      ]),
    );
    const map = parseFirstLastMeta(out);
    for (const f of ["new/a.mdx", "new/b.mdx", "new/c.mdx"]) {
      expect(map.get(f)).toEqual({
        oldest: { author: "Alice", date: "2024-01-01T00:00:00Z" },
        newest: { author: "Mover", date: "2024-02-01T00:00:00Z" },
      });
    }
    expect([...map.keys()].sort()).toEqual(["new/a.mdx", "new/b.mdx", "new/c.mdx"]);
  });

  it("terminates the chain at a delete: a recreated path does NOT inherit the old file's dates", () => {
    const out = log(
      commit("c5", "2024-05-01T00:00:00Z", "Newy", ["M\tpage.mdx"]),
      commit("c4", "2024-04-01T00:00:00Z", "Bob", ["A\tpage.mdx"]), // recreation
      commit("c3", "2024-03-01T00:00:00Z", "Del", ["D\tpage.mdx"]), // reuse boundary
      commit("c2", "2024-02-01T00:00:00Z", "Old", ["M\tpage.mdx"]),
      commit("c1", "2024-01-01T00:00:00Z", "Zed", ["A\tpage.mdx"]), // unrelated old file
    );
    const map = parseFirstLastMeta(out);
    expect(map.get("page.mdx")).toEqual({
      oldest: { author: "Bob", date: "2024-04-01T00:00:00Z" },
      newest: { author: "Newy", date: "2024-05-01T00:00:00Z" },
    });
  });

  it("does NOT chain copies (C records) — a docs-ja copy keeps only its own history", () => {
    const out = log(
      commit("c2", "2024-02-01T00:00:00Z", "Copier", ["C100\ten.mdx\tja.mdx"]),
      commit("c1", "2024-01-01T00:00:00Z", "Alice", ["A\ten.mdx"]),
    );
    const map = parseFirstLastMeta(out);
    // The copy source keeps its own (older) history.
    expect(map.get("en.mdx")).toEqual({
      oldest: { author: "Alice", date: "2024-01-01T00:00:00Z" },
      newest: { author: "Alice", date: "2024-01-01T00:00:00Z" },
    });
    // The copy target is attributed ONLY to the copy commit — no EN inheritance.
    expect(map.get("ja.mdx")).toEqual({
      oldest: { author: "Copier", date: "2024-02-01T00:00:00Z" },
      newest: { author: "Copier", date: "2024-02-01T00:00:00Z" },
    });
  });

  it("handles a commit touching multiple files", () => {
    const out = log(
      commit("c2", "2024-02-01T00:00:00Z", "Newy", ["M\ta.mdx", "M\tb.mdx"]),
      commit("c1", "2024-01-01T00:00:00Z", "Alice", ["A\ta.mdx", "A\tb.mdx"]),
    );
    const map = parseFirstLastMeta(out);
    expect(map.get("a.mdx")?.oldest.author).toBe("Alice");
    expect(map.get("b.mdx")?.newest.date).toBe("2024-02-01T00:00:00Z");
  });

  it("tolerates merge commits that emit header-only entries", () => {
    const out = log(
      commit("c3", "2024-03-01T00:00:00Z", "Newy", ["M\tfoo.mdx"]),
      commit("merge", "2024-02-15T00:00:00Z", "Merger"), // header only, no records
      commit("c1", "2024-01-01T00:00:00Z", "Alice", ["A\tfoo.mdx"]),
    );
    const map = parseFirstLastMeta(out);
    expect(map.get("foo.mdx")).toEqual({
      oldest: { author: "Alice", date: "2024-01-01T00:00:00Z" },
      newest: { author: "Newy", date: "2024-03-01T00:00:00Z" },
    });
  });

  it("preserves multi-byte UTF-8 paths verbatim (core.quotePath=false)", () => {
    const p = "guides/日本語/ページ.mdx";
    const out = log(commit("c1", "2024-01-01T00:00:00Z", "Alice", [`A\t${p}`]));
    const map = parseFirstLastMeta(out);
    expect(map.get(p)?.oldest.author).toBe("Alice");
  });

  it("returns an empty map for empty output and ignores leading noise before the first sentinel", () => {
    expect(parseFirstLastMeta("").size).toBe(0);
    // A stray line with no preceding sentinel must not be mistaken for a record.
    expect(parseFirstLastMeta("garbage\nmore garbage\n").size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Walk-level contracts: mock node:child_process so we observe the spawn.
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  execFileSync: vi.fn(),
  execFile: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFileSync: mocks.execFileSync,
  execFile: mocks.execFile,
  spawn: mocks.spawn,
}));

const WALK_OUT = `${NUL}c2\n2024-02-01T00:00:00Z\nNewy\n\nM\tsrc/content/docs/page.mdx\n${NUL}c1\n2024-01-01T00:00:00Z\nAlice\n\nA\tsrc/content/docs/page.mdx\n`;

function installGit(revParseThrows = false): void {
  mocks.execFileSync.mockImplementation((_cmd: string, args: string[]) => {
    if (args[0] === "rev-parse") {
      if (revParseThrows) throw new Error("fatal: not a git repository");
      return `${FAKE_REPO_ROOT}\n`;
    }
    return "";
  });
  mocks.spawn.mockImplementation((_cmd: string, _args: string[]) => {
    const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter };
    child.stdout = new EventEmitter();
    queueMicrotask(() => {
      child.stdout.emit("data", Buffer.from(WALK_OUT, "utf-8"));
      child.emit("close", 0);
    });
    return child;
  });
}

describe("getAllFilesFirstLastMetaAsync — walk-level (#2517)", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.execFileSync.mockReset();
    mocks.execFile.mockReset();
    mocks.spawn.mockReset();
    installGit();
  });
  afterEach(() => vi.restoreAllMocks());

  it("issues exactly ONE `git log` spawn regardless of file count, with the mandatory flags", async () => {
    const { getAllFilesFirstLastMetaAsync } = await import("../git-history.js");
    await getAllFilesFirstLastMetaAsync([`${FAKE_REPO_ROOT}/src/content/docs`]);

    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    const args = mocks.spawn.mock.calls[0]![1] as string[];
    expect(args).toContain("log");
    expect(args).toContain("--name-status");
    expect(args).toContain("--full-history");
    expect(args).toContain("--find-renames");
    expect(args).toContain("-l0"); // mass-rename guard
  });

  it("runs the walk with cwd = repo root (#1907) and keys results by absolute path", async () => {
    const { getAllFilesFirstLastMetaAsync } = await import("../git-history.js");
    const map = await getAllFilesFirstLastMetaAsync([
      `${FAKE_REPO_ROOT}/src/content/docs`,
    ]);

    const opts = mocks.spawn.mock.calls[0]![2] as { cwd?: string };
    expect(opts.cwd).toBe(FAKE_REPO_ROOT);

    // Keyed by absolute path (repoRoot joined with git's repo-relative path).
    const key = `${FAKE_REPO_ROOT}/src/content/docs/page.mdx`;
    expect(map.get(key)).toEqual({
      oldest: { author: "Alice", date: "2024-01-01T00:00:00Z" },
      newest: { author: "Newy", date: "2024-02-01T00:00:00Z" },
    });
  });

  it("converts absolute pathspecs to repo-relative before passing them to git", async () => {
    const { getAllFilesFirstLastMetaAsync } = await import("../git-history.js");
    await getAllFilesFirstLastMetaAsync([`${FAKE_REPO_ROOT}/src/content/docs`]);
    const args = mocks.spawn.mock.calls[0]![1] as string[];
    const dashDash = args.indexOf("--");
    expect(dashDash).toBeGreaterThan(-1);
    expect(args.slice(dashDash + 1)).toEqual(["src/content/docs"]);
  });

  it("degrades to an empty map (no spawn) outside a git repository", async () => {
    installGit(true); // rev-parse throws
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getAllFilesFirstLastMetaAsync } = await import("../git-history.js");
    const map = await getAllFilesFirstLastMetaAsync([`${FAKE_REPO_ROOT}/x`]);
    expect(map.size).toBe(0);
    expect(mocks.spawn).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("reassembles a multi-byte UTF-8 path split mid-codepoint across two data events", async () => {
    const relPath = "src/content/docs/日本語/ページ.mdx";
    const out = `${NUL}c1\n2024-01-01T00:00:00Z\nAlice\n\nA\t${relPath}\n`;
    const fullBuf = Buffer.from(out, "utf-8");
    // Split one byte short of completing "ペ"'s 3-byte UTF-8 sequence (E3 83 9A)
    // so the first chunk ends mid-codepoint — only StringDecoder buffering
    // (not a naive per-chunk `toString()`) reassembles the path correctly.
    const codepointIdx = out.indexOf("ペ");
    const bytesThroughCodepoint = Buffer.byteLength(
      out.slice(0, codepointIdx + 1),
      "utf-8",
    );
    const splitAt = bytesThroughCodepoint - 1;

    mocks.spawn.mockImplementation((_cmd: string, _args: string[]) => {
      const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter };
      child.stdout = new EventEmitter();
      queueMicrotask(() => {
        child.stdout.emit("data", fullBuf.subarray(0, splitAt));
        child.stdout.emit("data", fullBuf.subarray(splitAt));
        child.emit("close", 0);
      });
      return child;
    });

    const { getAllFilesFirstLastMetaAsync } = await import("../git-history.js");
    const map = await getAllFilesFirstLastMetaAsync([
      `${FAKE_REPO_ROOT}/src/content/docs`,
    ]);

    const key = `${FAKE_REPO_ROOT}/${relPath}`;
    expect(map.get(key)?.oldest.author).toBe("Alice");
    expect([...map.keys()]).toEqual([key]);
  });
});
