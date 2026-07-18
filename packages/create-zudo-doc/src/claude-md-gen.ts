import type { UserChoices } from "./prompts.js";
import { capitalize, pmRunCommand } from "./utils.js";

/**
 * Generate the per-project `CLAUDE.md` (minimal-scaffold shape, epic
 * zudolab/zudo-doc#2651, Wave 6 #2660). Rewritten from scratch — the old
 * generator described a 64-file project (`src/components/admonitions/`,
 * `src/layouts/`, `src/utils/`, per-page `pages/lib/*` wiring) that no
 * longer exists. The scaffolded project is now ~13 files; almost
 * everything referenced here lives in `node_modules/@takazudo/zudo-doc`.
 */
export function generateCLAUDEFile(choices: UserChoices): string {
  const siteName = capitalize(choices.projectName.replace(/-/g, " "));
  const lines: string[] = [];

  lines.push(`# ${siteName}`);
  lines.push(``);
  lines.push(
    `Documentation site built with [zudo-doc](https://github.com/zudolab/zudo-doc) — a zfb-based documentation framework with MDX, Tailwind CSS v4, and Preact islands. This project is intentionally minimal: one config file (\`zfb.config.ts\`) plus markdown content — layout, chrome, and islands all ship from \`@takazudo/zudo-doc\` in \`node_modules\`.`,
  );
  lines.push(``);

  // Tech stack
  lines.push(`## Tech Stack`);
  lines.push(``);
  lines.push(`- **zfb** — documentation build framework`);
  lines.push(`- **MDX** — content format, authored under \`src/content/\``);
  lines.push(`- **Tailwind CSS v4** — via \`@tailwindcss/vite\``);
  lines.push(
    `- **Preact** — for interactive islands only (with compat mode for React API)`,
  );
  lines.push(
    `- **Shiki** — package-owned code highlighting with the configured light/dark theme pair`,
  );
  lines.push(
    `- **@takazudo/zudo-doc** — the package that owns everything: layout, chrome, islands, default \`@theme\` design tokens, and (via \`packageOwnedRoutes\`, on by default) the doc routes themselves`,
  );
  lines.push(``);

  // Commands
  lines.push(`## Commands`);
  lines.push(``);
  const pm = choices.packageManager;
  if (choices.features.includes("docHistory")) {
    lines.push(
      `- \`${pmRunCommand(pm, "dev")}\` — runs the zfb dev server (port 4321) and the doc-history API server (port 4322) concurrently via \`run-p\` (\`${pmRunCommand(pm, "dev:zfb")}\` / \`${pmRunCommand(pm, "dev:history")}\` individually)`,
    );
    lines.push(
      `- \`${pmRunCommand(pm, "dev:network")}\` — same, but zfb binds \`--host 0.0.0.0\` for LAN access (\`${pmRunCommand(pm, "dev:zfb:network")}\` individually); the doc-history server stays loopback-only and LAN clients reach it through zfb's \`/doc-history/*\` dev proxy`,
    );
    lines.push(
      `- \`run-p\` swallows trailing args, so other zfb flags don't forward through \`${pmRunCommand(pm, "dev")}\` — pass them directly instead: \`${pm} run dev:zfb -- <flags>\``,
    );
  } else {
    lines.push(`- \`${pmRunCommand(pm, "dev")}\` — zfb dev server (port 4321)`);
  }
  lines.push(`- \`${pmRunCommand(pm, "build")}\` — static HTML export to \`dist/\``);
  lines.push(`- \`${pmRunCommand(pm, "check")}\` — TypeScript type checking`);
  lines.push(`- \`${pmRunCommand(pm, "preview")}\` — serve the built \`dist/\``);
  lines.push(``);

  // Key directories
  lines.push(`## Key Directories`);
  lines.push(``);
  lines.push("```");
  lines.push(`zfb.config.ts             # THE one config file — zudoDoc({ ...only fields you chose })`);
  lines.push(`pages/`);
  lines.push(`├── index.tsx             # 1-line re-export of the package home route`);
  lines.push(`└── docs/[[...slug]].tsx  # self-contained doc-route stub (required for \`${pm} dev\`)`);
  if (choices.features.includes("i18n")) {
    lines.push(`  [locale]/docs/[[...slug]].tsx  # same, for non-default locales`);
  }
  lines.push(`src/`);
  lines.push(`├── chrome-bindings.tsx   # optional typed primary chrome / named header / MDX bindings`);
  lines.push(`├── content/`);
  lines.push(`│   └── docs/             # MDX content (this project's showcase docs)`);

  if (choices.features.includes("i18n")) {
    const secondaryLang = choices.defaultLang === "ja" ? "en" : "ja";
    lines.push(
      `│   └── docs-${secondaryLang}/         # ${secondaryLang === "ja" ? "Japanese" : "English"} MDX content (mirrors docs/)`,
    );
  }

  lines.push(`└── styles/`);
  lines.push(`    └── global.css        # @import chain + a token-override slot — that's it`);
  lines.push("```");
  lines.push(``);
  lines.push(
    `Everything else — layout, header, sidebar, footer, doc chrome, islands, and the default design tokens — lives in \`node_modules/@takazudo/zudo-doc\`. For supported markup replacement, create \`src/chrome-bindings.tsx\` with \`defineChromeBindings\`, set \`chromeBindingsModule\`, and use the primary \`Header\` / \`Footer\` / \`Sidebar\` / \`Toc\` / \`Breadcrumb\` / \`DocPager\` slots or the named \`headerRightComponents\` registry. The generated default, locale, and doc-history route shapes already consume the same binding object; do not fork a route stub for presentational customization. \`npx zudo-doc eject <component>\` only copies source: heed its primary, nested-chrome, or content-layer remediation before expecting the copy to render. Settings you didn't set explicitly in \`zfb.config.ts\` use the package's documented defaults — hover \`zudoDoc\`'s \`ZudoDocConfig\` argument in your editor to see every field and its \`@default\`.`,
  );
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
    `Available in all MDX files without imports, via directive syntax: \`:::note\`, \`:::tip\`, \`:::info\`, \`:::warning\`, \`:::danger\`, \`:::caution\`, \`:::details\`. Each accepts an optional \`{title="..."}\` attribute.`,
  );
  lines.push(``);
  lines.push(`### Headings`);
  lines.push(``);
  lines.push(
    `Do NOT use h1 (\`#\`) in doc content — the page title from frontmatter is rendered as h1. Start content headings from h2 (\`##\`).`,
  );
  lines.push(``);

  // Built-in MDX components. The seeded getting-started/index.mdx uses
  // <CategoryNav>, a package-provided global — without this section a new user
  // has no in-project pointer to what it is or which siblings exist (#2703).
  lines.push(`### Built-in MDX components`);
  lines.push(``);
  lines.push(
    `\`@takazudo/zudo-doc\` ships a few **globally-available MDX components** — usable in any \`.mdx\` file with **no import**. The seeded \`getting-started/index.mdx\` already uses one:`,
  );
  lines.push(``);
  lines.push(
    `- \`<CategoryNav category="..." />\` — a card-grid list of the pages in a docs category (this is the one seeded into \`getting-started/index.mdx\`).`,
  );
  lines.push(
    `- \`<CategoryTreeNav category="..." />\` — the same listing as a compact nested tree, better for deeper hierarchies.`,
  );
  lines.push(
    `- \`<SiteTreeNavDemo />\` — a full-site documentation tree (the MDX-available wrapper of the \`SiteTreeNav\` island).`,
  );
  lines.push(``);
  lines.push(
    `Admonitions (above), tabbed content (\`<Tabs>\` / \`<TabItem>\`, \`<CodeGroup>\`), and block math (\`<MathBlock>\`) work the same way — no import. Full reference: https://zudo-doc.takazudomodular.com/docs/components/`,
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
    lines.push(
      `- Both \`pages/docs/[[...slug]].tsx\` and \`pages/[locale]/docs/[[...slug]].tsx\` are self-contained doc-route stubs shipped by the generator — required so \`${pm} dev\` doesn't 404 on doc pages (a zfb dev-mode limitation on package-injected dynamic routes). Don't delete them.`,
    );
    lines.push(``);
  }

  // Enabled features
  const featureDescriptions: Record<string, string> = {
    search: "Full-text search via Pagefind",
    designTokenPanel:
      "Interactive tabbed panel for tweaking spacing, font, size, and color tokens",
    sidebarResizer: "Draggable sidebar width",
    sidebarToggle: "Show/hide desktop sidebar",
    versioning: "Multi-version documentation support",
    docHistory: "Document edit history",
    llmsTxt: "Generates llms.txt for LLM consumption",
    claudeResources: "Auto-generated docs for Claude Code resources",
    changelog: "Changelog page at `/docs/changelog`",
    tauri:
      "Desktop app wrapper (`cargo tauri dev` / `cargo tauri build`) — Cmd/Ctrl+F find bar via the package-owned `FindInPageInit` island (`findInPage: true` in `zfb.config.ts`)",
    tagGovernance:
      "Vocabulary-aware tag audit (`tags:audit`) / suggest (`tags:suggest`) scripts",
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
