import type { UserChoices } from "./prompts.js";
import type { LocalePlan } from "./locale-plan.js";
import { capitalize, pmRunCommand } from "./utils.js";

/**
 * The scaffold's single editorial policy file. README.md, CLAUDE.md, and
 * AGENTS.md all point at this one path; detailed category rules live only
 * here so they cannot drift between copies.
 */
export const AUTHORING_POLICY_FILE = "AUTHORING.md";

// Points at the guide's source on GitHub rather than the showcase site, so a
// generated project names no owner-hosted domain (the MCP scaffold guards
// against takazudomodular references in every generated file).
export const MAINTAINING_STRUCTURE_GUIDE_URL =
  "https://github.com/zudolab/zudo-doc/blob/main/src/content/docs/guides/maintaining-documentation-structure.mdx";

/**
 * The agent-facing pointer shared verbatim by the generated CLAUDE.md and
 * AGENTS.md. It names the policy and the three checks, and nothing that
 * depends on an optional feature, so it holds with every feature off.
 */
export function documentationStructureSection(): string[] {
  return [
    `## Documentation structure`,
    ``,
    `Before adding a page, changing what a page is for, or changing a category, read \`${AUTHORING_POLICY_FILE}\` — this project's single editorial policy. Check for an existing page with the same role, the right category for the content, and whether the change alters what a category means. \`${AUTHORING_POLICY_FILE}\` holds the category boundaries and the minimal procedure; do not copy its category rules into this file.`,
    ``,
    `Typo, wording, and formatting fixes skip this structure check.`,
    ``,
  ];
}

export function generateAgentsFile(choices: UserChoices): string {
  const siteName = capitalize(choices.projectName.replace(/-/g, " "));
  const pm = choices.packageManager;
  const lines: string[] = [
    `# ${siteName} — agent instructions`,
    ``,
    `This is a [zudo-doc](https://github.com/zudolab/zudo-doc) documentation site. \`CLAUDE.md\` describes the project layout, commands, and content conventions; read it before changing files.`,
    ``,
    ...documentationStructureSection(),
    `## Verify`,
    ``,
    `After content changes, run \`${pmRunCommand(pm, "build")}\` (validates frontmatter) and \`${pmRunCommand(pm, "check:links")}\` (validates internal links and anchors).`,
    ``,
  ];
  return lines.join("\n");
}

export function generateReadmeFile(choices: UserChoices): string {
  const siteName = capitalize(choices.projectName.replace(/-/g, " "));
  const pm = choices.packageManager;
  const lines: string[] = [
    `# ${siteName}`,
    ``,
    `Documentation site generated with the zudo-doc framework.`,
    ``,
    `## Develop`,
    ``,
    `    ${pm} install`,
    `    ${pmRunCommand(pm, "dev")}`,
    ``,
    `Run \`${pmRunCommand(pm, "build")}\` to produce the static site in \`dist/\`.`,
    ``,
    `## Adding or reorganizing docs`,
    ``,
    `Read \`${AUTHORING_POLICY_FILE}\` before adding pages or changing categories. It describes who the docs are for, what each category contains, and the steps for placing a new page. AI agents are pointed to the same file from \`CLAUDE.md\` and \`AGENTS.md\`.`,
    ``,
  ];
  return lines.join("\n");
}

/**
 * Generate the AUTHORING.md editorial-policy template. Facts the generator
 * knows (seeded categories, locale directories, enabled generators) are
 * pre-filled and labeled [fact]; everything that is the owners' choice is
 * left as TBD so neither a person nor an agent mistakes it for a decision.
 * The minimal placement procedure is inline so it works offline.
 */
