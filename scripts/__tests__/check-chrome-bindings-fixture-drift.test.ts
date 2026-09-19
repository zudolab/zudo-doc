import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it, expect } from "vitest";

import {
  stripCommentsAndBlanks,
  parseAllowlistLine,
  parseAllowlist,
  findDrift,
  validateAllowlistEntry,
} from "../check-chrome-bindings-fixture-drift.mjs";

// Builds a `{text, lineNumber}[]` from plain strings the way
// stripCommentsAndBlanks does, for tests that only care about the ordered-
// subsequence algorithm and don't need real comment/blank stripping.
const lines = (...texts: string[]) =>
  texts.map((text, i) => ({ text, lineNumber: i + 1 }));

describe("stripCommentsAndBlanks", () => {
  it("drops blank lines and // comment-only lines, trims the rest", () => {
    const content = [
      "import a from 'a';",
      "",
      "// a full-line comment",
      "  const x = 1;  ",
    ].join("\n");
    expect(stripCommentsAndBlanks(content)).toEqual([
      { text: "import a from 'a';", lineNumber: 1 },
      { text: "const x = 1;", lineNumber: 4 },
    ]);
  });

  it("drops a single-line /* ... */ comment", () => {
    const content = ["/** @jsxRuntime automatic */", "const x = 1;"].join("\n");
    expect(stripCommentsAndBlanks(content)).toEqual([
      { text: "const x = 1;", lineNumber: 2 },
    ]);
  });

  it("drops every line wholly inside a multi-line /* ... */ block", () => {
    const content = [
      "const a = 1;",
      "/*",
      " * a block comment",
      " * spanning several lines",
      " */",
      "const b = 2;",
    ].join("\n");
    expect(stripCommentsAndBlanks(content)).toEqual([
      { text: "const a = 1;", lineNumber: 1 },
      { text: "const b = 2;", lineNumber: 6 },
    ]);
  });

  it("keeps trailing code after a block comment closes on the same line", () => {
    const content = ["/* comment */ const a = 1;"].join("\n");
    expect(stripCommentsAndBlanks(content)).toEqual([
      { text: "const a = 1;", lineNumber: 1 },
    ]);
  });
});

describe("findDrift", () => {
  it("passes when the fixture only adds lines", () => {
    const root = lines("import a;", "const x = 1;");
    const fixture = lines("import a;", "// extra note", "const x = 1;", "const y = 2;");
    expect(findDrift(root, fixture)).toBeNull();
  });

  it("fails when a root line is missing from the fixture", () => {
    const root = lines("import a;", "const x = 1;");
    const fixture = lines("import a;");
    expect(findDrift(root, fixture)).toEqual({
      missingLine: "const x = 1;",
      missingLineNumber: 2,
    });
  });

  it("fails when two root lines are reordered in the fixture", () => {
    const root = lines("const x = 1;", "const y = 2;");
    const fixture = lines("const y = 2;", "const x = 1;");
    expect(findDrift(root, fixture)).toEqual({
      missingLine: "const y = 2;",
      missingLineNumber: 2,
    });
  });

  it("passes with an allowlisted replacement standing in for the root line", () => {
    const root = lines("import { A } from 'a';", "const x = 1;");
    const fixture = lines("import { A, B } from 'a';", "const x = 1;");
    const replacementMap = new Map([
      ["import { A } from 'a';", "import { A, B } from 'a';"],
    ]);
    expect(findDrift(root, fixture, replacementMap)).toBeNull();
  });

  it("fails when the allowlisted replacement line is itself missing from the fixture", () => {
    const root = lines("import { A } from 'a';", "const x = 1;");
    const fixture = lines("const x = 1;");
    const replacementMap = new Map([
      ["import { A } from 'a';", "import { A, B } from 'a';"],
    ]);
    expect(findDrift(root, fixture, replacementMap)).toEqual({
      missingLine: "import { A } from 'a';",
      missingLineNumber: 1,
    });
  });

  it("passes on a simulated root deletion (line still in fixture) — documents the one-way limit", () => {
    // Root no longer has "const stale = 1;" at all; the fixture still carries
    // it. The guard proves nothing in the CURRENT root was lost, so this is
    // accepted, not flagged.
    const root = lines("const a = 1;", "const b = 2;");
    const fixture = lines("const a = 1;", "const stale = 1;", "const b = 2;");
    expect(findDrift(root, fixture)).toBeNull();
  });
});

