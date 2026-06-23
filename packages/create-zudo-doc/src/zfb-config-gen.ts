import type { UserChoices } from "./prompts.js";

/**
 * Programmatically generate zfb.config.ts from user choices.
 *
 * S5b (#2329): collapsed to the thin preset-based shape that mirrors the
 * showcase `zfb.config.ts` after S5a. All collection wiring, plugin
 * descriptors, markdown features, codeHighlight, resolveMarkdownLinks, and
 * trailingSlash are now owned by `zudoDocPreset()` in
 * `@takazudo/zudo-doc/preset`. The generated config spreads the preset
 * result into `defineConfig` and keeps only the project-owned shell fields
 * (`framework`, `port`, `tailwind`, `base`).
 *
 * Replaces the former astro-config-gen.ts + content-config-gen.ts pair.
 * In the zfb world, content-collection schemas live inside zfb.config.ts
 * itself — there is no separate content.config.ts.
 */
export function generateZfbConfig(_choices: UserChoices): string {
  const lines: string[] = [];

  // --- Imports ---
  lines.push(`import { defineConfig } from "zfb/config";`);
  lines.push(`import { zudoDocPreset } from "@takazudo/zudo-doc/preset";`);
  lines.push(`import { settings } from "./src/config/settings";`);
  lines.push(`import { buildDocsSchema } from "./src/config/docs-schema";`);
  lines.push(``);

  // --- Directive vocabulary ---
  // The seven canonical directives registered in pages/_mdx-components.ts.
  // "details" routes to DetailsWrapper — a collapsible, NOT an admonition.
  lines.push(`const directiveVocabulary = {`);
  lines.push(`  note: "Note",`);
  lines.push(`  tip: "Tip",`);
  lines.push(`  info: "Info",`);
  lines.push(`  warning: "Warning",`);
  lines.push(`  danger: "Danger",`);
  lines.push(`  caution: "Caution",`);
  lines.push(`  details: "Details",`);
  lines.push(`};`);
  lines.push(``);

  // --- Export ---
  lines.push(`export default defineConfig({`);
  lines.push(`  // ── Host-owned shell fields ──────────────────────────────────────────────`);
  lines.push(`  framework: "preact",`);
  lines.push(`  // Pin the dev/preview port — zfb defaults to 3000, but the generated`);
  lines.push(`  // CLAUDE.md and the Tauri dev wrappers assume 4321.`);
  lines.push(`  port: 4321,`);
  lines.push(`  tailwind: { enabled: true },`);
  lines.push(`  // Public URL prefix for <link rel="stylesheet"> and <script> tags.`);
  lines.push(`  base: settings.base,`);
  lines.push(``);
  lines.push(`  // ── Preset-owned fields (content collections, plugins, markdown, …) ────────`);
  lines.push(`  ...zudoDocPreset({ settings, buildDocsSchema, directiveVocabulary }),`);
  lines.push(`});`);

  return lines.join("\n") + "\n";
}
