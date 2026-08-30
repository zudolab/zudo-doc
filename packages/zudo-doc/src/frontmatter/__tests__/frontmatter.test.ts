import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { matter, stringify } from "../index.js";

// Parity suite for the in-house splitter that replaced `gray-matter`
// (zudolab/zudo-doc#3729). Every expectation below was taken from
// gray-matter@4.0.3's observed behavior unless a case is explicitly marked as
// a deliberate divergence.
describe("matter — delimiter handling", () => {
  it("parses a normal block and strips one newline off the body", () => {
    expect(matter("---\ntitle: Home\n---\nOther stuff")).toEqual({
      data: { title: "Home" },
      content: "Other stuff",
    });
  });

  it("returns the whole input as content when there is no frontmatter", () => {
    expect(matter("# Heading\n\nbody")).toEqual({
      data: {},
      content: "# Heading\n\nbody",
    });
  });

  it("handles an empty string", () => {
    expect(matter("")).toEqual({ data: {}, content: "" });
  });

  it("treats a four-dash rule as content, not an opening fence", () => {
    expect(matter("----\ntitle: Home\n----\nbody")).toEqual({
      data: {},
      content: "----\ntitle: Home\n----\nbody",
    });
  });

  it("strips a UTF-8 BOM before looking for the fence", () => {
    expect(matter("\uFEFF---\ntitle: Home\n---\nbody")).toEqual({
      data: { title: "Home" },
      content: "body",
    });
  });

  it("strips CR then LF after the closing fence (CRLF files)", () => {
    expect(matter("---\r\ntitle: Home\r\n---\r\nbody")).toEqual({
      data: { title: "Home" },
      content: "body",
    });
  });

  it("keeps CRLF frontmatter values free of stray carriage returns", () => {
    const { data } = matter(
      "---\r\ntitle: Home\r\ntags:\r\n  - a\r\n  - b\r\n---\r\nbody",
    );
    expect(data).toEqual({ title: "Home", tags: ["a", "b"] });
  });

  it("leaves trailing spaces after the closing fence in the content", () => {
    // gray-matter only strips \r and \n — not horizontal whitespace.
    expect(matter("---\ntitle: Home\n---   \nbody").content).toBe("   \nbody");
  });

  it("swallows the rest of the file when the fence is never closed", () => {
    expect(matter("---\ntitle: Home\nother: value")).toEqual({
      data: { title: "Home", other: "value" },
      content: "",
    });
  });

  it("closes on `\\n---` even when the fence is not alone on its line", () => {
    // gray-matter searches for the raw sequence, not a line-anchored fence.
    expect(matter("---\ntitle: Home\n---foo\nbody").content).toBe("foo\nbody");
  });

  it("reads an empty block as no data while keeping the body", () => {
    expect(matter("---\n---\nbody")).toEqual({ data: {}, content: "body" });
  });

  it("reads a comments-only block as no data without parsing it", () => {
    expect(matter("---\n# just a note\n---\nbody")).toEqual({
      data: {},
      content: "body",
    });
  });
});

describe("matter — block parsing", () => {
  it("keeps nested structures and arrays", () => {
    const { data } = matter(
      "---\ntags:\n  - a\n  - b\nnested:\n  key: value\n---\nbody",
    );
    expect(data).toEqual({ tags: ["a", "b"], nested: { key: "value" } });
  });

  it("resolves YAML 1.1 merge keys, as the js-yaml 3 schema did", () => {
    const { data } = matter(
      "---\nbase: &base\n  a: 1\nchild:\n  <<: *base\n  b: 2\n---\nbody",
    );
    expect(data.child).toEqual({ a: 1, b: 2 });
  });

  it("normalizes a null document to an empty object", () => {
    // gray-matter did this in its excerpt pass, verified against 4.0.3.
    expect(matter("---\nnull\n---\nbody").data).toEqual({});
  });

  it("passes a non-object YAML root through unchanged", () => {
    // Call sites guard with an isRecord() check and rely on this.
    expect(matter("---\njust a string\n---\nbody").data).toBe("just a string");
  });

  it("throws on a malformed block", () => {
    // tags-audit deliberately does not catch, so this must stay a throw.
    expect(() => matter("---\ntitle: [unclosed\n---\nbody")).toThrow();
  });

  it("parses a `---json` block with the JSON engine", () => {
    expect(matter('---json\n{"title": "Home"}\n---\nbody')).toEqual({
      data: { title: "Home" },
      content: "body",
    });
  });

  it("ignores an explicit `---yaml` language tag", () => {
    expect(matter("---yaml\ntitle: Home\n---\nbody").data).toEqual({
      title: "Home",
    });
  });

  it("rejects a language tag it has no engine for", () => {
    // gray-matter threw for an unregistered engine too. Its `javascript`
    // engine is deliberately not reimplemented — it ran the block through
    // `eval`, i.e. arbitrary code execution from a content file.
    expect(() => matter("---javascript\n{title: 'Home'}\n---\nbody")).toThrow(
      /Unsupported frontmatter language/,
    );
  });
});

