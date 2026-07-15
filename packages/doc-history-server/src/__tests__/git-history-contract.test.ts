import { describe, expect, it } from "vitest";

describe("./git-history public contract", () => {
  it("keeps the current async and parser exports", async () => {
    const gitHistory = await import("../git-history.js");

    expect(gitHistory).toHaveProperty("getDocHistoryAsync");
    expect(gitHistory).toHaveProperty("getAllFilesFirstLastMetaAsync");
    expect(gitHistory).toHaveProperty("parseHashToPathMap");
    expect(gitHistory).toHaveProperty("parseFirstLastMeta");
    expect(gitHistory).toHaveProperty("collectContentFiles");
    expect(gitHistory).toHaveProperty("isGitRepo");
  });

  it("does not export removed compatibility and sync orchestration APIs", async () => {
    const gitHistory = await import("../git-history.js");

    for (const removed of [
      "getDocHistory",
      "getFileCommitsMetaAsync",
      "getFileCommits",
      "getFirstCommit",
      "getCommitInfo",
      "getFileCommitsMeta",
      "MAX_BUFFER_BYTES",
    ]) {
      expect(gitHistory).not.toHaveProperty(removed);
    }
  });
});
