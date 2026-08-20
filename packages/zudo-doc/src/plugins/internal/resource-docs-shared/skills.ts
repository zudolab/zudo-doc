import fs from "node:fs";
import path from "node:path";
import { escapeForMdx } from "./escape-for-mdx.js";
import {
  assertNotIndexReserved,
  escapeTitle,
  parseFrontmatter,
  writeCategoryIndex,
  writeUnlistedSubPage,
} from "./mdx.js";
import { cleanDir, ensureDir, listFiles } from "./fs.js";

export interface SkillReference {
  name: string;
  title: string;
  content: string;
}

export interface SkillItem {
  name: string;
  dir: string;
  description: string;
  references: SkillReference[];
}

export type RenderExtraHeader = (skillAbsDir: string) => string;

export interface GenerateSkillsCategoryOptions {
  skillsDirs: string[];
  outputDir: string;
  label: string;
  position: number;
  description: string;
  sourceLabel: string;
  renderExtraHeader?: RenderExtraHeader;
}

type TreeEntry =
  | { isDir: false; name: string }
  | { isDir: true; name: string; children: string[] };

export function getSkillFileTree(
  skillDir: string,
  subDirs: { name: string; files: string[] }[],
): string {
  const lines: string[] = [`${skillDir}/`];
  const entries: TreeEntry[] = [{ isDir: false, name: "SKILL.md" }];

  for (const sub of subDirs) {
    entries.push({ isDir: true, name: sub.name, children: sub.files });
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    const isLast = i === entries.length - 1;
    const prefix = isLast ? "└── " : "├── ";

    if (!entry.isDir) {
      lines.push(`${prefix}${entry.name}`);
    } else {
      lines.push(`${prefix}${entry.name}/`);
      for (let j = 0; j < entry.children.length; j++) {
        const child = entry.children[j];
        if (!child) continue;
        const childIsLast = j === entry.children.length - 1;
        const continuation = isLast ? "    " : "│   ";
        const childPrefix = childIsLast ? "└── " : "├── ";
        lines.push(`${continuation}${childPrefix}${child}`);
      }
    }
  }

  return lines.join("\n");
}

