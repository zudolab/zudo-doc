// General integration guard for issue #2949 (epic #2946, Wave 3 — the
// confirm/integration wave). Waves 1-2 (#2947, #2948) added a denylist lint
// that catches KNOWN broken idioms (e.g. stale absolute-path phrasing) in
// the 3 shipped `claudeSkills` variants. That lint cannot catch a NEW dead
// reference it doesn't already know to look for. This test is the general
// guard: it generates REAL scaffolds via the same `scaffold()` harness used
// throughout this package's suite, then asserts every repo-relative path
// mentioned in each shipped skill's SKILL.md body actually exists in the
// generated project.
//
// Two shapes are exercised:
//   (a) minimal + claudeSkills only        — no i18n / versioning / changelog
//   (b) claudeSkills + i18n + versioning + changelog
// Shape (b) enables BOTH `versioning` and `changelog` because the SINGULAR
// `changelog` feature is what seeds `src/content/docs/changelog/` — the
// `versioning` feature alone never creates a changelog page (see
// `src/features/versioning.ts`'s header comment: it is purely a
// `zudoDoc({ versions: [] })` config field, no file copy). Shape (b) is the
// only shape that exercises the version-bump skill's changelog-update
// positive path.
//
// Design choice — CONDITIONAL_PATHS allowlist over block-parsing:
// The 3 variant SKILL.md files phrase "this only applies if feature X is
// on" in several different, not-machine-uniform ways ("if that file does
// not exist ... skip this whole section", "Only applies when this
// project's i18n feature is enabled", "if enabled, major bumps only" in a
// heading). Parsing those into a reliable "inside a conditional block"
// boundary detector would be more fragile than the actual conditional
// surface it needs to cover: across all 3 skills there are only 3 literal
// path tokens that are genuinely feature-gated. An explicit allowlist below
// (`CONDITIONAL_PATHS`, keyed by the `UserChoices.features` id(s) that must
// be enabled for the path to exist) is simpler, auditable at a glance, and
// — unlike a heading/section scanner — can't silently swallow an
// unconditional reference that happens to sit inside a conditional
// section's prose.
//
// A separate small `EXCLUDED_PATHS` set holds path-shaped tokens that are
// illustrative/aspirational rather than assertions that the path exists in
// a fresh scaffold (documented per-entry below).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import type { UserChoices } from "../prompts.js";
import { scaffold } from "../scaffold.js";

const TEMP_PREFIX = "create-zudo-doc-skill-refs-";

let tempDir: string;
let originalCwd: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
  process.chdir(tempDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await fs.remove(tempDir);
});

const SKILLS = [
  "zudo-doc-version-bump",
  "zudo-doc-design-system",
  "zudo-doc-translate",
] as const;

// Recognized repo-relative path shapes. Deliberately narrow — the goal is
// to catch backtick-wrapped tokens that read as a real file/dir reference,
// not every backtick span in the document (most are CLI commands, Tailwind
// classes, or conventional-commit prefixes).
const PATH_PREFIXES = ["src/", "scripts/", "pages/", "packages/", ".claude/"];
const KNOWN_ROOT_FILES = new Set([
  "package.json",
  "zfb.config.ts",
  "CLAUDE.md",
  ".gitignore",
  ".npmrc",
  "tsconfig.json",
  "pnpm-workspace.yaml",
]);

function looksLikeRepoPath(token: string): boolean {
  // Reject placeholder/templated tokens (`{NEW_VERSION}`, `<pm>`,
  // `docs-v*`), and anything with whitespace or an ellipsis (illustrative
  // "..." lists, not literal paths).
  if (/[{}<>*]/.test(token)) return false;
  if (token.includes("...")) return false;
  if (/\s/.test(token)) return false;
  if (PATH_PREFIXES.some((prefix) => token.startsWith(prefix))) return true;
  return KNOWN_ROOT_FILES.has(token);
}

/** Extract candidate repo-relative path references from a SKILL.md body. */
function extractReferencedPaths(markdown: string): string[] {
  // Strip fenced code blocks first — shell/mdx snippets contain templated
  // paths (`src/content/docs-v{OLD_SLUG}`) and are never the source of a
  // *documented* path claim; the prose around them (headings, sentences)
  // is what asserts a path's existence, and that prose always uses
  // single-backtick inline spans. Trade-off: a dead path that appears ONLY
  // inside a fenced code block is not checked (a real but low-risk
  // false-negative window), and widening the scan to fenced spans would
  // risk false positives on illustrative example paths — so the
  // single-backtick prose spans are the intentional scan surface.
  const withoutFences = markdown.replace(/```[\s\S]*?```/g, "");
  const spans = [...withoutFences.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]!);
  return [...new Set(spans.filter(looksLikeRepoPath))];
}

// Path -> the UserChoices feature id(s) that must ALL be enabled for the
// path to exist in a generated scaffold. Only asserted when every listed
// feature is present in the shape under test (shape (a) skips all of
// these; shape (b) enables all of them).
const CONDITIONAL_PATHS: Record<string, string[]> = {
  // zudo-doc-version-bump: "### English changelog" section — the
  // `changelog` feature is what seeds this file (versioning alone does not).
  "src/content/docs/changelog/index.mdx": ["changelog"],
  // zudo-doc-version-bump: "### Japanese changelog" section — needs BOTH
  // the changelog page (changelog) and the secondary content dir (i18n).
  "src/content/docs-ja/changelog/index.mdx": ["changelog", "i18n"],
  // zudo-doc-version-bump ("...and `src/content/docs-ja/`) now represent
  // the new, latest version") + zudo-doc-translate (secondary-locale docs
  // dir) — only exists when i18n is on.
  "src/content/docs-ja/": ["i18n"],
};

