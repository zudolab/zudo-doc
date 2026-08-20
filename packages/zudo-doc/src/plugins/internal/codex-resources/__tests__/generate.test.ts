import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateCodexResourcesDocs } from "../generate.js";

let tmpDir: string;
let codexDir: string;
let docsDir: string;

function write(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function createFixture(): void {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-res-test-"));
  codexDir = path.join(tmpDir, ".codex");
  docsDir = path.join(tmpDir, "docs");
  fs.mkdirSync(docsDir, { recursive: true });

  write(path.join(tmpDir, "AGENTS.md"), "# Root\n\nUse [guide](docs/guide.md).\n");
  write(path.join(tmpDir, "app", "AGENTS.md"), "# App\n\nUse {care}.\n");
  write(
    path.join(tmpDir, "app", "AGENTS.override.md"),
    "# Override\n\nRender <Foo>.\n",
  );

  write(
    path.join(codexDir, "config.toml"),
    [
      'model = "gpt-5.6-sol"',
      'features = ["a|b", "`quoted`"]',
      "release_date = 2026-08-20",
      "[agents]",
      'max_threads = 4',
      "[mcp_servers.docs] # inline comment",
      'command = "docs"',
      "[[skills.config]]",
      'path = "skills/test"',
      "",
    ].join("\n"),
  );
  write(path.join(codexDir, "ci.config.toml"), 'profile = "ci"\n');

  write(
    path.join(codexDir, "agents", "reviewer.toml"),
    [
      'name = "reviewer"',
      'description = "Reviews | source"',
      'model = "gpt-5.6-sol"',
      'model_reasoning_effort = "high"',
      'sandbox_mode = "read-only"',
      'developer_instructions = """',
      "Inspect {value} and <Foo>.",
      "```ts",
      "const x = `a|b`;",
      "```",
      '"""',
      "",
    ].join("\n"),
  );
  write(
    path.join(codexDir, "agents", "wrong-type.toml"),
    'name = "wrong type"\ndescription = "Still generated"\nmodel = 3\n',
  );
  write(path.join(codexDir, "agents", "broken.toml"), 'name = "broken\n');

  write(
    path.join(codexDir, "hooks.json"),
    JSON.stringify({
      hooks: {
        PreToolUse: [{
          matcher: "Bash|Shell\nnext",
          hooks: [{
            type: "command",
            command: "check `value` | verify {x} <Foo>",
            timeout: 30,
            async: false,
          }],
        }],
        Stop: [{ matcher: "*", hooks: [{ type: "command", command: "notify" }] }],
      },
    }, null, 2),
  );
  write(path.join(codexDir, "hooks", "guard.sh"), "#!/bin/sh\n# Guard commands\necho ok\n");
  write(path.join(codexDir, "hooks", "notify.py"), "# Notify users\nprint('ok')\n");

  write(
    path.join(codexDir, "rules", "default.rules"),
    [
      "prefix_rule(",
      '  pattern = ["git", ["checkout", "switch"]],',
      '  decision = "prompt",',
      '  justification = "choose | carefully",',
      '  match = ["git checkout"],',
      '  not_match = ["git checkout -f"],',
      ")",
      "prefix_rule(",
      '  pattern = ["tool", "literal(value)"],',
      '  justification = "parentheses (inside) remain",',
      ")",
      "prefix_rule(pattern = dynamic_pattern, decision = 3, justification = {})",
      "",
    ].join("\n"),
  );

  const skillDir = path.join(codexDir, "skills", "test-skill");
  write(
    path.join(skillDir, "SKILL.md"),
    '---\nname: Test Skill\ndescription: A test skill\n---\n\nUse [the guide](references/guide.md).\n',
  );
  write(path.join(skillDir, "references", "guide.md"), "# Guide\n\nReference.\n");
  write(path.join(skillDir, "scripts", "run.sh"), "#!/bin/sh\n# Run it\n");
  write(
    path.join(skillDir, "agents", "openai.yaml"),
    [
      "interface:",
      "  display_name: Test Display",
      "  short_description: Short text",
      "policy:",
      "  allow_implicit_invocation: false",
      "",
    ].join("\n"),
  );
  write(
    path.join(codexDir, "skills", ".system", "x", "SKILL.md"),
    "---\nname: hidden\n---\n",
  );
  fs.symlinkSync(
    path.join(tmpDir, "missing-skill"),
    path.join(codexDir, "skills", "broken-link"),
  );

  write(
    path.join(tmpDir, ".agents", "skills", "repo-skill", "SKILL.md"),
    "---\nname: Repo Skill\ndescription: Repo scope\n---\n\nRepo instructions.\n",
  );
  write(
    path.join(tmpDir, ".agents", "skills", "test-skill", "SKILL.md"),
    "---\nname: Duplicate\ndescription: Loses precedence\n---\n",
  );
}

function generate() {
  return generateCodexResourcesDocs({
    codexDir,
    projectRoot: tmpDir,
    scanRoot: tmpDir,
    docsDir,
  });
}

describe("generateCodexResourcesDocs", () => {
  beforeEach(() => {
    createFixture();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("generates every category, exact counts, positions, and overview order", () => {
    expect(generate()).toEqual({
      agentsMd: 3,
      config: 2,
      agents: 2,
      hooks: 3,
      rules: 1,
      skills: 2,
    });
    const expected = new Map([
      ["codex", 904],
      ["codex-agents-md", 905],
      ["codex-config", 906],
      ["codex-agents", 907],
      ["codex-hooks", 908],
      ["codex-rules", 909],
      ["codex-skills", 910],
    ]);
    for (const [dir, position] of expected) {
      const parsed = matter(fs.readFileSync(path.join(docsDir, dir, "index.mdx"), "utf8"));
      expect(parsed.data.sidebar_position).toBe(position);
      expect(parsed.data.generated).toBe(true);
      expect(parsed.data.category_no_page).toBe(dir === "codex" ? undefined : true);
    }
    const overview = fs.readFileSync(path.join(docsDir, "codex", "index.mdx"), "utf8");
    expect(overview).toContain(
      '<CategoryNav categories={["codex-agents-md","codex-config","codex-agents","codex-hooks","codex-rules","codex-skills"]} />',
    );
  });

  it("emits formatter-stable frontmatter scalars", () => {
    generate();
    expect(fs.readFileSync(path.join(docsDir, "codex", "index.mdx"), "utf8")).toContain(
      "title: Codex\ndescription: OpenAI Codex configuration reference.",
    );
    expect(fs.readFileSync(
      path.join(docsDir, "codex-skills", "test-skill", "index.mdx"),
      "utf8",
    )).toContain(
      "title: Test Skill\ndescription: A test skill\nsidebar_label: Test Skill",
    );
  });

  it("writes root-first AGENTS pages and preserves both instruction files", () => {
    generate();
    const dir = path.join(docsDir, "codex-agents-md");
    expect(fs.readdirSync(dir).sort()).toEqual([
      "app--override.mdx",
      "app.mdx",
      "index.mdx",
      "root.mdx",
    ]);
    const root = matter(fs.readFileSync(path.join(dir, "root.mdx"), "utf8"));
    expect(root.data.sidebar_position).toBe(1);
    expect(root.content).toContain("**Path:** `AGENTS.md`");
    expect(root.content).toContain("Use `guide`.");
    expect(fs.readFileSync(path.join(dir, "app--override.mdx"), "utf8")).toContain(
      "&lt;Foo&gt;",
    );
  });

  it("renders config scalars, arrays, exact raw section headers, and safe source", () => {
    generate();
    const page = fs.readFileSync(
      path.join(docsDir, "codex-config", "config-toml.mdx"),
      "utf8",
    );
    expect(page).toContain("| `model` | `gpt-5.6-sol` |");
    expect(page).toContain("| `release_date` | `2026-08-20` |");
    expect(page).toContain("\\|");
    expect(page).toContain("- `[agents]`");
    expect(page).toContain("- `[mcp_servers.docs]`");
    expect(page).toContain("- `[[skills.config]]`");
    expect(page).toContain("```toml");
  });

  it("keeps wrong-type agents, skips malformed TOML, and protects raw fences", () => {
    generate();
    const reviewer = fs.readFileSync(
      path.join(docsDir, "codex-agents", "reviewer.mdx"),
      "utf8",
    );
    expect(reviewer).toContain("**Model:** `gpt-5.6-sol`");
    expect(reviewer).toContain("**Reasoning effort:** `high`");
    expect(reviewer).toContain("**Sandbox:** `read-only`");
    expect(reviewer).toContain("Inspect &#123;value&#125; and &lt;Foo&gt;.");
    expect(reviewer).toContain("````toml");
    const wrongType = fs.readFileSync(
      path.join(docsDir, "codex-agents", "wrong-type.mdx"),
      "utf8",
    );
    expect(wrongType).not.toContain("**Model:**");
    expect(fs.existsSync(path.join(docsDir, "codex-agents", "broken.mdx"))).toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });

  it("renders hooks and rules with safe tables and quote-aware rule scanning", () => {
    generate();
    const hooks = fs.readFileSync(
      path.join(docsDir, "codex-hooks", "hooks-json.mdx"),
      "utf8",
    );
    expect(hooks).toContain("`Bash\\|Shell next`");
    expect(hooks).toContain("`check `");
    expect(hooks).toContain("\\| verify {x} <Foo>");
    expect(matter(fs.readFileSync(path.join(docsDir, "codex-hooks", "guard-sh.mdx"), "utf8")).data.description).toBe("Guard commands");

    const rules = fs.readFileSync(
      path.join(docsDir, "codex-rules", "default.mdx"),
      "utf8",
    );
    expect(rules).toContain("`git checkout\\|switch`");
    expect(rules).toContain("`tool literal(value)`");
    expect(rules).toContain("`parentheses (inside) remain`");
    expect(rules).toContain("| — | — | — |");
  });

  it("generates skills metadata, nested references, and applies root precedence", () => {
    generate();
    const page = fs.readFileSync(
      path.join(docsDir, "codex-skills", "test-skill", "index.mdx"),
      "utf8",
    );
    expect(page).toContain("**Display name:** Test Display");
    expect(page).toContain("**Short description:** Short text");
    expect(page).toContain("**Invocation:** explicit only (`$test-skill`)");
    expect(page).not.toContain("Loses precedence");
    expect(fs.existsSync(
      path.join(docsDir, "codex-skills", "test-skill", "ref-guide.mdx"),
    )).toBe(true);
    expect(fs.existsSync(path.join(docsDir, "codex-skills", ".system"))).toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });

  it("warns and falls back for wrong-type skill frontmatter", () => {
    write(
      path.join(codexDir, "skills", "wrong-frontmatter", "SKILL.md"),
      "---\nname:\n  nested: value\ndescription:\n  - invalid\n---\n\nStill generated.\n",
    );

    expect(generate).not.toThrow();
    const page = matter(fs.readFileSync(
      path.join(docsDir, "codex-skills", "wrong-frontmatter", "index.mdx"),
      "utf8",
    ));
    expect(page.data.title).toBe("wrong-frontmatter");
    expect(page.data.description).toBe("");
    expect(page.content).toContain("Still generated.");
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('skill frontmatter field "name"'),
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('skill frontmatter field "description"'),
    );
  });

  it("malformed hooks.json does not suppress hook script pages", () => {
    write(path.join(codexDir, "hooks.json"), "{");
    const counts = generate();
    expect(counts.hooks).toBe(2);
    expect(fs.existsSync(path.join(docsDir, "codex-hooks", "hooks-json.mdx"))).toBe(false);
    expect(fs.existsSync(path.join(docsDir, "codex-hooks", "guard-sh.mdx"))).toBe(true);
  });

  it("throws on reserved index and normalized hook slug collisions", () => {
    write(path.join(codexDir, "agents", "index.toml"), 'name = "reserved"\n');
    expect(generate).toThrow(/index\.toml.*reserved slug "index"/);
    fs.rmSync(path.join(codexDir, "agents", "index.toml"));
    write(path.join(codexDir, "hooks", "a.b.sh"), "# first\n");
    write(path.join(codexDir, "hooks", "a-b.sh"), "# second\n");
    expect(generate).toThrow(/hook slug collision.*a-b-sh/);
  });
});
