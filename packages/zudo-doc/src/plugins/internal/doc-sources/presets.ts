// Bundled presets. A preset is pure data: it expands into ordinary mappings
// that run through the same discovery, planning, rendering and reconciliation
// pipeline as custom mappings. Provider-specific parsing is limited to the
// renderers whose source format requires it (Codex TOML, hooks and rules).

import path from "node:path";
import type { LabelRef, NormalizedMapping, NormalizedSource } from "./model.js";

/** Directories skipped by the bundled instruction scans at any depth. */
export const DEFAULT_SCAN_EXCLUDES = [
  "**/.*/**",
  "**/node_modules/**",
  "**/dist/**",
  "**/out/**",
  "**/public/**",
  "**/worktrees/**",
  "**/__inbox/**",
  "**/test-results/**",
];

const MARKDOWN_EXTENSIONS = [".md", ".mdx"];

export interface PresetInput {
  id: string;
  mount: string;
  /** Absolute agent configuration directory. */
  root: string;
  /** Absolute instruction scan root. */
  scanRoot: string;
}

function section(name: string, fallback: string, description: string): {
  sectionLabel: LabelRef;
  sectionDescription: LabelRef;
} {
  return {
    sectionLabel: { key: `docSources.section.${name}.label`, fallback },
    sectionDescription: { key: `docSources.section.${name}.description`, fallback: description },
  };
}

function mapping(
  sourceId: string,
  fields: Partial<NormalizedMapping> &
    Pick<NormalizedMapping, "id" | "root" | "include" | "to" | "renderer">,
): NormalizedMapping {
  return {
    sourceId,
    exclude: [],
    missing: "skip",
    landingNames: [],
    stripExtensions: [],
    titleFromPath: false,
    ...fields,
  };
}

function claudeCode(input: PresetInput): NormalizedSource {
  const { id, root, scanRoot } = input;
  return {
    id,
    mount: input.mount,
    preset: "claude-code",
    title: { key: "docSources.claudeCode.title", fallback: "Claude Code" },
    description: {
      key: "docSources.claudeCode.description",
      fallback: "Claude Code configuration reference.",
    },
    requiredRoots: [root],
    mappings: [
      mapping(id, {
        id: "instructions",
        root: scanRoot,
        include: ["**/CLAUDE.md"],
        exclude: DEFAULT_SCAN_EXCLUDES,
        to: "instructions",
        renderer: "markdown",
        missing: "error",
        landingNames: ["claude.md"],
        stripExtensions: MARKDOWN_EXTENSIONS,
        titleFromPath: true,
        ...section("instructions", "Instructions", "Project instruction files"),
      }),
      mapping(id, {
        id: "commands",
        root: path.join(root, "commands"),
        include: ["**/*.md"],
        to: "commands",
        renderer: "markdown",
        stripExtensions: MARKDOWN_EXTENSIONS,
        ...section("commands", "Commands", "Custom slash commands"),
      }),
      mapping(id, {
        id: "skills",
        root: path.join(root, "skills"),
        include: ["*/SKILL.md"],
        to: "skills",
        renderer: "skill",
        stripExtensions: MARKDOWN_EXTENSIONS,
        ...section("skills", "Skills", "Skill packages"),
      }),
      mapping(id, {
        id: "agents",
        root: path.join(root, "agents"),
        include: ["**/*.md"],
        to: "agents",
        renderer: "markdown",
        stripExtensions: MARKDOWN_EXTENSIONS,
        ...section("agents", "Agents", "Custom subagents"),
      }),
    ],
  };
}

function codex(input: PresetInput): NormalizedSource {
  const { id, root, scanRoot } = input;
  return {
    id,
    mount: input.mount,
    preset: "codex",
    title: { key: "docSources.codex.title", fallback: "Codex" },
    description: {
      key: "docSources.codex.description",
      fallback: "OpenAI Codex configuration reference.",
    },
    requiredRoots: [root],
    mappings: [
      mapping(id, {
        id: "instructions",
        root: scanRoot,
        include: ["**/AGENTS.md", "**/AGENTS.override.md"],
        exclude: DEFAULT_SCAN_EXCLUDES,
        to: "instructions",
        renderer: "markdown",
        missing: "error",
        landingNames: ["agents.md"],
        stripExtensions: MARKDOWN_EXTENSIONS,
        titleFromPath: true,
        ...section("instructions", "Instructions", "Project instruction files"),
      }),
      mapping(id, {
        id: "config",
        root,
        include: ["config.toml", "config.toml.example", "*.config.toml"],
        to: "config",
        renderer: "codex-config",
        ...section("config", "Config", "config.toml and profiles"),
      }),
      mapping(id, {
        id: "agents",
        root: path.join(root, "agents"),
        include: ["*.toml"],
        to: "agents",
        renderer: "codex-agent",
        stripExtensions: [".toml"],
        ...section("agents", "Agents", "Custom subagents"),
      }),
      mapping(id, {
        id: "hooks-config",
        root,
        include: ["hooks.json"],
        to: "hooks",
        renderer: "codex-hooks",
        ...section("hooks", "Hooks", "Lifecycle hooks"),
      }),
      mapping(id, {
        id: "hooks",
        root: path.join(root, "hooks"),
        include: ["**/*"],
        to: "hooks",
        renderer: "code",
        ...section("hooks", "Hooks", "Lifecycle hooks"),
      }),
      mapping(id, {
        id: "rules",
        root: path.join(root, "rules"),
        include: ["*.rules"],
        to: "rules",
        renderer: "codex-rules",
        stripExtensions: [".rules"],
        ...section("rules", "Rules", "Command approval rules"),
      }),
      mapping(id, {
        id: "skills",
        root: path.join(root, "skills"),
        include: ["*/SKILL.md"],
        to: "skills",
        renderer: "skill",
        stripExtensions: MARKDOWN_EXTENSIONS,
        ...section("skills", "Skills", "Skill packages"),
      }),
      mapping(id, {
        id: "team-skills",
        root: path.join(scanRoot, ".agents", "skills"),
        include: ["*/SKILL.md"],
        to: "skills",
        renderer: "skill",
        stripExtensions: MARKDOWN_EXTENSIONS,
        ...section("skills", "Skills", "Skill packages"),
      }),
    ],
  };
}

export const PRESETS: Record<string, (input: PresetInput) => NormalizedSource> = {
  "claude-code": claudeCode,
  codex,
};
