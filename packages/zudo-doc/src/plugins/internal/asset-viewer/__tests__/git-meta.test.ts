import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAll: vi.fn(), gitProbe: vi.fn() }));
vi.mock("node:child_process", () => ({
  execFile: mocks.gitProbe,
}));
vi.mock("@takazudo/zudo-doc-history-server/git-history", () => ({ getAllFilesFirstLastMetaAsync: mocks.getAll }));

import { assetGitMeta } from "../git-meta.js";

beforeEach(() => {
  delete process.env.SKIP_DOC_HISTORY;
  mocks.getAll.mockReset();
  mocks.gitProbe.mockReset().mockImplementation((_command, _args, _options, callback) => callback(null, "true\n", ""));
  vi.restoreAllMocks();
});

describe("assetGitMeta", () => {
  it("projects absolute history keys and omits unrelated/untracked paths", async () => {
    mocks.getAll.mockResolvedValue(new Map([
      ["/repo/public/assets/a.txt", { oldest: { author: "Ada", date: "2020-01-01" }, newest: { author: "Bob", date: "2021-02-03" } }],
      ["/repo/elsewhere/no.txt", { oldest: { author: "No", date: "x" }, newest: { author: "No", date: "x" } }],
    ]));
    expect(await assetGitMeta("/repo", "assets")).toEqual({
      "a.txt": { author: "Ada", createdDate: "2020-01-01", updatedDate: "2021-02-03" },
    });
    expect(mocks.getAll).toHaveBeenCalledWith(["/repo/public/assets"]);
  });

  it("short-circuits under SKIP_DOC_HISTORY", async () => {
    process.env.SKIP_DOC_HISTORY = "1";
    expect(await assetGitMeta("/repo", "assets")).toEqual({});
    expect(mocks.getAll).not.toHaveBeenCalled();
  });

  it("degrades silently with a debug diagnostic when history fails", async () => {
    mocks.getAll.mockRejectedValue(new Error("not a repository"));
    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    expect(await assetGitMeta("/repo", "assets")).toEqual({});
    expect(debug).toHaveBeenCalledWith("[asset-viewer] Git metadata unavailable", expect.any(Error));
  });

  it("does not invoke the history walker when projectRoot is not a Git repository", async () => {
    mocks.gitProbe.mockImplementation((_command, _args, _options, callback) => callback(new Error("not git"), "", ""));
    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    expect(await assetGitMeta("/not-a-repo", "assets")).toEqual({});
    expect(mocks.getAll).not.toHaveBeenCalled();
    expect(debug).toHaveBeenCalled();
  });
});
