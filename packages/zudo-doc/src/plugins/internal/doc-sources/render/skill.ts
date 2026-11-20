// Skill package rendering (Claude Code / Codex `SKILL.md` layout). A skill's
// `SKILL.md` becomes its directory landing page; other Markdown files in the
// package become unlisted sub-pages handled by the generic markdown renderer.

import { matter } from "../../../../frontmatter/index.js";
import { escapeForMdx } from "./escape-for-mdx.js";
import { isRecord, type Warn } from "./types.js";

interface TreeNode {
  name: string;
  children: Map<string, TreeNode>;
  isDir: boolean;
}

/** Render a list of POSIX paths as a box-drawing file tree. */
export function renderFileTree(rootName: string, paths: string[]): string {
  const root: TreeNode = { name: rootName, children: new Map(), isDir: true };
  for (const p of paths) {
    let node = root;
    const segments = p.split("/");
    segments.forEach((segment, index) => {
      let child = node.children.get(segment);
      if (child === undefined) {
        child = { name: segment, children: new Map(), isDir: index < segments.length - 1 };
        node.children.set(segment, child);
      }
      node = child;
    });
  }
  const lines = [`${rootName}/`];
  const visit = (node: TreeNode, indent: string) => {
    const children = [...node.children.values()].sort((a, b) => {
      if (a.name === "SKILL.md") return -1;
      if (b.name === "SKILL.md") return 1;
      if (a.isDir !== b.isDir) return a.isDir ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    children.forEach((child, index) => {
      const last = index === children.length - 1;
      lines.push(`${indent}${last ? "└── " : "├── "}${child.name}${child.isDir ? "/" : ""}`);
      if (child.isDir) visit(child, `${indent}${last ? "    " : "│   "}`);
    });
  };
  visit(root, "");
  return lines.join("\n");
}

function optionalMetadataString(
  record: Record<string, unknown>,
  field: string,
  warn: Warn,
): string | undefined {
  const value = record[field];
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  warn(`agents/openai.yaml: ${field} must be a string; omitting it`);
  return undefined;
}

/** Render optional `agents/openai.yaml` interface metadata of a skill. */
export function renderSkillInterfaceMetadata(
  yaml: string,
  skillName: string,
  warn: Warn,
): string {
  let data: unknown;
  try {
    data = matter(`---\n${yaml}\n---\n`).data;
  } catch (error) {
    warn(`agents/openai.yaml: unable to parse YAML, omitting metadata: ${String(error)}`);
    return "";
  }
  if (!isRecord(data)) {
    warn("agents/openai.yaml: YAML root must be an object; omitting metadata");
    return "";
  }
  const interfaceData = isRecord(data.interface) ? data.interface : undefined;
  if (data.interface !== undefined && interfaceData === undefined) {
    warn("agents/openai.yaml: interface must be an object; omitting interface metadata");
  }
  const policy = isRecord(data.policy) ? data.policy : undefined;
  if (data.policy !== undefined && policy === undefined) {
    warn("agents/openai.yaml: policy must be an object; omitting policy metadata");
  }
  const displayName = interfaceData
    ? optionalMetadataString(interfaceData, "display_name", warn)
    : undefined;
  const shortDescription = interfaceData
    ? optionalMetadataString(interfaceData, "short_description", warn)
    : undefined;
  let explicitOnly = false;
  if (policy?.allow_implicit_invocation !== undefined) {
    if (typeof policy.allow_implicit_invocation === "boolean") {
      explicitOnly = policy.allow_implicit_invocation === false;
    } else {
      warn("agents/openai.yaml: policy.allow_implicit_invocation must be a boolean; omitting invocation metadata");
    }
  }
  return [
    displayName ? `**Display name:** ${escapeForMdx(displayName)}` : "",
    shortDescription ? `**Short description:** ${escapeForMdx(shortDescription)}` : "",
    explicitOnly ? `**Invocation:** explicit only (\`$${skillName}\`)` : "",
  ].filter(Boolean).join("\n");
}

/**
 * The "File Structure" section of a skill landing page. Markdown files get
 * source-relative links; the shared link pass resolves them to routes.
 */
export function renderSkillFileStructure(skillDirName: string, tree: string[]): string {
  if (tree.length === 0) return "";
  const block = `\`\`\`\n${renderFileTree(skillDirName, ["SKILL.md", ...tree])}\n\`\`\``;
  const links = tree
    .filter((p) => /\.mdx?$/i.test(p))
    .map((p) => `- [${p}](${p.split("/").map(encodeURIComponent).join("/")})`);
  return `## File Structure\n\n${block}${links.length > 0 ? `\n\n${links.join("\n")}` : ""}`;
}
