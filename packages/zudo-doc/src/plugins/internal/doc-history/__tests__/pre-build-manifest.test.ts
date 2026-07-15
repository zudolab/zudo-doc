// runDocHistoryMetaStep — manifest emission end-to-end (#2517).
//
// The single-pass walk (`getAllFilesFirstLastMetaAsync`) and the content walker
// are mocked, so these cases pin the runner's own contract independent of git:
// field mapping (author/createdDate from OLDEST, updatedDate from newest, ext),
// omit-untracked (missing map entry ⇒ absent from the manifest), the
// SKIP_DOC_HISTORY `{}\n` short-circuit, and deterministic key order (which is
// what keeps the CI build-site artifact byte-stable).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const mocks = vi.hoisted(() => ({
  collectContentFiles: vi.fn(),
  getAllFilesFirstLastMetaAsync: vi.fn(),
}));

vi.mock("@takazudo/zudo-doc-history-server/git-history", () => ({
  collectContentFiles: mocks.collectContentFiles,
  getAllFilesFirstLastMetaAsync: mocks.getAllFilesFirstLastMetaAsync,
}));

let projectRoot: string;

function readManifest(): string {
  return fs.readFileSync(
    path.join(projectRoot, ".zfb", "doc-history-meta.json"),
    "utf-8",
  );
}

const DOCS_DIR = "src/content/docs";
const JA_DIR = "src/content/docs-ja";

beforeEach(() => {
  vi.resetModules();
  mocks.collectContentFiles.mockReset();
  mocks.getAllFilesFirstLastMetaAsync.mockReset();
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zdh-prebuild-"));
  delete process.env["SKIP_DOC_HISTORY"];
});

afterEach(() => {
  fs.rmSync(projectRoot, { recursive: true, force: true });
  delete process.env["SKIP_DOC_HISTORY"];
});

/** Wire collectContentFiles to return `files` (rel names) under each dir. */
function stubFiles(filesByDir: Record<string, string[]>): void {
  mocks.collectContentFiles.mockImplementation((dir: string) => {
    const rels = filesByDir[dir] ?? [];
    return rels.map((rel) => ({
      filePath: `${dir}/${rel}`,
      slug: rel.replace(/\.mdx?$/, "").replace(/\/index$/, ""),
    }));
  });
}

describe("runDocHistoryMetaStep (#2517)", () => {
  it("maps author/createdDate from the OLDEST commit and updatedDate from the newest, with ext", async () => {
    const docsAbs = path.resolve(projectRoot, DOCS_DIR);
    stubFiles({ [docsAbs]: ["intro.mdx", "notes.md"] });
    mocks.getAllFilesFirstLastMetaAsync.mockResolvedValue(
      new Map([
        [
          `${docsAbs}/intro.mdx`,
          {
            oldest: { author: "Alice", date: "2024-01-01T00:00:00Z" },
            newest: { author: "Bob", date: "2024-03-01T00:00:00Z" },
          },
        ],
        [
          `${docsAbs}/notes.md`,
          {
            oldest: { author: "Carol", date: "2024-02-01T00:00:00Z" },
            newest: { author: "Dave", date: "2024-02-05T00:00:00Z" },
          },
        ],
      ]),
    );

    const { runDocHistoryMetaStep } = await import("../pre-build.js");
    await runDocHistoryMetaStep({
      projectRoot,
      docsDir: DOCS_DIR,
      logger: { info() {} },
    });

    expect(JSON.parse(readManifest())).toEqual({
      intro: {
        author: "Alice", // OLDEST author, not newest
        createdDate: "2024-01-01T00:00:00Z",
        updatedDate: "2024-03-01T00:00:00Z",
        ext: ".mdx",
      },
      notes: {
        author: "Carol",
        createdDate: "2024-02-01T00:00:00Z",
        updatedDate: "2024-02-05T00:00:00Z",
        ext: ".md", // derived from the .md filename
      },
    });
  });

  it("omits files with no walk entry (untracked / not yet committed)", async () => {
    const docsAbs = path.resolve(projectRoot, DOCS_DIR);
    stubFiles({ [docsAbs]: ["tracked.mdx", "untracked.mdx"] });
    mocks.getAllFilesFirstLastMetaAsync.mockResolvedValue(
      new Map([
        [
          `${docsAbs}/tracked.mdx`,
          {
            oldest: { author: "Alice", date: "2024-01-01T00:00:00Z" },
            newest: { author: "Alice", date: "2024-01-01T00:00:00Z" },
          },
        ],
      ]),
    );

    const { runDocHistoryMetaStep } = await import("../pre-build.js");
    await runDocHistoryMetaStep({
      projectRoot,
      docsDir: DOCS_DIR,
      logger: { info() {} },
    });

    const manifest = JSON.parse(readManifest());
    expect(Object.keys(manifest)).toEqual(["tracked"]);
    expect(manifest["untracked"]).toBeUndefined();
  });

  it("short-circuits to literal `{}\\n` under SKIP_DOC_HISTORY=1 without walking git", async () => {
    process.env["SKIP_DOC_HISTORY"] = "1";
    const { runDocHistoryMetaStep } = await import("../pre-build.js");
    await runDocHistoryMetaStep({
      projectRoot,
      docsDir: DOCS_DIR,
      logger: { info() {} },
    });

    expect(readManifest()).toBe("{}\n"); // byte-exact
    expect(mocks.getAllFilesFirstLastMetaAsync).not.toHaveBeenCalled();
    expect(mocks.collectContentFiles).not.toHaveBeenCalled();
  });

  it("emits deterministic key order: default-locale bare slugs first, then locale-prefixed", async () => {
    const docsAbs = path.resolve(projectRoot, DOCS_DIR);
    const jaAbs = path.resolve(projectRoot, JA_DIR);
    stubFiles({
      [docsAbs]: ["b.mdx", "a.mdx"], // walker order preserved (not re-sorted)
      [jaAbs]: ["b.mdx", "a.mdx"],
    });
    const meta = (author: string) => ({
      oldest: { author, date: "2024-01-01T00:00:00Z" },
      newest: { author, date: "2024-01-02T00:00:00Z" },
    });
    mocks.getAllFilesFirstLastMetaAsync.mockResolvedValue(
      new Map([
        [`${docsAbs}/b.mdx`, meta("A")],
        [`${docsAbs}/a.mdx`, meta("A")],
        [`${jaAbs}/b.mdx`, meta("A")],
        [`${jaAbs}/a.mdx`, meta("A")],
      ]),
    );

    const { runDocHistoryMetaStep } = await import("../pre-build.js");
    await runDocHistoryMetaStep({
      projectRoot,
      docsDir: DOCS_DIR,
      locales: { ja: { dir: JA_DIR } },
      logger: { info() {} },
    });

    // Insertion order = dirEntries order (default first) then walker order,
    // with the ja/ prefix applied to the locale dir. JSON preserves it.
    expect(Object.keys(JSON.parse(readManifest()))).toEqual([
      "b",
      "a",
      "ja/b",
      "ja/a",
    ]);
    // And the walk ran exactly once for the whole build.
    expect(mocks.getAllFilesFirstLastMetaAsync).toHaveBeenCalledTimes(1);
  });
});