export function getScriptDescription(filePath: string): string {
  try {
    const topLines = fs.readFileSync(filePath, "utf8").split("\n", 2);
    // Skip shebang, use second line if available
    const firstLine = topLines[0] ?? "";
    const commentLine = firstLine.startsWith("#!")
      ? topLines[1] ?? ""
      : firstLine;
    // Match # comments (shell/python) or // comments (JS/TS)
    const match = commentLine.match(/^(?:#|\/\/)\s*(.+)/);
    return match ? ` — ${match[1]}` : "";
  } catch {
    return "";
  }
}

export function getSkillReferences(
  skillsDir: string,
  skillDir: string,
): SkillReference[] {
  const refsDir = path.join(skillsDir, skillDir, "references");
  if (!fs.existsSync(refsDir)) return [];

  let files: string[];
  try {
    files = fs.readdirSync(refsDir);
  } catch (error) {
    console.warn(
      `resource-docs: unable to read references directory "${refsDir}", skipping it: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }

  return files
    .filter((f) => f.endsWith(".md"))
    .flatMap((f) => {
      const refPath = path.join(refsDir, f);
      let content: string;
      try {
        content = fs.readFileSync(refPath, "utf8");
      } catch (error) {
        console.warn(
          `resource-docs: unable to read skill reference "${refPath}", skipping it: ${error instanceof Error ? error.message : String(error)}`,
        );
        return [];
      }
      const name = f.replace(/\.md$/, "");
      const h1Match = content.match(/^#\s+(.+)$/m);
      const title = h1Match?.[1] ?? name;
      return [{ name, title, content }];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function realPathOrWarn(filePath: string): string | null {
  try {
    return fs.realpathSync(filePath);
  } catch (error) {
    console.warn(
      `resource-docs: unable to resolve skills directory "${filePath}", skipping it: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

function readSkillDirs(skillsDir: string): string[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(skillsDir);
  } catch (error) {
    console.warn(
      `resource-docs: unable to read skills directory "${skillsDir}", skipping it: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }

  return entries.filter((dir) => {
    if (dir.startsWith(".")) return false;
    const skillPath = path.join(skillsDir, dir);
    try {
      return (
        fs.statSync(skillPath).isDirectory() &&
        fs.existsSync(path.join(skillPath, "SKILL.md"))
      );
    } catch (error) {
      console.warn(
        `resource-docs: unable to read skill directory "${skillPath}", skipping it: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  });
}

function readSkillFiles(dir: string): string[] {
  try {
    return listFiles(dir);
  } catch (error) {
    console.warn(
      `resource-docs: unable to read skill files in "${dir}", skipping them: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

/**
 * Generate a category containing Claude/Codex-shaped skill packages.
 *
 * Roots are considered in order. A root reached through more than one path is
 * visited once; when distinct roots contain the same skill name, the first
 * root wins and the later package is skipped.
 */
export function generateSkillsCategory({
  skillsDirs,
  outputDir,
  label,
  position,
  description,
  sourceLabel,
  renderExtraHeader,
}: GenerateSkillsCategoryOptions): SkillItem[] {
  cleanDir(outputDir);

  const roots: { sourceDir: string; realDir: string }[] = [];
  const seenRoots = new Set<string>();
  for (const skillsDir of skillsDirs) {
    if (!fs.existsSync(skillsDir)) continue;
    const realDir = realPathOrWarn(skillsDir);
    if (realDir === null || seenRoots.has(realDir)) continue;
    seenRoots.add(realDir);
    roots.push({ sourceDir: skillsDir, realDir });
  }

  if (roots.length === 0) return [];

  const discovered: {
    sourceDir: string;
    dir: string;
    skillAbsDir: string;
    realSkillDir: string;
  }[] = [];
  const seenSkillDirs = new Set<string>();
  const seenNames = new Map<string, string>();
  for (const root of roots) {
    for (const dir of readSkillDirs(root.sourceDir)) {
      const skillAbsDir = path.join(root.sourceDir, dir);
      const realSkillDir = realPathOrWarn(skillAbsDir);
      if (realSkillDir === null || seenSkillDirs.has(realSkillDir)) continue;
      seenSkillDirs.add(realSkillDir);
      const previous = seenNames.get(dir);
      if (previous !== undefined) {
        console.warn(
          `resource-docs: skill "${dir}" from "${root.sourceDir}" conflicts with the skill from "${previous}"; keeping the first one.`,
        );
        continue;
      }
      seenNames.set(dir, root.sourceDir);
      discovered.push({ sourceDir: root.sourceDir, dir, skillAbsDir, realSkillDir });
    }
  }

  if (discovered.length === 0) return [];

  ensureDir(outputDir);
  const items: SkillItem[] = [];
  const resourcePrefix = sourceLabel.startsWith(".claude/")
    ? "claude-resources"
    : "codex-resources";

  for (const discoveredSkill of discovered) {
    const { sourceDir, dir, skillAbsDir } = discoveredSkill;
    assertNotIndexReserved(
      dir,
      `${resourcePrefix}: skill directory "${sourceLabel}/index/" uses the reserved name "index", which is used for the category metadata file. Rename the skill directory to resolve the conflict.`,
    );
    let content: string;
    try {
      content = fs.readFileSync(path.join(skillAbsDir, "SKILL.md"), "utf8");
    } catch (error) {
      console.warn(
        `resource-docs: unable to read skill "${skillAbsDir}/SKILL.md", skipping it: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }
    const parsed = parseFrontmatter(content);
    if (!parsed) continue;

    const name = (parsed.data.name as string) || dir;
    const skillDescription = (parsed.data.description as string) || "";
    const references = getSkillReferences(sourceDir, dir);

    items.push({ name, dir, description: skillDescription, references });

    const scriptFiles = readSkillFiles(path.join(skillAbsDir, "scripts"));
    const assetFiles = readSkillFiles(path.join(skillAbsDir, "assets"));
    const refFiles = references.map((r) => `${r.name}.md`);

    // Collect non-empty subdirectories for tree display
    const subDirs: { name: string; files: string[] }[] = [];
    if (scriptFiles.length > 0) subDirs.push({ name: "scripts", files: scriptFiles });
    if (refFiles.length > 0) subDirs.push({ name: "references", files: refFiles });
    if (assetFiles.length > 0) subDirs.push({ name: "assets", files: assetFiles });

    // File tree + links to renderable .md sub-files
    let fileStructureSection = "";
    if (subDirs.length > 0) {
      const tree = `\`\`\`\n${getSkillFileTree(dir, subDirs)}\n\`\`\``;

      // Collect links to all .md sub-files that get pages. Links use
      // ./<subpage>; because the skill page is written as `<dir>/index.mdx`,
      // these resolve to the sibling `<dir>/<subpage>.mdx` files (#2411).
      const links: string[] = [];
      for (const ref of references) {
        links.push(`- [references/${ref.name}.md](./ref-${ref.name})`);
      }
      for (const f of scriptFiles.filter((s) => s.endsWith(".md"))) {
        const slug = f.replace(/\.md$/, "");
        links.push(`- [scripts/${f}](./script-${slug})`);
      }
      for (const f of assetFiles.filter((a) => a.endsWith(".md"))) {
        const slug = f.replace(/\.md$/, "");
        links.push(`- [assets/${f}](./asset-${slug})`);
      }

      const linkList = links.length > 0 ? `\n\n${links.join("\n")}` : "";
      fileStructureSection = `## File Structure\n\n${tree}${linkList}`;
    }

    const shortDesc = skillDescription.length > 200
      ? skillDescription.substring(0, 200) + "..."
      : skillDescription;
    let extraHeader = "";
    if (renderExtraHeader) {
      try {
        extraHeader = renderExtraHeader(skillAbsDir).trim();
      } catch (error) {
        console.warn(
          `resource-docs: unable to render extra metadata for skill "${skillAbsDir}", skipping it: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Rewrite references/scripts/assets links in skill body to match doc site URLs
    let skillBody = parsed.content.trim();
    skillBody = skillBody
      .replace(/\]\(references\/([^)]+)\.md\)/g, "](./ref-$1)")
      .replace(/\]\(scripts\/([^)]+)\.md\)/g, "](./script-$1)")
      .replace(/\]\(assets\/([^)]+)\.md\)/g, "](./asset-$1)");

    const body = [
      extraHeader,
      fileStructureSection,
      escapeForMdx(skillBody),
    ]
      .filter(Boolean)
      .join("\n\n");

    const mdx = `---
title: "${escapeTitle(name)}"
description: "${escapeTitle(shortDesc)}"
sidebar_label: "${escapeTitle(name)}"
generated: true
---

${body}`;

    // Write the skill page as the directory index (`<dir>/index.mdx`) so its
    // route is `claude-skills/<dir>` served at URL `.../claude-skills/<dir>/`.
    // This makes the reference/script/asset pages genuine siblings inside
    // `<dir>/`, which is what lets the `./ref-<name>` links above resolve.
    const skillDirOut = path.join(outputDir, dir);
    ensureDir(skillDirOut);
    fs.writeFileSync(path.join(skillDirOut, "index.mdx"), mdx);

    // Generate unlisted sub-pages as nested files inside `<dir>/`. Their routes
    // (`claude-skills/<dir>/ref-<name>`, …) are derived from these file paths
    // and therefore match the `./ref-<name>` / `./script-<name>` /
    // `./asset-<name>` links emitted above (#2411).
    for (const ref of references) {
      writeUnlistedSubPage(
        path.join(skillDirOut, `ref-${ref.name}.mdx`),
        ref.title,
        escapeForMdx(ref.content.trim()),
      );
    }

    for (const f of scriptFiles.filter((s) => s.endsWith(".md"))) {
      const slug = f.replace(/\.md$/, "");
      const scriptPath = path.join(skillAbsDir, "scripts", f);
      let raw: string;
      try {
        raw = fs.readFileSync(scriptPath, "utf8");
      } catch (error) {
        console.warn(
          `resource-docs: unable to read skill script "${scriptPath}", skipping it: ${error instanceof Error ? error.message : String(error)}`,
        );
        continue;
      }
      const h1Match = raw.match(/^#\s+(.+)$/m);
      const title = h1Match?.[1] ?? slug;
      writeUnlistedSubPage(
        path.join(skillDirOut, `script-${slug}.mdx`),
        title,
        escapeForMdx(raw.trim()),
      );
    }

    for (const f of assetFiles.filter((a) => a.endsWith(".md"))) {
      const slug = f.replace(/\.md$/, "");
      const assetPath = path.join(skillAbsDir, "assets", f);
      let raw: string;
      try {
        raw = fs.readFileSync(assetPath, "utf8");
      } catch (error) {
        console.warn(
          `resource-docs: unable to read skill asset "${assetPath}", skipping it: ${error instanceof Error ? error.message : String(error)}`,
        );
        continue;
      }
      const h1Match = raw.match(/^#\s+(.+)$/m);
      const title = h1Match?.[1] ?? slug;
      writeUnlistedSubPage(
        path.join(skillDirOut, `asset-${slug}.mdx`),
        title,
        escapeForMdx(raw.trim()),
      );
    }
  }

  items.sort((a, b) => a.name.localeCompare(b.name));

  writeCategoryIndex(outputDir, label, position, description);
  return items;
}
