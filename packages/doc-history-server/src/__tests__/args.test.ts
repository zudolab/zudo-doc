import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseCliArgs, parseServerArgs } from "../args.js";

beforeEach(() => {
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`process.exit(${code})`);
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
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
    expect(result).toEqual({
      contentDir: "src/content/docs",
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
      contentDir: "src/content/docs",
      outDir: "dist/history",
      locales: [{ key: "ja", dir: "src/content/docs-ja" }],
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
      contentDir: "src/content/docs",
      locales: [],
      maxEntries: 50,
      port: 3000,
    });
  });

  it("uses default port 4322 when --port is not specified", () => {
    const result = parseServerArgs(["--content-dir", "src/content/docs"]);
    expect(result.port).toBe(4322);
  });

  it("exits with error when --port is NaN", () => {
    expect(() =>
      parseServerArgs(["--content-dir", "src/content/docs", "--port", "abc"]),
    ).toThrow("process.exit(1)");
    expect(console.error).toHaveBeenCalledWith("Invalid --port value");
  });
});