export function generateAuthoringFile(
  choices: UserChoices,
  localePlan: LocalePlan,
): string {
  const siteName = capitalize(choices.projectName.replace(/-/g, " "));
  const has = (feature: string) => choices.features.includes(feature);
  const additionalLocales = localePlan.i18n ? localePlan.additionalLangs : [];
  const lines: string[] = [];

  lines.push(`# ${siteName} — documentation authoring policy`);
  lines.push(``);
  lines.push(
    `This file is the single editorial policy for this documentation. \`README.md\`, \`CLAUDE.md\`, and \`AGENTS.md\` point here. Keep category rules in this file only — do not copy them into other files.`,
  );
  lines.push(``);
  lines.push(`## How to read this file`);
  lines.push(``);
  lines.push(
    `- **[decision]** — decided by the project owners.`,
  );
  lines.push(
    `- **[fact]** — stated in existing documentation or configuration (the generator pre-filled some).`,
  );
  lines.push(
    `- **[hypothesis]** — an author's or AI agent's inference that the owners have not confirmed. It is not a rule yet.`,
  );
  lines.push(
    `- **TBD** — undecided. Do not guess a value for it; ask the owners or leave it TBD.`,
  );
  lines.push(``);

  lines.push(`## Readers and purpose`);
  lines.push(``);
  lines.push(`- Primary readers: TBD`);
  lines.push(`- What the documentation helps them do: TBD`);
  lines.push(``);

  lines.push(`## Scope`);
  lines.push(``);
  lines.push(`- In scope: TBD`);
  lines.push(`- Out of scope: TBD`);
  lines.push(``);

  lines.push(`## Entry points and reading order`);
  lines.push(``);
  lines.push(
    `- Entry points: the home page and \`/docs/getting-started/\` [fact: seeded by create-zudo-doc]`,
  );
  lines.push(`- Recommended reading order: TBD`);
  lines.push(``);

  lines.push(`## Categories`);
  lines.push(``);
  lines.push(
    `A directory under \`src/content/docs/\` is a category; its \`index.mdx\` is the landing page.`,
  );
  lines.push(``);
  lines.push(`| Category | Contains | Does not contain | Boundary with neighbours |`);
  lines.push(`|----------|----------|------------------|--------------------------|`);
  lines.push(
    `| \`getting-started/\` | First-run orientation: introduction and installation [fact: seeded] | TBD | TBD |`,
  );
  if (has("changelog")) {
    lines.push(
      `| \`changelog/\` | Release notes [fact: seeded by the changelog feature] | TBD | TBD |`,
    );
  }
  lines.push(``);
  lines.push(`Important exceptions (pages kept outside their natural category, and why): none recorded.`);
  lines.push(``);

  lines.push(`## Constraints`);
  lines.push(``);
  lines.push(
    `- **URLs**: a page's URL follows its file path, so moving a file changes its URL [fact]. Published URLs that must not change: TBD`,
  );
  if (additionalLocales.length > 0) {
    const dirs = additionalLocales
      .map((locale) => `\`src/content/docs-${locale}/\` (\`${locale}\`)`)
      .join(", ");
    lines.push(
      `- **Translation**: the default locale \`${localePlan.defaultLang}\` lives in \`src/content/docs/\`; ${dirs} mirror its tree [fact: \`locales\` in \`zfb.config.ts\`]. A structural change applies to every locale directory.`,
    );
  } else {
    lines.push(
      `- **Translation**: single locale \`${localePlan.defaultLang}\` in \`src/content/docs/\` [fact].`,
    );
  }
  lines.push(
    `- **Generated content**: pages with \`generated: true\` are generator-owned; change their source or settings, not the files [fact].`,
  );
  if (has("claudeResources") || has("codexResources")) {
    lines.push(
      `- **Resource pages**: the Claude/Codex resource generators write their own sections from \`.claude/\`, \`.codex/\`, \`CLAUDE.md\`, and \`AGENTS.md\` on every build [fact]. Do not hand-edit or move those pages.`,
    );
  }
  if (has("versioning")) {
    lines.push(
      `- **Version snapshots**: each entry in \`versions\` in \`zfb.config.ts\` names a snapshot \`docsDir\`; those trees are frozen snapshots, not locales, so do not restructure them with current content [fact]. Read the directories from the config instead of guessing a path pattern.`,
    );
  }
  lines.push(``);

  lines.push(`## Adding or changing content`);
  lines.push(``);
  lines.push(
    `1. **Typo, wording, or formatting fix only** → follow the normal writing rules in \`CLAUDE.md\` and stop here.`,
  );
  lines.push(
    `2. **Adding a page, a new reader task or topic, or changing a page's role** → answer four questions:`,
  );
  lines.push(`   1. Who can do what with this content?`);
  lines.push(`   2. Does an existing page already serve that role? (Search titles, descriptions, and category listings.)`);
  lines.push(`   3. Why this category, and is there a competing destination? (Use the boundaries above.)`);
  lines.push(`   4. Does this addition change what the category means?`);
  lines.push(
    `3. **Answers are clear** → place the content and report the placement reason in one line. Do not record routine placements here.`,
  );
  lines.push(
    `4. **Evidence of a category conflict, duplication, a new independent cluster of reader tasks, or a findability problem** → structure review:`,
  );
  lines.push(`   - Write the concrete reader problem first.`);
  lines.push(
    `   - Read the category map (the directory tree) and this file, then only the related, competing, or exception pages. Say which part you surveyed; never call a partial survey a full audit.`,
  );
  lines.push(
    `   - Compare: add to an existing page, improve while keeping the structure, a local reorganization (split/merge pages, rename/split/merge one category), or related links / an index page.`,
  );
  lines.push(
    `   - Keep only the options that solve the reader problem, then prefer the smaller change among them. Keeping the structure is a valid outcome. Do not decide by page count or category balance.`,
  );
  lines.push(
    `5. **Important goals conflict and this file does not resolve it** (for example, a fixed URL versus the right category) → ask the owners, with the concrete options and what each affects. Otherwise do not ask.`,
  );
  lines.push(``);

  lines.push(`## Maintaining this policy`);
  lines.push(``);
  lines.push(
    `- Record category meaning, important exceptions, and the reasons for reorganizations that actually happened. Label each entry [decision], [fact], or [hypothesis].`,
  );
  lines.push(
    `- Do not turn a [hypothesis] into a rule until the owners confirm it, and do not reorganize the same category again without new evidence.`,
  );
  lines.push(
    `- When you move a category or this file, update the references in \`README.md\`, \`CLAUDE.md\`, \`AGENTS.md\`${has("claudeSkillsWriting") ? ", and `.claude/skills/zudo-doc-writing/SKILL.md`" : ""} in the same change.`,
  );
  lines.push(
    `- Updating \`@takazudo/zudo-doc\` never changes this file; it is yours to maintain.`,
  );
  lines.push(``);
  lines.push(
    `Worked examples and the reasoning behind this procedure: ${MAINTAINING_STRUCTURE_GUIDE_URL} (optional; everything needed for the procedure is above).`,
  );
  lines.push(``);

  return lines.join("\n");
}
