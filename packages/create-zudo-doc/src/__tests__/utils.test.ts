import { describe, it, expect, afterEach } from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import {
  destinationLabel,
  getSecondaryLang,
  hasAncestorPnpmWorkspace,
  normalizeDestination,
  pmRunCommand,
  resolveTargetDir,
  splitDestination,
} from "../utils.js";

describe("getSecondaryLang — canonical legacy locale inference", () => {
  it.each([
    [" EN ", "ja"],
    ["JA", "en"],
    ["pt-BR", "en"],
  ])("normalizes %j and infers %s", (primary, expected) => {
    expect(getSecondaryLang(primary)).toBe(expected);
  });
});

describe("pmRunCommand — package.json script invocation per package manager", () => {
  it.each([
    ["pnpm", "build", "pnpm build"],
    ["yarn", "build", "yarn build"],
    ["npm", "build", "npm run build"],
    // The bug this helper fixes: `bun build` invokes Bun's BUNDLER, not the
    // package.json `build` script — bun must use the `run` verb.
    ["bun", "build", "bun run build"],
  ] as const)("%s → %s script emits %s", (pm, script, expected) => {
    expect(pmRunCommand(pm, script)).toBe(expected);
  });

  it("bun never emits a bare `bun <script>` (bundler footgun guard)", () => {
    for (const script of ["build", "dev", "check", "preview"]) {
      expect(pmRunCommand("bun", script)).toBe(`bun run ${script}`);
    }
  });
});

describe("hasAncestorPnpmWorkspace — never-nest guard for pnpm-workspace.yaml (#2923)", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length) {
      await fs.remove(tempDirs.pop()!);
    }
  });

  async function mkTempDir(): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hasAncestorPnpmWorkspace-test-"));
    tempDirs.push(dir);
    return dir;
  }

  it("returns false when no ancestor has a pnpm-workspace.yaml", async () => {
    const root = await mkTempDir();
    const projectDir = path.join(root, "my-docs");
    await fs.ensureDir(projectDir);
    expect(hasAncestorPnpmWorkspace(projectDir)).toBe(false);
  });

  it("returns true when the immediate parent has a pnpm-workspace.yaml", async () => {
    const root = await mkTempDir();
    await fs.outputFile(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
    const projectDir = path.join(root, "apps/docs");
    await fs.ensureDir(projectDir);
    expect(hasAncestorPnpmWorkspace(projectDir)).toBe(true);
  });

  it("returns true when a workspace root is several levels up", async () => {
    const root = await mkTempDir();
    await fs.outputFile(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
    const projectDir = path.join(root, "a/b/c/my-docs");
    await fs.ensureDir(projectDir);
    expect(hasAncestorPnpmWorkspace(projectDir)).toBe(true);
  });

  it("does not check `dir` itself, only its ancestors", async () => {
    const root = await mkTempDir();
    const projectDir = path.join(root, "my-docs");
    await fs.ensureDir(projectDir);
    // A pnpm-workspace.yaml INSIDE the target dir itself must not count —
    // scaffold.ts calls this before writing its own, so this only matters
    // if a caller pre-seeds a target dir, which the "ancestor, not self"
    // semantics intentionally ignore.
    await fs.outputFile(path.join(projectDir, "pnpm-workspace.yaml"), "packages:\n  - x\n");
    expect(hasAncestorPnpmWorkspace(projectDir)).toBe(false);
  });
});