describe("matter — deliberate divergence from js-yaml 3", () => {
  it("keeps a bare YYYY-MM-DD as a string instead of coercing it to a Date", () => {
    // js-yaml 3's DEFAULT_SAFE_SCHEMA produced a Date here. YAML 1.2 core
    // keeps the string, which is what zfb and the docs schema already expect
    // (zudolab/zudo-doc#3642) — so this alignment removes a mismatch rather
    // than introducing one.
    const { data } = matter("---\ndate: 2026-01-12\n---\nbody");
    expect(data.date).toBe("2026-01-12");
    expect(data.date).not.toBeInstanceOf(Date);
  });

  it("still keeps a quoted date a string", () => {
    expect(matter('---\ndate: "2026-01-12"\n---\nbody').data.date).toBe(
      "2026-01-12",
    );
  });

  it("does not read `yes` / `no` as booleans", () => {
    // True of js-yaml 3 and of YAML 1.2 core alike — the "Norway problem"
    // is not introduced by this migration. Guards against someone switching
    // the parser to `{ version: "1.1" }`, where it would be.
    const { data } = matter("---\na: yes\nb: no\nc: on\n---\nbody");
    expect(data).toEqual({ a: "yes", b: "no", c: "on" });
  });

  it("reads real booleans as booleans", () => {
    expect(matter("---\ndraft: true\nwide: false\n---\nbody").data).toEqual({
      draft: true,
      wide: false,
    });
  });
});

// The whole point of zudolab/zudo-doc#3729: downstream consumers had to carry a
// `js-yaml: ^3.15.1` override because gray-matter pinned them to the 3.x API.
// Reintroducing either package here would silently put that override back on
// every consumer, so guard the dependency list directly.
describe("package dependencies", () => {
  it("does not depend on gray-matter or js-yaml", () => {
    const require = createRequire(import.meta.url);
    // src/frontmatter/__tests__/ -> src/frontmatter/ -> src/ -> packages/zudo-doc/
    const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
    const pkg = require(resolve(pkgRoot, "package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };

    const declared = Object.keys({
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
    });

    expect(declared).not.toContain("gray-matter");
    expect(declared).not.toContain("js-yaml");
    expect(pkg.dependencies?.yaml).toBeTruthy();
  });
});

// `stringify` is the inverse used by the `tags-suggest` bin to write approved
// tags back into a doc file. Expectations verified against gray-matter 4.0.3.
describe("stringify", () => {
  it("wraps data in fences and terminates the body with a newline", () => {
    expect(stringify("Body", { title: "X" })).toBe("---\ntitle: X\n---\nBody\n");
  });

  it("does not double the body's existing trailing newline", () => {
    expect(stringify("Body\n", { title: "X" })).toBe(
      "---\ntitle: X\n---\nBody\n",
    );
  });

  it("emits no fence at all for empty data", () => {
    expect(stringify("Body\n", {})).toBe("Body\n");
  });

  it("round-trips through matter()", () => {
    const source = "---\ntitle: Home\ntags:\n  - a\n  - b\n---\nBody text.\n";
    const parsed = matter(source);
    expect(stringify(parsed.content, parsed.data)).toBe(source);
  });

  it("leaves a long scalar on one line instead of folding it", () => {
    // Deliberate divergence: js-yaml's 80-column default reflowed this into a
    // `>-` block, churning frontmatter the tool only meant to add tags to.
    const description =
      "a fairly long description value that might wrap somewhere around eighty columns maybe";
    const out = stringify("Body\n", { description, tags: ["a"] });
    expect(out).toContain(`description: ${description}\n`);
    expect(out).not.toContain(">-");
  });
});