describe("parseAllowlistLine", () => {
  it("returns null for a blank line", () => {
    expect(parseAllowlistLine("")).toBeNull();
    expect(parseAllowlistLine("   ")).toBeNull();
  });

  it("returns null for a full-line # comment", () => {
    expect(parseAllowlistLine("# a header comment")).toBeNull();
  });

  it("parses a valid entry", () => {
    expect(
      parseAllowlistLine(
        "hostpanel|import a from 'a';|import a, { b } from 'a'; # reason: needs b too",
      ),
    ).toEqual({
      fixture: "hostpanel",
      rootLine: "import a from 'a';",
      replacementLine: "import a, { b } from 'a';",
      reason: "needs b too",
    });
  });

  it("errors when the # reason: marker is missing", () => {
    const result = parseAllowlistLine("hostpanel|a|b");
    expect(result).not.toBeNull();
    expect(result!.error).toMatch(/reason/);
  });

  it("errors when the reason text is empty", () => {
    const result = parseAllowlistLine("hostpanel|a|b # reason:");
    expect(result!.error).toMatch(/empty reason/);
  });

  it("errors on the wrong number of pipe-separated fields", () => {
    const tooFew = parseAllowlistLine("hostpanel|a # reason: x");
    expect(tooFew!.error).toMatch(/3 "\|"-separated fields/);
    const tooMany = parseAllowlistLine("hostpanel|a|b|c # reason: x");
    expect(tooMany!.error).toMatch(/3 "\|"-separated fields/);
  });

  it("errors on an empty field", () => {
    const result = parseAllowlistLine("hostpanel||b # reason: x");
    expect(result!.error).toMatch(/empty field/);
  });
});

describe("parseAllowlist", () => {
  it("skips blanks and comments, collects entries and errors separately", () => {
    const content = [
      "# header",
      "",
      "hostpanel|a|b # reason: ok",
      "hostpanel|a|b # no reason marker here",
    ].join("\n");
    const { entries, errors } = parseAllowlist(content);
    expect(entries).toEqual([
      { fixture: "hostpanel", rootLine: "a", replacementLine: "b", reason: "ok" },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^line 4:/);
  });
});

describe("validateAllowlistEntry", () => {
  const entry = {
    fixture: "hostpanel",
    rootLine: "import a from 'a';",
    replacementLine: "import a, { b } from 'a';",
    reason: "needs b too",
  };

  it("passes when both sides exist", () => {
    const rootTexts = new Set(["import a from 'a';"]);
    const fixtureTexts = new Set(["import a, { b } from 'a';"]);
    expect(validateAllowlistEntry(entry, rootTexts, fixtureTexts)).toBeNull();
  });

  it("fails when the root line no longer exists (stale)", () => {
    const rootTexts = new Set(["something else;"]);
    const fixtureTexts = new Set(["import a, { b } from 'a';"]);
    expect(validateAllowlistEntry(entry, rootTexts, fixtureTexts)).toMatch(/stale/);
  });

  it("fails when the replacement line is missing from the fixture", () => {
    const rootTexts = new Set(["import a from 'a';"]);
    const fixtureTexts = new Set(["something else;"]);
    expect(validateAllowlistEntry(entry, rootTexts, fixtureTexts)).toMatch(
      /missing replacement/,
    );
  });
});

// ---------------------------------------------------------------------------
// End-to-end positive control on the real repo tree, run the same way
// check-pin-parity.test.ts's positive control runs its script.
// ---------------------------------------------------------------------------
describe("real repo pair (end-to-end, positive control)", () => {
  const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const SCRIPT_PATH = resolve(
    REPO_ROOT,
    "scripts/check-chrome-bindings-fixture-drift.mjs",
  );

  it("passes with the committed allowlist", () => {
    const stdout = execFileSync(process.execPath, [SCRIPT_PATH], {
      cwd: REPO_ROOT,
      encoding: "utf-8",
    });
    expect(stdout).toContain("chrome-bindings fixture drift check passed.");
  });
});
