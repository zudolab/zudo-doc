import path from "node:path";
import { describe, expect, it } from "vitest";
import { frontmatter, listTree, makeProject, read, run, write } from "./helpers.js";

function claudeFixture(root: string): void {
  write(path.join(root, "CLAUDE.md"), "# Project\n\nRoot rules. See [the package](packages/core/CLAUDE.md).\n");
  write(path.join(root, "packages", "core", "CLAUDE.md"), "# Core\n\nBack to [root](../../CLAUDE.md#rules).\n");
  write(path.join(root, "node_modules", "dep", "CLAUDE.md"), "# ignored\n");
  write(path.join(root, ".claude", "commands", "deploy.md"), "---\ndescription: Deploy the site\nargument-hint: \"[env]\"\n---\n\nRun the deploy.\n");
  write(path.join(root, ".claude", "agents", "reviewer.md"), "---\nname: Reviewer\ndescription: Reviews docs\nmodel: opus\n---\n\nReview everything.\n");
  write(
    path.join(root, ".claude", "skills", "release", "SKILL.md"),
    "---\nname: release\ndescription: Make a release\n---\n\nRead [the checklist](references/checklist.md) and run `scripts/run.sh`.\n",
  );
  write(path.join(root, ".claude", "skills", "release", "references", "checklist.md"), "# Checklist\n\nBack to [the skill](../SKILL.md).\n");
  write(path.join(root, ".claude", "skills", "release", "scripts", "run.sh"), "#!/bin/sh\n# Run the release\necho hi\n");
}

function codexFixture(root: string): void {
  write(path.join(root, "AGENTS.md"), "# Agents\n\nRepository guidance.\n");
  write(path.join(root, "packages", "core", "AGENTS.override.md"), "# Override\n");
  write(path.join(root, ".codex", "config.toml"), 'model = "gpt-5"\n[profiles.fast]\nmodel = "mini"\n');
  write(path.join(root, ".codex", "agents", "reviewer.toml"), 'name = "Reviewer"\ndescription = "Reviews"\ndeveloper_instructions = "Be careful"\n');
  write(path.join(root, ".codex", "hooks.json"), JSON.stringify({ hooks: { PreToolUse: [{ matcher: "shell", hooks: [{ type: "command", command: "./check.sh" }] }] } }));
  write(path.join(root, ".codex", "hooks", "check.sh"), "#!/bin/sh\n# Check a command\nexit 0\n");
  write(path.join(root, ".codex", "rules", "default.rules"), 'prefix_rule(pattern = ["git", "push"], decision = "forbidden", justification = "manager pushes")\n');
  write(path.join(root, ".codex", "skills", "lint", "SKILL.md"), "---\nname: lint\ndescription: Lint\n---\n\nLint it.\n");
  write(path.join(root, ".codex", "skills", "lint", "agents", "openai.yaml"), "interface:\n  display_name: Linter\npolicy:\n  allow_implicit_invocation: false\n");
  write(path.join(root, ".agents", "skills", "team", "SKILL.md"), "---\nname: team\ndescription: Team skill\n---\n\nShared.\n");
}