// #4023 — the positional CLI argument is a destination path whose final
// segment is the package name. The locked project-name grammar (F4 #2013) is
// unchanged; it is simply applied to the final segment only.
describe("splitDestination — destination path → directory + project name", () => {
  it.each([
    ["sub/ref-doc", "sub/ref-doc", "ref-doc"],
    ["./sub/ref-doc", "./sub/ref-doc", "ref-doc"],
    ["sub/ref-doc/", "sub/ref-doc", "ref-doc"],
    ["sub/", "sub", "sub"],
    ["refdoc", "refdoc", "refdoc"],
    ["a/b/c/deep-docs", "a/b/c/deep-docs", "deep-docs"],
    ["  sub/ref-doc  ", "sub/ref-doc", "ref-doc"],
  ])("splits %j into %j + %j", (input, destination, projectName) => {
    expect(splitDestination(input)).toEqual({ ok: true, destination, projectName });
  });

  it("accepts an absolute path and takes its final segment", () => {
    const absolute = path.join(os.tmpdir(), "sub", "abs-docs");
    expect(splitDestination(absolute)).toEqual({
      ok: true,
      destination: absolute,
      projectName: "abs-docs",
    });
  });

  it("strips a trailing separator from an absolute path", () => {
    const absolute = path.join(os.tmpdir(), "abs-docs");
    expect(splitDestination(`${absolute}${path.sep}`)).toEqual({
      ok: true,
      destination: absolute,
      projectName: "abs-docs",
    });
  });

  // Decision (#4023): upward traversal is ALLOWED. `..` is a relative way to
  // name a directory outside the cwd, and absolute destinations are accepted,
  // so rejecting it would be inconsistent.
  it("allows upward traversal", () => {
    expect(splitDestination("../ref-doc")).toEqual({
      ok: true,
      destination: "../ref-doc",
      projectName: "ref-doc",
    });
  });

  it("normalizes away a traversal that walks back into the path", () => {
    expect(splitDestination("sub/ref-doc/..")).toEqual({
      ok: true,
      destination: "sub/ref-doc/..",
      projectName: "sub",
    });
  });

  it.each([".", "..", "./", "../", "/", "//"])(
    "rejects %j — no final segment to name the project",
    (input) => {
      const result = splitDestination(input);
      expect(result.ok).toBe(false);
      expect(result.ok ? "" : result.error).toMatch(/no final path segment/);
    },
  );

  it.each(["", "   "])("rejects %j as empty", (input) => {
    const result = splitDestination(input);
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toMatch(/required/);
  });

  it("rejects an invalid final segment and says the final segment is the name", () => {
    const result = splitDestination("sub/My-Docs");
    expect(result.ok).toBe(false);
    const error = result.ok ? "" : result.error;
    expect(error).toMatch(/last segment/);
    expect(error).toMatch(/"My-Docs"/);
    expect(error).toMatch(/lowercase/);
  });

  it("rejects a final segment longer than the 214-char package-name limit", () => {
    const result = splitDestination(`sub/${"a".repeat(215)}`);
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toMatch(/214/);
  });

  it("does not validate the leading directories as package names", () => {
    // "My Sub" is not a legal package name but is a perfectly legal directory.
    expect(splitDestination("My Sub/ref-doc")).toEqual({
      ok: true,
      destination: "My Sub/ref-doc",
      projectName: "ref-doc",
    });
  });
});

describe("normalizeDestination — directory shape only", () => {
  it("accepts a final segment that is not a legal package name", () => {
    // The --name flag supplies the package name in this case, so the final
    // segment only has to be a legal directory name.
    expect(normalizeDestination("sub/My-Docs")).toEqual({
      ok: true,
      destination: "sub/My-Docs",
      finalSegment: "My-Docs",
    });
  });

  it("still rejects a path with no final segment", () => {
    const result = normalizeDestination(".");
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toMatch(/no final path segment/);
  });
});

describe("resolveTargetDir / destinationLabel — the one shared resolver", () => {
  it("resolves the destination when present", () => {
    const choices = { projectName: "ref-doc", destination: "sub/ref-doc" };
    expect(resolveTargetDir(choices)).toBe(
      path.resolve(process.cwd(), "sub/ref-doc"),
    );
    expect(destinationLabel(choices)).toBe("sub/ref-doc");
  });

  it("falls back to the project name when no destination is given", () => {
    // The programmatic API and preset paths never set a destination — they
    // must keep behaving exactly as before.
    const choices = { projectName: "ref-doc" };
    expect(resolveTargetDir(choices)).toBe(path.resolve(process.cwd(), "ref-doc"));
    expect(destinationLabel(choices)).toBe("ref-doc");
  });
});