// Path-shaped tokens that are illustrative/aspirational, not a claim the
// path pre-exists in a fresh scaffold. Excluded from the exists-check
// entirely (in both shapes).
const EXCLUDED_PATHS = new Set([
  // zudo-doc-design-system: "any NEW component you add under
  // `src/components/`" — forward-looking guidance for future additions,
  // not an assertion the directory exists today. Confirmed absent from a
  // barebone+claudeSkills scaffold (see scaffold.test.ts's own "barebone
  // has no ... src/components ... directory at all" assertion).
  "src/components/",
  // zudo-doc-translate "File Naming" section: "Example:
  // `src/content/docs/guides/writing-docs.mdx` -> ...-ja/...". An
  // arbitrary illustrative filename to demonstrate the docs/ vs docs-ja/
  // mirroring rule — scaffold seed content only ever creates a
  // `getting-started/` directory, never `guides/`.
  "src/content/docs/guides/writing-docs.mdx",
  "src/content/docs-ja/guides/writing-docs.mdx",
]);

async function scaffoldShape(
  projectName: string,
  features: string[],
): Promise<string> {
  const choices: UserChoices = {
    projectName,
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features,
    packageManager: "pnpm",
  };
  await scaffold(choices);
  return path.join(tempDir, projectName);
}

interface RefVerdict {
  skill: (typeof SKILLS)[number];
  refPath: string;
  conditional: boolean;
  required: boolean;
  exists: boolean;
}

/**
 * Read each shipped skill's SKILL.md from the GENERATED project (a plain
 * `fs.copy` of the template — see scaffold.ts's claudeSkills block — so its
 * content is byte-identical to the template, but reading the generated
 * copy keeps this an end-to-end check of the real scaffold output), extract
 * every path-shaped reference, and resolve each against `enabledFeatures`
 * to decide whether it's required to exist for this shape.
 */
async function collectRefVerdicts(
  projectDir: string,
  enabledFeatures: string[],
): Promise<RefVerdict[]> {
  const verdicts: RefVerdict[] = [];
  for (const skill of SKILLS) {
    const skillMdPath = path.join(
      projectDir,
      ".claude/skills",
      skill,
      "SKILL.md",
    );
    expect(await fs.pathExists(skillMdPath)).toBe(true);
    const content = await fs.readFile(skillMdPath, "utf-8");
    const refs = extractReferencedPaths(content);
    for (const refPath of refs) {
      if (EXCLUDED_PATHS.has(refPath)) continue;
      const gatingFeatures = CONDITIONAL_PATHS[refPath];
      const conditional = gatingFeatures !== undefined;
      const required =
        !conditional ||
        gatingFeatures!.every((f) => enabledFeatures.includes(f));
      if (!required) continue;
      const exists = await fs.pathExists(path.join(projectDir, refPath));
      verdicts.push({ skill, refPath, conditional, required, exists });
    }
  }
  return verdicts;
}

describe("claude-skills scaffold refs — generated-scaffold integration guard (#2949)", () => {
  it("shape (a) minimal + claudeSkills only: every unconditional referenced path exists", async () => {
    const features = ["claudeSkills"];
    const dir = await scaffoldShape("shape-a-minimal-skills", features);

    const verdicts = await collectRefVerdicts(dir, features);
    const missing = verdicts.filter((v) => !v.exists);
    expect(missing).toEqual([]);
    // Sanity: the extraction actually found references — an empty result
    // would make the exists-check pass vacuously.
    expect(verdicts.length).toBeGreaterThan(0);
    // None of the conditional (i18n/changelog) paths should have been
    // pulled in — none of their gating features are enabled in this shape.
    expect(verdicts.some((v) => v.conditional)).toBe(false);

    const pkg = await fs.readJson(path.join(dir, "package.json"));
    expect(pkg.scripts.b4push).toBe("pnpm check && pnpm build");
  });

  it("shape (b) claudeSkills + i18n + versioning + changelog: every referenced path (incl. conditional) exists", async () => {
    const features = ["claudeSkills", "i18n", "versioning", "changelog"];
    const dir = await scaffoldShape("shape-b-full", features);

    const verdicts = await collectRefVerdicts(dir, features);
    const missing = verdicts.filter((v) => !v.exists);
    expect(missing).toEqual([]);
    expect(verdicts.length).toBeGreaterThan(0);
    // All 3 CONDITIONAL_PATHS entries must actually have been exercised
    // here — if a variant's wording drifts and no longer matches an entry,
    // this catches the allowlist going stale (silently asserting nothing).
    const conditionalRefsSeen = new Set(
      verdicts.filter((v) => v.conditional).map((v) => v.refPath),
    );
    for (const conditionalPath of Object.keys(CONDITIONAL_PATHS)) {
      expect(conditionalRefsSeen.has(conditionalPath)).toBe(true);
    }

    const pkg = await fs.readJson(path.join(dir, "package.json"));
    expect(pkg.scripts.b4push).toBe("pnpm check && pnpm build");
  });
});
