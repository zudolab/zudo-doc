import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// resolveContentPath (args.ts) now requires resolved content/locale paths to
// exist (fail-loud, #1913). These are ARGUMENT-PARSING tests, not filesystem
// tests, so mock existsSync to decouple them from the real content dirs / CWD.
// Individual tests flip it to false to exercise the fail-loud branch.
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, existsSync: vi.fn(() => true) };
});

import { existsSync } from "node:fs";
import { parseCliArgs, parseServerArgs } from "../args.js";

beforeEach(() => {
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`process.exit(${code})`);
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(existsSync).mockReturnValue(true); // default: resolved paths exist
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseCliArgs", () => {
  it("parses valid args correctly", () => {
    const result = parseCliArgs([
      "--content-dir",
      "src/content/docs",
      "--out-dir",
      "dist/history",
    ]);
    // contentDir is resolved to an absolute path by resolveContentPath (see args.ts).
    // outDir is stored verbatim. Match the absolute path by its trailing segment so the
    // assertion holds regardless of where the test runner is invoked from (INIT_CWD,
    // package CWD, or CI runner root).
    expect(result).toEqual({
      contentDir: expect.stringMatching(/src[\\/]content[\\/]docs$/),
      outDir: "dist/history",
      locales: [],
      maxEntries: 50,
    });
  });

  it("parses valid args with all options", () => {
    const result = parseCliArgs([
      "--content-dir",
      "src/content/docs",
      "--out-dir",
      "dist/history",
      "--locale",
      "ja:src/content/docs-ja",
      "--max-entries",
      "10",
    ]);
    expect(result).toEqual({
      contentDir: expect.stringMatching(/src[\\/]content[\\/]docs$/),
      outDir: "dist/history",
      locales: [
        { key: "ja", dir: expect.stringMatching(/src[\\/]content[\\/]docs-ja$/) },
      ],
      maxEntries: 10,
    });
  });

  it("exits with error when --content-dir is missing", () => {
    expect(() => parseCliArgs(["--out-dir", "dist"])).toThrow(
      "process.exit(1)",
    );
    expect(console.error).toHaveBeenCalledWith(
      "Missing required --content-dir option",
    );
  });

  it("exits with error when --out-dir is missing", () => {
    expect(() =>
      parseCliArgs(["--content-dir", "src/content/docs"]),
    ).toThrow("process.exit(1)");
    expect(console.error).toHaveBeenCalledWith(
      "Missing required --out-dir option",
    );
  });

  it("exits with error when --locale has invalid format (no colon)", () => {
    expect(() =>
      parseCliArgs([
        "--content-dir",
        "src/content/docs",
        "--out-dir",
        "dist",
        "--locale",
        "ja",
      ]),
    ).toThrow("process.exit(1)");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Invalid --locale format"),
    );
  });

  it("exits with error when --locale value is missing (flag at end)", () => {
    expect(() =>
      parseCliArgs([
        "--content-dir",
        "src/content/docs",
        "--out-dir",
        "dist",
        "--locale",
      ]),
    ).toThrow("process.exit(1)");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Missing value for --locale"),
    );
  });

  it("exits with error when --max-entries is NaN", () => {
    expect(() =>
      parseCliArgs([
        "--content-dir",
        "src/content/docs",
        "--out-dir",
        "dist",
        "--max-entries",
        "abc",
      ]),
    ).toThrow("process.exit(1)");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Invalid --max-entries value"),
    );
  });

  it("exits with error on unknown flag", () => {
    expect(() =>
      parseCliArgs([
        "--content-dir",
        "src/content/docs",
        "--out-dir",
        "dist",
        "--unknown-flag",
      ]),
    ).toThrow("process.exit(1)");
    expect(console.error).toHaveBeenCalledWith(
      "Unknown option: --unknown-flag",
    );
  });

  it("exits with error when --content-dir does not resolve to an existing directory", () => {
    // Fail-loud guard (#1913): a content path that resolves to a missing dir
    // must hard-error instead of silently producing zero history entries.
    vi.mocked(existsSync).mockReturnValue(false);
    expect(() =>
      parseCliArgs(["--content-dir", "does/not/exist", "--out-dir", "dist"]),
    ).toThrow("process.exit(1)");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("did not resolve to an existing directory"),
    );
  });
});

describe("parseServerArgs", () => {
  it("parses valid args with port", () => {
    const result = parseServerArgs([
      "--content-dir",
      "src/content/docs",
      "--port",
      "3000",
    ]);
    expect(result).toEqual({
      contentDir: expect.stringMatching(/src[\\/]content[\\/]docs$/),
      locales: [],
      maxEntries: 50,
      port: 3000,
      host: "127.0.0.1",
    });
  });

  it("uses default port 4322 when --port is not specified", () => {
    const result = parseServerArgs(["--content-dir", "src/content/docs"]);
    expect(result.port).toBe(4322);
  });

  it("defaults host to 127.0.0.1 (localhost-only)", () => {
    const result = parseServerArgs(["--content-dir", "src/content/docs"]);
    expect(result.host).toBe("127.0.0.1");
  });

  it("accepts --host to override bind address", () => {
    const result = parseServerArgs([
      "--content-dir",
      "src/content/docs",
      "--host",
      "0.0.0.0",
    ]);
    expect(result.host).toBe("0.0.0.0");
  });

  it("exits with error when --port is NaN", () => {
    expect(() =>
      parseServerArgs(["--content-dir", "src/content/docs", "--port", "abc"]),
    ).toThrow("process.exit(1)");
    expect(console.error).toHaveBeenCalledWith("Invalid --port value");
  });
});
