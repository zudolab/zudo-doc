import { defineConfig } from "zfb/config";
import { zudoDocPreset } from "@takazudo/zudo-doc/preset";
import { settings } from "./src/config/settings";
import { buildDocsSchema } from "./src/config/docs-schema";
import { translations } from "./src/config/i18n";
import { colorSchemes } from "./src/config/color-schemes";

// The canonical seven directives for this showcase. Keys are directive names;
// values are the JSX component names registered in pages/_mdx-components.ts.
// "details" routes to DetailsWrapper — a collapsible, NOT an admonition.
const directiveVocabulary = {
  note: "Note",
  tip: "Tip",
  info: "Info",
  warning: "Warning",
  danger: "Danger",
  caution: "Caution",
  details: "Details",
};

export default defineConfig({
  // ── Host-owned shell fields (not delegated to the preset) ──────────────────
  framework: "preact",
  // Pin the dev/preview port — zfb defaults to 3000, but CLAUDE.md, the
  // EADDRINUSE guidance, and the Tauri Mode-1 devUrl all assume 4321 (#2043).
  port: 4321,
  tailwind: { enabled: true },
  // Keep the md-plugins test fixtures and e2e fixtures out of the bundler's
  // shadow-tree walk. bundle.exclude (zfb next.22) is the intended escape
  // hatch; adopted with next.23 after the stale ambient-type fix (#1834).
  bundle: {
    exclude: ["packages/md-plugins/__fixtures__/**", "e2e/fixtures/**", "_temp-resource/**"],
  },
  // Public URL prefix for `<link rel="stylesheet">` and `<script>` tags.
  // Currently "/" (root) for the Workers static assets deploy.
  base: settings.base,
  // Cloudflare adapter — required for routes with `prerender = false`
  // (currently pages/api/ai-chat.tsx). Bindings via wrangler.toml.
  adapter: "@takazudo/zfb-adapter-cloudflare",

  // ── Preset-owned fields (collections, plugins, markdown, codeHighlight, …) ─
  ...zudoDocPreset({ settings, buildDocsSchema, directiveVocabulary, translations, colorSchemes }),
});