describe("bundled presets through the common engine", () => {
  it("bakes every Claude Code kind under /docs/<mount>/<section>/", () => {
    const project = makeProject();
    claudeFixture(project.root);
    const result = run(project, { sources: [{ id: "claude", preset: "claude-code", root: ".claude" }] });
    const docs = path.join(project.root, "src/content/docs");

    expect(listTree(path.join(docs, "claude"))).toEqual([
      "agents/index.mdx",
      "agents/reviewer.mdx",
      "commands/deploy.mdx",
      "commands/index.mdx",
      "index.mdx",
      "instructions/index.mdx",
      "instructions/packages/core/index.mdx",
      "instructions/packages/index.mdx",
      "skills/index.mdx",
      "skills/release/index.mdx",
      "skills/release/references-checklist.mdx",
    ]);
    expect(result.documents).toBe(6);

    const deploy = read(path.join(docs, "claude/commands/deploy.mdx"));
    expect(frontmatter(path.join(docs, "claude/commands/deploy.mdx"))).toMatchObject({
      title: "deploy",
      description: "Deploy the site",
      generated: "true",
      doc_source: "claude",
      doc_source_mapping: "commands",
      doc_source_path: "deploy.md",
    });
    expect(deploy).toContain("| `argument-hint` | `[env]` |");

    const agent = frontmatter(path.join(docs, "claude/agents/reviewer.mdx"));
    expect(agent.title).toBe("Reviewer");
    expect(read(path.join(docs, "claude/agents/reviewer.mdx"))).toContain("| `model` | `opus` |");

    // The root CLAUDE.md owns the section landing and carries its label.
    const instructions = frontmatter(path.join(docs, "claude/instructions/index.mdx"));
    expect(instructions).toMatchObject({ title: "CLAUDE.md", sidebar_label: "Instructions" });
    expect(read(path.join(docs, "claude/instructions/index.mdx"))).toContain(
      "[the package](./packages/core/index.mdx)",
    );
    expect(read(path.join(docs, "claude/instructions/packages/core/index.mdx"))).toContain(
      "[root](../../index.mdx#rules)",
    );

    const skill = read(path.join(docs, "claude/skills/release/index.mdx"));
    expect(skill).toContain("## File Structure");
    expect(skill).toContain("[references/checklist.md](./references-checklist.mdx)");
    expect(skill).toContain("[the checklist](./references-checklist.mdx)");
    expect(frontmatter(path.join(docs, "claude/skills/release/references-checklist.mdx")).unlisted).toBe("true");
    expect(read(path.join(docs, "claude/skills/release/references-checklist.mdx"))).toContain(
      "[the skill](./index.mdx)",
    );

    const mount = read(path.join(docs, "claude/index.mdx"));
    expect(mount).toContain("title: Claude Code");
    expect(mount).toContain('<CategoryNav category="claude" />');
  });

  it("bakes every Codex kind under the same scheme", () => {
    const project = makeProject();
    codexFixture(project.root);
    run(project, { sources: [{ id: "codex", preset: "codex", root: ".codex" }] });
    const docs = path.join(project.root, "src/content/docs");
    expect(listTree(path.join(docs, "codex"))).toEqual([
      "agents/index.mdx",
      "agents/reviewer.mdx",
      "config/config-toml.mdx",
      "config/index.mdx",
      "hooks/check-sh.mdx",
      "hooks/hooks-json.mdx",
      "hooks/index.mdx",
      "index.mdx",
      "instructions/index.mdx",
      "instructions/packages/core/agents-override.mdx",
      "instructions/packages/core/index.mdx",
      "instructions/packages/index.mdx",
      "rules/default.mdx",
      "rules/index.mdx",
      "skills/index.mdx",
      "skills/lint/index.mdx",
      "skills/team/index.mdx",
    ]);
    expect(read(path.join(docs, "codex/agents/reviewer.mdx"))).toContain("## Developer instructions");
    expect(read(path.join(docs, "codex/rules/default.mdx"))).toContain("forbidden");
    expect(read(path.join(docs, "codex/hooks/hooks-json.mdx"))).toContain("PreToolUse");
    expect(read(path.join(docs, "codex/hooks/check-sh.mdx"))).toContain("```bash");
    expect(frontmatter(path.join(docs, "codex/hooks/check-sh.mdx")).description).toBe("Check a command");
    expect(read(path.join(docs, "codex/config/config-toml.mdx"))).toContain("[profiles.fast]");
    const lint = read(path.join(docs, "codex/skills/lint/index.mdx"));
    expect(lint).toContain("**Display name:** Linter");
    expect(lint).toContain("explicit only");
  });

  it("supports two instances of one preset at distinct mounts", () => {
    const project = makeProject();
    claudeFixture(project.root);
    write(path.join(project.root, "other", ".claude", "commands", "solo.md"), "Solo.\n");
    write(path.join(project.root, "other", "CLAUDE.md"), "# Other\n");
    run(project, {
      sources: [
        { id: "claude", preset: "claude-code", root: ".claude" },
        { id: "other", preset: "claude-code", root: "other/.claude", scanRoot: "other", mount: "claude-other" },
      ],
    });
    const docs = path.join(project.root, "src/content/docs");
    expect(listTree(path.join(docs, "claude-other"))).toEqual([
      "commands/index.mdx",
      "commands/solo.mdx",
      "index.mdx",
      "instructions/index.mdx",
    ]);
    expect(frontmatter(path.join(docs, "claude-other/commands/solo.mdx")).doc_source).toBe("other");
    expect(listTree(path.join(docs, "claude"))).toContain("commands/deploy.mdx");
  });

  it("keeps URLs stable across content edits and source-root moves", () => {
    const project = makeProject();
    claudeFixture(project.root);
    run(project, { sources: [{ id: "claude", preset: "claude-code", root: ".claude" }] });
    const before = listTree(path.join(project.root, "src/content/docs/claude"));

    write(path.join(project.root, ".claude", "commands", "deploy.md"), "---\ntitle: Renamed title\n---\n\nChanged body.\n");
    run(project, { sources: [{ id: "claude", preset: "claude-code", root: ".claude" }] });
    expect(listTree(path.join(project.root, "src/content/docs/claude"))).toEqual(before);

    // Moving the whole configuration root keeps every route.
    const fs = require("node:fs") as typeof import("node:fs");
    fs.renameSync(path.join(project.root, ".claude"), path.join(project.root, "agent-config"));
    run(project, { sources: [{ id: "claude", preset: "claude-code", root: "agent-config" }] });
    expect(listTree(path.join(project.root, "src/content/docs/claude"))).toEqual(before);
  });

  it("never writes absolute source paths into generated output", () => {
    const project = makeProject();
    claudeFixture(project.root);
    codexFixture(project.root);
    run(project, {
      sources: [
        { id: "claude", preset: "claude-code", root: ".claude" },
        { id: "codex", preset: "codex", root: ".codex" },
      ],
    });
    const docs = path.join(project.root, "src/content/docs");
    for (const file of listTree(docs)) {
      expect(read(path.join(docs, file))).not.toContain(project.root);
    }
  });
});
