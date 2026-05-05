import type { UserChoices } from "./prompts.js";
import { capitalize } from "./utils.js";

function runCmd(pm: string, script: string): string {
  if (pm === "npm") return `npm run ${script}`;
  return `${pm} ${script}`;
}

export function generateCLAUDEFile(choices: UserChoices): string {
  const siteName = capitalize(choices.projectName.replace(/-/g, " "));
  const lines: string[] = [];

  lines.push(`# ${siteName}`);
  lines.push(``);
  lines.push(
    `Documentation site built with [zudo-doc](https://github.com/zudolab/zudo-doc) — a zfb-based documentation framework with MDX, Tailwind CSS v4, and Preact islands.`,
  );
  lines.push(``);

  // Tech stack
  lines.push(`## Tech Stack`);
  lines.push(``);
  lines.push(`- **zfb** — documentation build framework`);
  lines.push(`- **MDX** — content format`);
  lines.push(
    `- **Tailwind CSS v4** — via \`@tailwindcss/vite\``,
  );
  lines.push(
    `- **Preact** — for interactive islands only (with compat mode for React API)`,
  );
  lines.push(
    `- **syntect** — built-in code highlighting, run by zfb's Rust pipeline at build time (single fixed theme: \`base16-ocean-dark\`)`,
  );
  lines.push(``);

  // Commands
  lines.push(`## Commands`);
  lines.push(``);
  const pm = choices.packageManager;
  lines.push(`- \`${runCmd(pm, "dev")}\` — zfb dev server (port 4321)`);
  lines.push(`- \`${runCmd(pm, "build")}\` — static HTML export to \`dist/\``);
  lines.push(`- \`${runCmd(pm, "check")}\` — TypeScript type checking`);
  lines.push(``);

  // Key directories
  lines.push(`## Key Directories`);
  lines.push(``);
  lines.push("```");
  lines.push(`src/`);
  lines.push(`├── components/          # JSX + Preact components`);
  lines.push(`│   └── admonitions/     # Note, Tip, Info, Warning, Danger`);
  lines.push(`├── config/              # Settings, color schemes`);
  lines.push(`├── content/`);
  lines.push(`│   └── docs/            # MDX content`);

  if (choices.features.includes("i18n")) {
    const secondaryLang = choices.defaultLang === "ja" ? "en" : "ja";
    lines.push(
      `│   └── docs-${secondaryLang}/         # ${secondaryLang === "ja" ? "Japanese" : "English"} MDX content (mirrors docs/)`,
    );
  }

  lines.push(`├── layouts/             # JSX layouts`);
  lines.push(`├── pages/               # File-based routing`);
  lines.push(`└── styles/`);
  lines.push(`    └── global.css       # Design tokens & Tailwind config`);
  lines.push("```");
  lines.push(``);

  // Content conventions
  lines.push(`## Content Conventions`);
  lines.push(``);
  lines.push(`### Frontmatter`);
  lines.push(``);
  lines.push(`- Required: \`title\` (string)`);
  lines.push(
    `- Optional: \`description\`, \`sidebar_position\` (number), \`category\``,
  );
  lines.push(`- Sidebar order is driven by \`sidebar_position\``);
  lines.push(``);
  lines.push(`### Admonitions`);
  lines.push(``);
  lines.push(
    `Available in all MDX files without imports: \`<Note>\`, \`<Tip>\`, \`<Info>\`, \`<Warning>\`, \`<Danger>\``,
  );
  lines.push(`Each accepts an optional \`title\` prop.`);
  lines.push(``);
  lines.push(`### Headings`);
  lines.push(``);
  lines.push(
    `Do NOT use h1 (\`#\`) in doc content — the page title from frontmatter is rendered as h1. Start content headings from h2 (\`##\`).`,
  );
  lines.push(``);

  // Components
  lines.push(`## Components`);
  lines.push(``);
  lines.push(
    `- Default to **server-rendered JSX components** (\`.tsx\`) — zero JS, server-rendered`,
  );
  lines.push(
    `- Use **Preact islands** (\`client:load\`) only when client-side interactivity is needed`,
  );
  lines.push(``);

  // i18n section
  if (choices.features.includes("i18n")) {
    const secondaryLang = choices.defaultLang === "ja" ? "en" : "ja";
    const defaultLabel =
      choices.defaultLang === "ja" ? "Japanese" : "English";
    const secondaryLabel = secondaryLang === "ja" ? "Japanese" : "English";

    lines.push(`## i18n`);
    lines.push(``);
    lines.push(
      `- ${defaultLabel} (default): \`/docs/...\` — content in \`src/content/docs/\``,
    );
    lines.push(
      `- ${secondaryLabel}: \`/${secondaryLang}/docs/...\` — content in \`src/content/docs-${secondaryLang}/\``,
    );
    lines.push(
      `- ${secondaryLabel} docs should mirror the ${defaultLabel} directory structure`,
    );
    lines.push(``);
  }

  // Enabled features
  const featureDescriptions: Record<string, string> = {
    search: "Full-text search via Pagefind",
    sidebarFilter: "Real-time sidebar filtering",
    designTokenPanel: "Interactive tabbed panel for tweaking spacing, font, size, and color tokens",
    sidebarResizer: "Draggable sidebar width",
    sidebarToggle: "Show/hide desktop sidebar",
    versioning: "Multi-version documentation support",
    docHistory: "Document edit history",
    llmsTxt: "Generates llms.txt for LLM consumption",
    claudeResources: "Auto-generated docs for Claude Code resources",
    changelog: "Changelog page at `/docs/changelog`",
  };

  const enabledFeatures = choices.features.filter(
    (f) =>
      featureDescriptions[f] !== undefined &&
      f !== "footerNavGroup" &&
      f !== "footerCopyright" &&
      f !== "skillSymlinker",
  );

  if (enabledFeatures.length > 0) {
    lines.push(`## Enabled Features`);
    lines.push(``);
    for (const f of enabledFeatures) {
      lines.push(`- **${f}** — ${featureDescriptions[f]}`);
    }
    lines.push(``);
  }

  return lines.join("\n");
}
