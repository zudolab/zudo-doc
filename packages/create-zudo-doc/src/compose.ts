import fs from "fs-extra";
import path from "path";
import type { UserChoices } from "./prompts.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single injection into a shared file at an anchor point. */
export interface Injection {
  /** Target file path relative to project root */
  file: string;
  /** Anchor comment string to locate in the target file */
  anchor: string;
  /** Content to insert */
  content: string;
  /**
   * Where to insert relative to the anchor line.
   * - "before": insert content on the line before the anchor (default)
   * - "after": insert content on the line after the anchor
   * - "replace": replace the range between `anchor` (start) and the
   *   corresponding `:end` anchor. The anchor must end with `:start`
   *   and a sibling anchor ending with `:end` must exist.
   */
  position?: "before" | "after" | "replace";
}

/** Definition of a single feature's contribution to the generated project. */
export interface FeatureDefinition {
  /** Feature key (matches constants.ts value or internal name) */
  name: string;
  /**
   * Files to copy from the feature's `files/` directory into the target.
   * Paths are relative to the feature's `files/` dir and mirror the project
   * structure (e.g. `src/components/search.astro`).
   */
  files: string[];
  /** Injection instructions for shared/base files */
  injections: Injection[];
  /** Other feature names this feature depends on (optional) */
  dependencies?: string[];
  /**
   * Post-processing hook for complex transformations that cannot be expressed
   * as simple file copies or anchor injections (e.g. i18n page patching).
   */
  postProcess?: (targetDir: string, choices: UserChoices) => Promise<void>;
}

/**
 * A function that returns a FeatureDefinition based on user choices.
 * This allows injections to be conditional on other choices.
 */
export type FeatureModule = (choices: UserChoices) => FeatureDefinition;

// ---------------------------------------------------------------------------
// Anchor patterns
// ---------------------------------------------------------------------------

