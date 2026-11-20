import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeDocSources, resolveConfiguredPath } from "../normalize.js";

const env = { projectRoot: "/work/project", homeDir: () => "/home/tester" };

describe("normalizeDocSources", () => {
  it("returns no sources for an absent or empty setting", () => {
    expect(normalizeDocSources(undefined, env)).toEqual([]);
    expect(normalizeDocSources([], env)).toEqual([]);
  });

  it("resolves relative, absolute and ~/ paths without reading the filesystem", () => {
    expect(resolveConfiguredPath("docs", env, "x")).toBe(path.resolve("/work/project/docs"));
    expect(resolveConfiguredPath("../sib", env, "x")).toBe(path.resolve("/work/sib"));
    expect(resolveConfiguredPath("/abs//dir/", env, "x")).toBe(path.normalize("/abs/dir/"));
    expect(resolveConfiguredPath("~/notes", env, "x")).toBe(path.join("/home/tester", "notes"));
    expect(resolveConfiguredPath("~", env, "x")).toBe("/home/tester");
    expect(() => resolveConfiguredPath("~other/notes", env, "x")).toThrow(/unsupported home-directory form/);
  });

  it("defaults mount to the id and preset scanRoot to the project root", () => {
    const [claude] = normalizeDocSources([{ id: "claude", preset: "claude-code", root: ".claude" }], env);
    expect(claude?.mount).toBe("claude");
    expect(claude?.requiredRoots).toEqual([path.resolve("/work/project/.claude")]);
    expect(claude?.mappings.find((m) => m.id === "instructions")?.root).toBe(path.resolve("/work/project"));
  });

  it.each([
    [[{ id: "a", preset: "nope", root: "x" }], /preset/],
    [[{ id: "a", preset: "codex", root: "x", extra: 1 }], /extra/],
    [[{ id: "a", preset: "codex", root: "x" }, { id: "a", preset: "codex", root: "y", mount: "b" }], /duplicate source id/],
    [[{ id: "a", preset: "codex", root: "x" }, { id: "b", preset: "codex", root: "y", mount: "a" }], /mount/],
    [[{ id: "bad id", preset: "codex", root: "x" }], /id/],
    [[{ id: "a", preset: "codex", root: "x", mount: "Upper" }], /mount/],
    [[{ id: "a", title: "A", mappings: [] }], /non-empty array/],
    [[{ id: "a", title: "A", mappings: [{ id: "m", root: "x", include: ["../*.md"], format: "markdown" }] }], /\.\./],
    [[{ id: "a", title: "A", mappings: [{ id: "m", root: "x", include: ["/abs/*.md"], format: "markdown" }] }], /must stay relative/],
    [[{ id: "a", title: "A", mappings: [{ id: "m", root: "x", include: ["*.md"], format: "html" }] }], /format/],
    [[{ id: "a", title: "A", mappings: [{ id: "m", root: "x", include: ["*.md"], format: "code", missing: "warn" }] }], /missing/],
    [[{ id: "a", title: "A", mappings: [{ id: "m", root: "x", include: ["*.md"], format: "code", to: "../up" }] }], /to/],
    [[{ id: "a", title: "A", mappings: [{ id: "m", root: "x", include: ["*.md"], format: "code" }, { id: "m", root: "y", include: ["*.md"], format: "code" }] }], /duplicate mapping id/],
    ["not-an-array", /array/],
  ])("rejects invalid configuration %#", (raw, message) => {
    expect(() => normalizeDocSources(raw, env)).toThrow(message);
  });
});
