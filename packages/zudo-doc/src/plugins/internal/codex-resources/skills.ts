import fs from "node:fs";
import path from "node:path";
import { matter } from "../../../frontmatter/index.js";
import {
  escapeForMdx,
  formatFrontmatterString,
  generateSkillsCategory,
} from "../resource-docs-shared/index.js";
import { isRecord, warn } from "./utils.js";
import type { CodexResourcesConfig } from "./generate.js";

function optionalMetadataString(
  record: Record<string, unknown>,
  field: string,
  filePath: string,
): string | undefined {
  const value = record[field];
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  warn(filePath, `${field} must be a string; omitting it`);
  return undefined;
}

function renderOpenAiMetadata(skillAbsDir: string): string {
  const filePath = path.join(skillAbsDir, "agents", "openai.yaml");
  if (!fs.existsSync(filePath)) return "";
  let data: unknown;
  try {
    const yaml = fs.readFileSync(filePath, "utf8");
    data = matter(`---\n${yaml}\n---\n`).data;
  } catch (error) {
    warn(filePath, `unable to parse YAML, omitting metadata: ${String(error)}`);
    return "";
  }
  if (!isRecord(data)) {
    warn(filePath, "YAML root must be an object; omitting metadata");
    return "";
  }

  let interfaceData: Record<string, unknown> | undefined;
  if (data.interface !== undefined) {
    if (isRecord(data.interface)) interfaceData = data.interface;
    else warn(filePath, "interface must be an object; omitting interface metadata");
  }
  let policy: Record<string, unknown> | undefined;
  if (data.policy !== undefined) {
    if (isRecord(data.policy)) policy = data.policy;
    else warn(filePath, "policy must be an object; omitting policy metadata");
  }

  const displayName = interfaceData
    ? optionalMetadataString(interfaceData, "display_name", filePath)
    : undefined;
  const shortDescription = interfaceData
    ? optionalMetadataString(interfaceData, "short_description", filePath)
    : undefined;
  let explicitOnly = false;
  if (policy?.allow_implicit_invocation !== undefined) {
    if (typeof policy.allow_implicit_invocation === "boolean") {
      explicitOnly = policy.allow_implicit_invocation === false;
    } else {
      warn(
        filePath,
        "policy.allow_implicit_invocation must be a boolean; omitting invocation metadata",
      );
    }
  }

  return [
    displayName ? `**Display name:** ${escapeForMdx(displayName)}` : "",
    shortDescription
      ? `**Short description:** ${escapeForMdx(shortDescription)}`
      : "",
    explicitOnly
      ? `**Invocation:** explicit only (\`$${path.basename(skillAbsDir)}\`)`
      : "",
  ].filter(Boolean).join("\n");
}

export function generateSkillsCategoryDocs(config: CodexResourcesConfig) {
  const projectRoot = config.projectRoot ?? config.codexDir;
  const scanRoot = config.scanRoot ?? projectRoot;
  return generateSkillsCategory({
    skillsDirs: [
      path.join(config.codexDir, "skills"),
      path.join(projectRoot, ".agents", "skills"),
      path.join(scanRoot, ".agents", "skills"),
    ],
    outputDir: path.join(config.docsDir, "codex-skills"),
    label: "Skills",
    position: 910,
    description: "Skill packages",
    sourceLabel: ".codex/skills",
    renderExtraHeader: renderOpenAiMetadata,
    renderFrontmatterString: formatFrontmatterString,
  });
}