/** Regex that matches any line containing an @slot anchor comment. */
const ANCHOR_LINE_RE = /^[ \t]*(?:\/\/|\/\*|<!--|#)\s*@slot:[^\n]*(?:\*\/|-->)?[ \t]*\r?\n?$/gm;

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Apply a list of injections to files in the target directory.
 *
 * Injections are grouped by target file and applied in array order.
 * For "before"/"after" modes the content is inserted relative to the anchor
 * line. For "replace" mode, the content replaces everything between the
 * `:start` and `:end` anchors (exclusive — the anchor lines themselves are
 * also removed).
 */
export async function applyInjections(
  targetDir: string,
  injections: Injection[],
): Promise<void> {
  // Group injections by target file
  const byFile = new Map<string, Injection[]>();
  for (const inj of injections) {
    const list = byFile.get(inj.file) ?? [];
    list.push(inj);
    byFile.set(inj.file, list);
  }

  for (const [relPath, fileInjections] of byFile) {
    const filePath = path.join(targetDir, relPath);
    if (!(await fs.pathExists(filePath))) continue;

    let content = await fs.readFile(filePath, "utf-8");

    for (const inj of fileInjections) {
      const mode = inj.position ?? "before";

      if (mode === "replace") {
        // Range-based replacement: find :start and :end anchors
        const startAnchor = inj.anchor; // must end with :start
        const endAnchor = inj.anchor.replace(/:start\b/, ":end");
        const startIdx = content.indexOf(startAnchor);
        const endIdx = content.indexOf(endAnchor);
        if (startIdx === -1 || endIdx === -1) continue;

        // Find the full lines containing the anchors
        const startLineBegin = content.lastIndexOf("\n", startIdx) + 1;
        const endLineEnd = content.indexOf("\n", endIdx);
        const actualEnd = endLineEnd === -1 ? content.length : endLineEnd + 1;

        content =
          content.slice(0, startLineBegin) +
          inj.content +
          (inj.content.endsWith("\n") ? "" : "\n") +
          content.slice(actualEnd);
      } else {
        // before / after: find the anchor line and insert relative to it
        const anchorIdx = content.indexOf(inj.anchor);
        if (anchorIdx === -1) continue;

        const lineStart = content.lastIndexOf("\n", anchorIdx) + 1;
        const lineEnd = content.indexOf("\n", anchorIdx);
        const actualLineEnd = lineEnd === -1 ? content.length : lineEnd + 1;

        if (mode === "before") {
          content =
            content.slice(0, lineStart) +
            inj.content +
            (inj.content.endsWith("\n") ? "" : "\n") +
            content.slice(lineStart);
        } else {
          // after
          content =
            content.slice(0, actualLineEnd) +
            inj.content +
            (inj.content.endsWith("\n") ? "" : "\n") +
            content.slice(actualLineEnd);
        }
      }
    }

    await fs.writeFile(filePath, content);
  }
}

/**
 * Remove all remaining `@slot:` anchor lines from files in the target
 * directory. Call this after all injections have been applied so that
 * unused anchors don't appear in the generated project.
 */
export async function cleanAnchors(
  targetDir: string,
  files: string[],
): Promise<void> {
  for (const relPath of files) {
    const filePath = path.join(targetDir, relPath);
    if (!(await fs.pathExists(filePath))) continue;

    const content = await fs.readFile(filePath, "utf-8");
    let cleaned = content.replace(ANCHOR_LINE_RE, "");
    // Collapse runs of 3+ consecutive newlines down to 2 (one blank line)
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
    if (cleaned !== content) {
      await fs.writeFile(filePath, cleaned);
    }
  }
}

/**
 * Copy a feature's files into the target directory.
 * `featureFilesDir` is the absolute path to the feature's `files/` directory.
 * Each file inside mirrors the project directory structure.
 */
export async function copyFeatureFiles(
  featureFilesDir: string,
  targetDir: string,
): Promise<void> {
  if (!(await fs.pathExists(featureFilesDir))) return;
  await fs.copy(featureFilesDir, targetDir, { overwrite: true });
}

/**
 * Resolve which features are selected based on UserChoices.
 * Handles special cases like the footer pseudo-feature.
 */
export function resolveSelectedFeatures(
  choices: UserChoices,
  featureModules: Record<string, FeatureModule>,
): FeatureDefinition[] {
  const selected: FeatureDefinition[] = [];

  for (const [name, moduleFn] of Object.entries(featureModules)) {
    // Special case: footer is activated by either footerNavGroup or footerCopyright
    if (name === "footer") {
      if (
        choices.features.includes("footerNavGroup") ||
        choices.features.includes("footerCopyright")
      ) {
        selected.push(moduleFn(choices));
      }
      continue;
    }

    if (choices.features.includes(name)) {
      selected.push(moduleFn(choices));
    }
  }

  return selected;
}

/**
 * Validate that all feature dependencies are satisfied.
 * Throws if a selected feature depends on one that isn't selected.
 */
export function validateDependencies(
  features: FeatureDefinition[],
  allSelectedNames: Set<string>,
): void {
  for (const feature of features) {
    if (!feature.dependencies) continue;
    for (const dep of feature.dependencies) {
      if (!allSelectedNames.has(dep)) {
        throw new Error(
          `Feature "${feature.name}" requires "${dep}" but it is not selected.`,
        );
      }
    }
  }
}

/** Files that may contain injection anchors and need cleaning. */
export const ANCHOR_FILES = [
  "src/layouts/doc-layout.astro",
  "src/components/header.astro",
  "src/styles/global.css",
];

/**
 * Main composition entry point. Orchestrates the full feature composition
 * pipeline for a generated project.
 *
 * 1. Resolve selected features
 * 2. Validate dependencies
 * 3. Copy feature files
 * 4. Apply all injections
 * 5. Run post-processing hooks
 * 6. Clean up unused anchors
 */
export async function composeFeatures(
  targetDir: string,
  choices: UserChoices,
  featureModules: Record<string, FeatureModule>,
  featuresDir: string,
): Promise<void> {
  // 1. Resolve
  const features = resolveSelectedFeatures(choices, featureModules);
  const selectedNames = new Set(features.map((f) => f.name));

  // 2. Validate
  validateDependencies(features, selectedNames);

  // 3. Copy feature files
  for (const feature of features) {
    const filesDir = path.join(featuresDir, feature.name, "files");
    await copyFeatureFiles(filesDir, targetDir);
  }

  // 4. Collect and apply all injections
  const allInjections: Injection[] = [];
  for (const feature of features) {
    allInjections.push(...feature.injections);
  }
  await applyInjections(targetDir, allInjections);

  // 5. Post-processing
  for (const feature of features) {
    if (feature.postProcess) {
      await feature.postProcess(targetDir, choices);
    }
  }

  // 6. Clean up unused anchors
  await cleanAnchors(targetDir, ANCHOR_FILES);
}
